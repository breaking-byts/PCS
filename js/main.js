import { levelToBitsMap, defaultControls } from './config.js';
import { initAnalytics, trackFunctionalEvent } from './analytics.js';
import { initObservability, reportError } from './observability.js';
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
  try {
    initObservability();
    initAnalytics();
    document.body.classList.add('js');
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
    trackFunctionalEvent('app_loaded', {
      deterministicMode: false,
    });
  } catch (err) {
    reportError(err, { source: 'main.init' });
    throw err;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
