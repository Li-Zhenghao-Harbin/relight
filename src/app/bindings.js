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

function bindRuleDialogEvents({ refreshTextureMappingPreview }) {
  const dialog = document.getElementById('ruleDialog');
  const openBtn = document.getElementById('openRuleDialogBtn');
  const closeBtn = document.getElementById('ruleDialogCloseBtn');
  const backdrop = document.getElementById('ruleDialogBackdrop');
  if (!dialog || !openBtn || !closeBtn || !backdrop) return;

  const ruleInputIds = ['ruleBaseMap', 'ruleNormalMap', 'ruleRoughnessMap', 'ruleF0Map', 'ruleAlphaMap', 'ruleDepthMap'];

  function openDialog() {
    dialog.hidden = false;
    dialog.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    dialog.setAttribute('aria-hidden', 'true');
    openBtn.focus();
  }

  openBtn.addEventListener('click', openDialog);
  closeBtn.addEventListener('click', closeDialog);
  backdrop.addEventListener('click', closeDialog);

  ruleInputIds.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => refreshTextureMappingPreview?.());
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialog.hidden) {
      e.preventDefault();
      closeDialog();
    }
  });
}

function bindTextureInputEvents({ refreshTextureMappingPreview, updateTriangulationEstimate }) {
  if (!refreshTextureMappingPreview && !updateTriangulationEstimate) return;
  const ids = ['baseMap', 'normalMap', 'roughnessMap', 'f0Map', 'alphaMap', 'depthMap'];
  ids.forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      refreshTextureMappingPreview?.();
      updateTriangulationEstimate?.();
    });
  });
}

function bindValueDisplays({ bindNumberDisplay }) {
  bindNumberDisplay('segments', 'segmentsValue');
  bindNumberDisplay('displacementScale', 'displacementScaleValue', (v) => v.toFixed(3));
  bindNumberDisplay('displacementBias', 'displacementBiasValue', (v) => v.toFixed(3));
  bindNumberDisplay('normalScale', 'normalScaleValue', (v) => v.toFixed(2));
  bindNumberDisplay('roughnessValue', 'roughnessValueText', (v) => v.toFixed(2));
  bindNumberDisplay('metalnessValue', 'metalnessValueText', (v) => v.toFixed(2));
  bindNumberDisplay('triangulationMaxPoints', 'triangulationMaxPointsValue', (v) => Math.round(v).toString());
  bindNumberDisplay('depthHoleFillIters', 'depthHoleFillItersValue', (v) => Math.round(v).toString());
  bindNumberDisplay('depthBilateralSpatial', 'depthBilateralSpatialValue', (v) => Math.round(v).toString());
  bindNumberDisplay('depthBilateralRange', 'depthBilateralRangeValue', (v) => v.toFixed(2));
  bindNumberDisplay('depthEdgeAwareStrength', 'depthEdgeAwareStrengthValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightX', 'lightXValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightY', 'lightYValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightZ', 'lightZValue', (v) => v.toFixed(2));
  bindNumberDisplay('lightIntensity', 'lightIntensityValue', (v) => v.toFixed(2));
  bindNumberDisplay('shadowBias', 'shadowBiasValue', (v) => v.toFixed(4));
  bindNumberDisplay('shadowNormalBias', 'shadowNormalBiasValue', (v) => v.toFixed(3));
}

function bindTriangulationEvents({ updateTriangulationEstimate }) {
  if (!updateTriangulationEstimate) return;
  const ids = [
    'triangulationMaxPoints',
    'depthHoleFillIters',
    'depthBilateralSpatial',
    'depthBilateralRange',
    'depthEdgeAwareStrength',
    'depthRefineEnabled'
  ];
  ids.forEach((id) => {
    const eventName = id === 'depthRefineEnabled' ? 'change' : 'input';
    document.getElementById(id)?.addEventListener(eventName, updateTriangulationEstimate);
  });
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
  updateTriangulationEstimate,
  updateMainLightPosition,
  updateShadowSettings
}) {
  bindModeEvents({ setUiMode });
  bindActionEvents({ applyMaps, exportGlb, importModelForLighting });
  bindFolderImportEvents({ importTextureFolder });
  bindRuleDialogEvents({ refreshTextureMappingPreview });
  bindTextureInputEvents({ refreshTextureMappingPreview, updateTriangulationEstimate });
  bindValueDisplays({ bindNumberDisplay });
  bindTriangulationEvents({ updateTriangulationEstimate });
  bindLightingEvents({ updateMainLightPosition, updateShadowSettings });
}
