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
      prefixes: ['basecolor_', 'albedo_', 'base_color_', 'diffuse_']
    },
    { inputId: 'normalMap', label: 'Normal', prefixes: ['normal_'] },
    { inputId: 'roughnessMap', label: 'Roughness', prefixes: ['roughness_'] },
    { inputId: 'f0Map', label: 'F0/Specular', prefixes: ['f0_', 'specular_', 'metallic_'] },
    { inputId: 'alphaMap', label: 'Alpha', prefixes: ['alpha_', 'opacity_'] },
    { inputId: 'depthMap', label: 'Depth', prefixes: ['depth_', 'displacement_'] }
  ];

  function resolveTextureFile(inputId) {
    const manualFile = document.getElementById(inputId)?.files?.[0];
    return manualFile || state.autoTextureFiles?.[inputId] || null;
  }

  function refreshTextureMappingPreview(unmatched = []) {
    const listEl = document.getElementById('textureMappingList');
    const hintEl = document.getElementById('textureMappingHint');
    if (!listEl || !hintEl) return;

    const lines = mappingRules.map((rule) => {
      const file = resolveTextureFile(rule.inputId);
      const cls = file ? 'mapped' : 'missing';
      const text = file ? `${rule.label} -> ${file.name}` : `${rule.label} -> 未匹配`;
      return `<li class="${cls}">${text}</li>`;
    });

    if (unmatched.length > 0) {
      lines.push(`<li class="missing">未匹配文件：${unmatched.join(', ')}</li>`);
    }

    listEl.innerHTML = lines.join('');
    const mappedCount = mappingRules.filter((rule) => resolveTextureFile(rule.inputId)).length;
    hintEl.textContent = `当前已绑定 ${mappedCount}/6 个贴图槽位。`;
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
    const unmatched = [];
    for (const file of files) {
      const normalized = file.name.toLowerCase();
      let matched = false;
      for (const rule of mappingRules) {
        if (selected[rule.inputId]) continue;
        if (rule.prefixes.some((prefix) => normalized.startsWith(prefix))) {
          selected[rule.inputId] = file;
          matched = true;
        }
      }
      if (!matched) unmatched.push(file.name);
    }

    state.autoTextureFiles = selected;
    const mappedCount = Object.keys(selected).length;
    const detail = mappingRules
      .filter((rule) => selected[rule.inputId])
      .map((rule) => `${rule.inputId}:${selected[rule.inputId].name}`)
      .join(' | ');

    if (mappedCount === 0) {
      refreshTextureMappingPreview(unmatched);
      reportStep?.('文件夹自动映射', false, '未匹配到规则文件');
      setStatus('自动映射失败：未找到符合命名规则的贴图文件。', true);
      return;
    }

    refreshTextureMappingPreview(unmatched);
    reportStep?.('文件夹自动映射', true, `匹配 ${mappedCount} 项`);
    setStatus(`自动映射完成（${mappedCount}/6）：${detail}`);
  }

  const applyMaps = createMapsApplier({
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
    refreshTextureMappingPreview
  };
}
