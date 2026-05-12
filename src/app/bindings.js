import { MODE_CONFIG } from './modeConfig.js';

function bindModeEvents({ setUiMode }) {
  MODE_CONFIG.forEach((mode) => {
    document.getElementById(mode.tabButtonId).addEventListener('click', () => setUiMode(mode.key));
  });
}

function bindActionEvents({ applyMaps, exportGlb, importModelForLighting }) {
  document.getElementById('applyBtn').addEventListener('click', applyMaps);
  document.getElementById('exportBtn').addEventListener('click', exportGlb);
  document.getElementById('importBtn').addEventListener('click', importModelForLighting);
}

function bindFolderImportEvents({ importTextureFolder }) {
  const triggerBtn = document.getElementById('pickTextureFolderBtn');
  const folderInput = document.getElementById('textureFolderInput');
  if (!triggerBtn || !folderInput || !importTextureFolder) return;

  triggerBtn.addEventListener('click', () => folderInput.click());
  folderInput.addEventListener('change', () => {
    importTextureFolder(Array.from(folderInput.files || []));
  });
}

function bindTextureInputEvents({ refreshTextureMappingPreview }) {
  if (!refreshTextureMappingPreview) return;
  const ids = ['baseMap', 'normalMap', 'roughnessMap', 'f0Map', 'alphaMap', 'depthMap'];
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => refreshTextureMappingPreview());
  });
}

function bindValueDisplays({ bindNumberDisplay }) {
  bindNumberDisplay('segments', 'segmentsValue');
  bindNumberDisplay('displacementScale', 'displacementScaleValue', (v) => v.toFixed(3));
  bindNumberDisplay('displacementBias', 'displacementBiasValue', (v) => v.toFixed(3));
  bindNumberDisplay('normalScale', 'normalScaleValue', (v) => v.toFixed(2));
  bindNumberDisplay('roughnessValue', 'roughnessValueText', (v) => v.toFixed(2));
  bindNumberDisplay('metalnessValue', 'metalnessValueText', (v) => v.toFixed(2));
  bindNumberDisplay('lightX', 'lightXValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightY', 'lightYValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightZ', 'lightZValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightIntensity', 'lightIntensityValue', (v) => v.toFixed(2));
  bindNumberDisplay('shadowBias', 'shadowBiasValue', (v) => v.toFixed(4));
  bindNumberDisplay('shadowNormalBias', 'shadowNormalBiasValue', (v) => v.toFixed(3));
}

function bindLightingEvents({ updateMainLightPosition, updateShadowSettings }) {
  document.getElementById('lightX').addEventListener('input', updateMainLightPosition);
  document.getElementById('lightY').addEventListener('input', updateMainLightPosition);
  document.getElementById('lightZ').addEventListener('input', updateMainLightPosition);
  document.getElementById('lightIntensity').addEventListener('input', updateShadowSettings);
  document.getElementById('enableShadows').addEventListener('change', updateShadowSettings);
  document.getElementById('modelCastShadow').addEventListener('change', updateShadowSettings);
  document.getElementById('modelReceiveShadow').addEventListener('change', updateShadowSettings);
  document.getElementById('shadowMapSize').addEventListener('change', updateShadowSettings);
  document.getElementById('shadowBias').addEventListener('input', updateShadowSettings);
  document.getElementById('shadowNormalBias').addEventListener('input', updateShadowSettings);
}

export function initializeBindings({
  setUiMode,
  bindNumberDisplay,
  applyMaps,
  exportGlb,
  importModelForLighting,
  importTextureFolder,
  refreshTextureMappingPreview,
  updateMainLightPosition,
  updateShadowSettings
}) {
  bindModeEvents({ setUiMode });
  bindActionEvents({ applyMaps, exportGlb, importModelForLighting });
  bindFolderImportEvents({ importTextureFolder });
  bindTextureInputEvents({ refreshTextureMappingPreview });
  bindValueDisplays({ bindNumberDisplay });
  bindLightingEvents({ updateMainLightPosition, updateShadowSettings });
}
