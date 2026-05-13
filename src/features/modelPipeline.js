import { createMapsApplier } from './pipeline/applier.js';
import { createModelExporter } from './pipeline/exporter.js';
import { createModelImporter } from './pipeline/importer.js';

export function createModelPipeline({ state, sceneController, uiController }) {
  const { scene, renderer, keyLight, fitCameraToObject } = sceneController;
  const { setStatus, reportStep, clearStepLog } = uiController;
  const mappingRules = [
    {
      inputId: 'baseMap',
      label: 'Albedo/BaseColor',
      ruleInputId: 'ruleBaseMap',
      defaultPrefixes: ['basecolor_', 'albedo_', 'base_color_', 'diffuse_']
    },
    {
      inputId: 'normalMap',
      label: 'Normal',
      ruleInputId: 'ruleNormalMap',
      defaultPrefixes: ['normal_']
    },
    {
      inputId: 'roughnessMap',
      label: 'Roughness',
      ruleInputId: 'ruleRoughnessMap',
      defaultPrefixes: ['roughness_']
    },
    {
      inputId: 'f0Map',
      label: 'F0/Specular',
      ruleInputId: 'ruleF0Map',
      defaultPrefixes: ['f0_', 'specular_', 'metallic_']
    },
    {
      inputId: 'alphaMap',
      label: 'Alpha',
      ruleInputId: 'ruleAlphaMap',
      defaultPrefixes: ['alpha_', 'opacity_']
    },
    {
      inputId: 'depthMap',
      label: 'Depth',
      ruleInputId: 'ruleDepthMap',
      defaultPrefixes: ['depth_', 'displacement_']
    }
  ];

  function getPrefixesFromRule(rule) {
    const raw = document.getElementById(rule.ruleInputId)?.value || '';
    const parsed = raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : rule.defaultPrefixes;
  }

  function assignFileToInput(inputId, file) {
    if (!file) return;
    const input = document.getElementById(inputId);
    if (!input) return;
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
    } catch {
      // 某些浏览器不允许脚本设置 input.files，保留自动映射的回退逻辑。
    }
  }

  function resolveTextureFile(inputId) {
    const manualFile = document.getElementById(inputId)?.files?.[0];
    return manualFile || state.autoTextureFiles?.[inputId] || null;
  }

  function refreshTextureMappingPreview() {
    const listEl = document.getElementById('textureMappingList');
    if (!listEl) return;

    const lines = mappingRules
      .map((rule) => {
        const file = resolveTextureFile(rule.inputId);
        if (!file) return null;
        return `<li class="mapped">${rule.label}：${file.name}</li>`;
      })
      .filter(Boolean);

    listEl.innerHTML = lines.join('');
  }

  function updateTriangulationEstimate() {
    const estimateEl = document.getElementById('triangulationEstimate');
    if (!estimateEl) return;

    const depthImage = state.material?.displacementMap?.image;
    const width = depthImage?.width || 0;
    const height = depthImage?.height || 0;
    if (!width || !height) {
      estimateEl.textContent = '预计网格：需先应用包含 Depth 的贴图';
      return;
    }

    const maxPointsInput = document.getElementById('triangulationMaxPoints');
    const maxPoints = Math.max(1, Number(maxPointsInput?.value) || 250000);
    const pixelCount = width * height;
    const stride = Math.max(1, Math.ceil(Math.sqrt(pixelCount / maxPoints)));
    const sampledWidth = Math.ceil(width / stride);
    const sampledHeight = Math.ceil(height / stride);
    const vertexCount = sampledWidth * sampledHeight;
    const triangleCount = Math.max(0, (sampledWidth - 1) * (sampledHeight - 1) * 2);

    estimateEl.textContent = `预计网格：${sampledWidth}x${sampledHeight}，顶点 ${vertexCount.toLocaleString()}，三角形 ${triangleCount.toLocaleString()}`;
  }

  function disposeTexture(texture) {
    if (texture) texture.dispose();
  }

  function disposeMaterial(material) {
    if (!material) return;
    Object.values(material).forEach((value) => {
      if (value && value.isTexture) value.dispose();
    });
    material.dispose();
  }

  function disposeCurrentMesh() {
    if (!state.mesh) return;
    scene.remove(state.mesh);
    state.mesh.geometry.dispose();
    state.mesh.material.dispose();
    state.mesh = null;
  }

  function disposeImportedRoot() {
    if (!state.importedRoot) return;
    scene.remove(state.importedRoot);
    state.importedRoot.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry?.dispose();
      if (Array.isArray(node.material)) {
        node.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(node.material);
      }
    });
    state.importedRoot = null;
  }

  function cleanupTextures() {
    Object.values(state.textures).forEach(disposeTexture);
    state.textures = {};
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls = [];
  }

  function forEachSceneMesh(callback) {
    if (state.mesh) callback(state.mesh);
    if (state.importedRoot) {
      state.importedRoot.traverse((node) => {
        if (node.isMesh) callback(node);
      });
    }
  }

  function applyModelShadowFlags() {
    const cast = document.getElementById('modelCastShadow').checked;
    const receive = document.getElementById('modelReceiveShadow').checked;
    forEachSceneMesh((mesh) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    });
  }

  function updateShadowSettings() {
    const enabled = document.getElementById('enableShadows').checked;
    const mapSize = Number(document.getElementById('shadowMapSize').value);
    const bias = Number(document.getElementById('shadowBias').value);
    const normalBias = Number(document.getElementById('shadowNormalBias').value);
    const intensity = Number(document.getElementById('lightIntensity').value);

    renderer.shadowMap.enabled = enabled;
    keyLight.castShadow = enabled;
    keyLight.intensity = intensity;
    keyLight.shadow.bias = bias;
    keyLight.shadow.normalBias = normalBias;

    if (keyLight.shadow.mapSize.x !== mapSize || keyLight.shadow.mapSize.y !== mapSize) {
      keyLight.shadow.mapSize.set(mapSize, mapSize);
      if (keyLight.shadow.map) {
        keyLight.shadow.map.dispose();
        keyLight.shadow.map = null;
      }
    }

    applyModelShadowFlags();
  }

  function importTextureFolder(files) {
    if (!files || files.length === 0) {
      setStatus('未选择任何文件夹内容。', true);
      return;
    }

    const selected = {};
    for (const file of files) {
      const normalized = file.name.toLowerCase();
      for (const rule of mappingRules) {
        if (selected[rule.inputId]) continue;
        const prefixes = getPrefixesFromRule(rule);
        if (prefixes.some((prefix) => normalized.startsWith(prefix))) {
          selected[rule.inputId] = file;
          break;
        }
      }
    }

    state.autoTextureFiles = selected;
    mappingRules.forEach((rule) => {
      assignFileToInput(rule.inputId, selected[rule.inputId]);
    });
    const mappedCount = Object.keys(selected).length;
    const detail = mappingRules
      .filter((rule) => selected[rule.inputId])
      .map((rule) => `${rule.inputId}:${selected[rule.inputId].name}`)
      .join(' | ');

    if (mappedCount === 0) {
      refreshTextureMappingPreview();
      reportStep?.('文件夹自动映射', false, '未找到符合规则的贴图文件');
      setStatus('自动映射失败：未找到符合命名规则的贴图文件。', true);
      return;
    }

    refreshTextureMappingPreview();
    reportStep?.('文件夹自动映射', true, `匹配 ${mappedCount} 项`);
    setStatus(`自动映射完成（${mappedCount}/6）：${detail}`);
  }

  const applyMapsInternal = createMapsApplier({
    state,
    scene,
    setStatus,
    applyModelShadowFlags,
    cleanupBeforeApply: () => {
      disposeImportedRoot();
      cleanupTextures();
      disposeCurrentMesh();
    }
  });

  const applyMaps = async () => {
    await applyMapsInternal();
    updateTriangulationEstimate();
  };

  const importModelForLighting = createModelImporter({
    state,
    scene,
    fitCameraToObject,
    setStatus,
    applyModelShadowFlags,
    cleanupBeforeImport: () => {
      disposeCurrentMesh();
      cleanupTextures();
      disposeImportedRoot();
    }
  });

  const exportGlb = createModelExporter({
    state,
    setStatus,
    reportStep,
    clearStepLog,
    getCameraFov: () => sceneController.camera.fov
  });

  return {
    applyMaps,
    importModelForLighting,
    exportGlb,
    updateShadowSettings,
    applyModelShadowFlags,
    importTextureFolder,
    refreshTextureMappingPreview,
    updateTriangulationEstimate
  };
}
