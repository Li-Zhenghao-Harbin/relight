import { MODE_CONFIG } from '../app/modeConfig.js';

export function createUiController({ state, statusEl }) {
  const modeConfigMap = new Map(MODE_CONFIG.map((mode) => [mode.key, mode]));

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
  }

  function setUiMode(mode) {
    if (!modeConfigMap.has(mode)) return;
    state.uiMode = mode;

    const appShell = document.querySelector('.app-shell');
    appShell?.setAttribute('data-mode', mode);

    MODE_CONFIG.forEach((item) => {
      document.getElementById(item.tabButtonId)?.classList.toggle('is-active', mode === item.key);
    });

    const titleEl = document.getElementById('panelLeftTitle');
    const modeConfig = modeConfigMap.get(mode);
    if (titleEl && modeConfig) titleEl.textContent = modeConfig.panelTitle;
  }

  function bindNumberDisplay(inputId, textId, formatter) {
    const input = document.getElementById(inputId);
    const text = document.getElementById(textId);
    const update = () => {
      text.textContent = formatter ? formatter(Number(input.value)) : input.value;
    };
    input.addEventListener('input', update);
    update();
  }

  return {
    setStatus,
    setUiMode,
    bindNumberDisplay
  };
}
