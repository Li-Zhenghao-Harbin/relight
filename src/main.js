import './style.css';
import { createAppLayout } from './app/layout.js';
import { initializeBindings } from './app/bindings.js';
import { DEFAULT_MODE } from './app/modeConfig.js';
import { createSceneController } from './core/scene.js';
import { createAppState } from './core/state.js';
import { createUiController } from './core/ui.js';
import { createModelPipeline } from './features/modelPipeline.js';

document.querySelector('#app').innerHTML = createAppLayout();

const state = createAppState();
const sceneController = createSceneController({ viewer: document.getElementById('viewer') });
const uiController = createUiController({
  state,
  statusEl: document.getElementById('status'),
  stepLogEl: document.getElementById('stepLog')
});
const modelPipeline = createModelPipeline({
  state,
  sceneController,
  uiController
});

const { bindNumberDisplay, setUiMode } = uiController;
const { updateMainLightPosition, updateRendererSize, renderFrame } = sceneController;
const {
  applyMaps,
  importModelForLighting,
  exportGlb,
  updateShadowSettings,
  importTextureFolder,
  refreshTextureMappingPreview
} = modelPipeline;

initializeBindings({
  setUiMode,
  bindNumberDisplay,
  applyMaps,
  exportGlb,
  importModelForLighting,
  importTextureFolder,
  refreshTextureMappingPreview,
  updateMainLightPosition,
  updateShadowSettings
});

refreshTextureMappingPreview();
updateMainLightPosition();
updateShadowSettings();
setUiMode(DEFAULT_MODE);

window.addEventListener('resize', updateRendererSize);
updateRendererSize();
sceneController.renderer.setAnimationLoop(renderFrame);
