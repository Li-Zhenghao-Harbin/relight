import { createMapsApplier } from './pipeline/applier.js';
import { createModelExporter } from './pipeline/exporter.js';
import { createModelImporter } from './pipeline/importer.js';

export function createModelPipeline({ state, sceneController, uiController }) {
  const { scene, renderer, keyLight, fitCameraToObject } = sceneController;
  const { setStatus } = uiController;

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
    setStatus
  });

  return {
    applyMaps,
    importModelForLighting,
    exportGlb,
    updateShadowSettings,
    applyModelShadowFlags
  };
}
