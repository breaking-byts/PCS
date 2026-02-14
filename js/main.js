import { levelToBitsMap, defaultControls } from './config.js';
import {
  buildSelectors,
  renderTaxonomy,
  renderAtlas,
  loadPresetsFromStorage,
  refreshPresetDropdown,
  applyControlState,
  bindEvents,
  render,
  ensureUiElements,
  initGsapAnimations,
} from './ui.js';

function init() {
  ensureUiElements();
  buildSelectors();
  renderTaxonomy();
  renderAtlas();
  loadPresetsFromStorage();
  refreshPresetDropdown();
  applyControlState(defaultControls, true, levelToBitsMap);
  bindEvents(levelToBitsMap);
  render(levelToBitsMap);
  initGsapAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
