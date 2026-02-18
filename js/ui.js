import {
  modulationFamilies,
  basebandSignals,
  defaultControls,
  scenarioPresets,
  allSchemes,
} from './config.js';
import { renderLatexInto } from './utils.js';
import { exportCurrentCsv, exportCurrentPng } from './ui-exports.js';
import { initGsapAnimations } from './ui-animations.js';
import { trackFunctionalEvent } from './analytics.js';
import {
  loadPresetsFromStorage as loadPresetsFromStorageStore,
  persistPresets as persistPresetsStore,
  refreshPresetDropdown as refreshPresetDropdownStore,
  saveCurrentPreset as saveCurrentPresetStore,
  loadSelectedPreset as loadSelectedPresetStore,
  deleteSelectedPreset as deleteSelectedPresetStore,
} from './ui-presets.js';
import { createRenderController } from './ui-render-controller.js';

const elementIdByKey = {
  family: 'family',
  scheme: 'scheme',
  baseband: 'baseband',
  carrierFreq: 'carrierFreq',
  messageFreq: 'messageFreq',
  carrierAmp: 'carrierAmp',
  messageAmp: 'messageAmp',
  modIndex: 'modIndex',
  freqDev: 'freqDev',
  bitRate: 'bitRate',
  duration: 'duration',
  snrDb: 'snrDb',
  fadingDepth: 'fadingDepth',
  rxCarrierOffset: 'rxCarrierOffset',
  rxPhaseOffset: 'rxPhaseOffset',
  receiverModel: 'receiverModel',
  timingRecovery: 'timingRecovery',
  compareMode: 'compareMode',
  compareScheme: 'compareScheme',
  deterministicMode: 'deterministicMode',
  rngSeed: 'rngSeed',
  presetName: 'presetName',
  savedPresetSelect: 'savedPresetSelect',
  refresh: 'refresh',
  resetDefaults: 'resetDefaults',
  savePreset: 'savePreset',
  loadPreset: 'loadPreset',
  deletePreset: 'deletePreset',
  exportCsv: 'exportCsv',
  exportPng: 'exportPng',
  starterPresetBtn: 'starterPresetBtn',
  basebandEq: 'basebandEq',
  modEq: 'modEq',
  demodEq: 'demodEq',
  compareModEq: 'compareModEq',
  compareDemodEq: 'compareDemodEq',
  primaryMetrics: 'primaryMetrics',
  compareMetrics: 'compareMetrics',
  taxonomy: 'taxonomy',
  atlas: 'atlas',
  plotLegend: 'plotLegend',
  statusText: 'statusText',
  bandwidthEstimate: 'bandwidthEstimate',
  constellationPanel: 'constellationPanel',
  basebandCanvas: 'basebandCanvas',
  modulatedCanvas: 'modulatedCanvas',
  demodulatedCanvas: 'demodulatedCanvas',
  spectrumCanvas: 'spectrumCanvas',
  constellationCanvas: 'constellationCanvas',
};

const els = new Proxy({}, {
  get(_target, prop) {
    const key = typeof prop === 'string' ? prop : '';
    const id = elementIdByKey[key];
    return id ? document.getElementById(id) : undefined;
  },
});

let eventsBound = false;
let renderController = null;

function getScenarioButtons() {
  return Array.from(document.querySelectorAll('.scenario-btn'));
}

function ensureRenderController() {
  if (!renderController) {
    renderController = createRenderController({
      els,
      setStatus,
      renderLegend,
    });
  }
  return renderController;
}

export function ensureUiElements() {
  const missing = Object.entries(elementIdByKey)
    .filter(([, id]) => !document.getElementById(id))
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing required UI elements: ${missing.join(', ')}`);
  }
}

export function setStatus(type, message) {
  if (!els.statusText) return;
  els.statusText.className = `status ${type}`;
  els.statusText.textContent = message;
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(
      els.statusText,
      { boxShadow: '0 0 0 0 rgba(0,255,156,0.22)' },
      {
        boxShadow: '0 0 14px 2px rgba(0,255,156,0.22)',
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      },
    );
  }
}

export function buildSelectors() {
  els.family.innerHTML = '';
  modulationFamilies.forEach((family) => {
    const option = document.createElement('option');
    option.value = family.id;
    option.textContent = family.name;
    els.family.appendChild(option);
  });

  els.baseband.innerHTML = '';
  basebandSignals.forEach((baseband) => {
    const option = document.createElement('option');
    option.value = baseband.id;
    option.textContent = baseband.label;
    els.baseband.appendChild(option);
  });

  populateCompareSelector();
}

export function populateSchemeSelector(selectedSchemeId) {
  const family = modulationFamilies.find((item) => item.id === els.family.value);
  if (!family) return;

  els.scheme.innerHTML = '';
  family.schemes.forEach((scheme) => {
    const option = document.createElement('option');
    option.value = scheme.id;
    option.textContent = scheme.label;
    els.scheme.appendChild(option);
  });

  const hasSelected = family.schemes.some((scheme) => scheme.id === selectedSchemeId);
  els.scheme.value = hasSelected ? selectedSchemeId : family.schemes[0].id;
}

export function populateCompareSelector() {
  const previous = els.compareScheme.value;
  els.compareScheme.innerHTML = '';

  allSchemes.forEach((scheme) => {
    const option = document.createElement('option');
    option.value = scheme.id;
    option.textContent = `${scheme.familyName} - ${scheme.label}`;
    els.compareScheme.appendChild(option);
  });

  els.compareScheme.value =
    allSchemes.some((scheme) => scheme.id === previous) ? previous : defaultControls.compareScheme;
}

export function renderTaxonomy() {
  els.taxonomy.replaceChildren();

  modulationFamilies.forEach((family) => {
    const row = document.createElement('div');
    row.className = 'taxonomy-row';

    const title = document.createElement('strong');
    title.textContent = family.name;
    row.appendChild(title);
    row.appendChild(document.createTextNode(family.schemes.map((scheme) => scheme.label).join(' • ')));

    els.taxonomy.appendChild(row);
  });
}

export function renderAtlas() {
  els.atlas.replaceChildren();

  modulationFamilies.forEach((family) => {
    const card = document.createElement('article');
    card.className = 'atlas-card';

    const heading = document.createElement('h3');
    heading.textContent = family.name;
    card.appendChild(heading);

    const list = document.createElement('ul');
    family.schemes.forEach((scheme) => {
      const item = document.createElement('li');

      const strong = document.createElement('strong');
      strong.textContent = scheme.label;
      item.appendChild(strong);

      const modEq = document.createElement('span');
      modEq.className = 'eq';
      renderLatexInto(modEq, scheme.modulationEq);
      item.appendChild(modEq);

      const demodEq = document.createElement('span');
      demodEq.className = 'eq';
      renderLatexInto(demodEq, scheme.demodEq);
      item.appendChild(demodEq);

      list.appendChild(item);
    });

    card.appendChild(list);
    els.atlas.appendChild(card);
  });
}

export function renderLegend(compareActive, primaryScheme, compareScheme) {
  const items = [
    { token: 'primary-base', label: `Primary Baseband (${primaryScheme.label})` },
    { token: 'primary-rx', label: `Primary Received (${primaryScheme.label})` },
    { token: 'primary-demod', label: `Primary Demod (${primaryScheme.label})` },
    { token: 'spectrum-primary', label: `Primary Spectrum (${primaryScheme.label})` },
  ];

  if (compareActive && compareScheme) {
    items.push({ token: 'compare-base', label: `Compare Baseband (${compareScheme.label})` });
    items.push({ token: 'compare-rx', label: `Compare Received (${compareScheme.label})` });
    items.push({ token: 'compare-demod', label: `Compare Demod (${compareScheme.label})` });
    items.push({ token: 'spectrum-compare', label: `Compare Spectrum (${compareScheme.label})` });
  }

  if (primaryScheme.digital) {
    items.push({ token: 'constellation-primary', label: `Primary Constellation (${primaryScheme.label})` });
  }
  if (compareActive && compareScheme?.digital) {
    items.push({ token: 'constellation-compare', label: `Compare Constellation (${compareScheme.label})` });
  }

  els.plotLegend.replaceChildren();
  items.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'legend-chip';

    const dot = document.createElement('span');
    dot.className = `legend-dot legend-dot--${item.token}`;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(item.label));

    els.plotLegend.appendChild(chip);
  });
}

export function loadPresetsFromStorage() {
  loadPresetsFromStorageStore();
}

export function persistPresets() {
  return persistPresetsStore();
}

export function refreshPresetDropdown() {
  refreshPresetDropdownStore(els);
}

function schemeToFamily(schemeId) {
  const scheme = allSchemes.find((item) => item.id === schemeId);
  return scheme ? scheme.familyId : defaultControls.family;
}

export function currentControlState() {
  return {
    family: els.family.value,
    scheme: els.scheme.value,
    baseband: els.baseband.value,
    carrierFreq: Number(els.carrierFreq.value),
    messageFreq: Number(els.messageFreq.value),
    carrierAmp: Number(els.carrierAmp.value),
    messageAmp: Number(els.messageAmp.value),
    modIndex: Number(els.modIndex.value),
    freqDev: Number(els.freqDev.value),
    bitRate: Number(els.bitRate.value),
    duration: Number(els.duration.value),
    snrDb: Number(els.snrDb.value),
    fadingDepth: Number(els.fadingDepth.value),
    rxCarrierOffset: Number(els.rxCarrierOffset.value),
    rxPhaseOffset: Number(els.rxPhaseOffset.value),
    receiverModel: els.receiverModel.value,
    timingRecovery: !!els.timingRecovery.checked,
    compareMode: !!els.compareMode.checked,
    compareScheme: els.compareScheme.value,
    deterministicMode: !!els.deterministicMode.checked,
    rngSeed: Number(els.rngSeed.value),
  };
}

function setControlValue(id, value) {
  if (value === undefined || value === null) return;
  if (!els[id]) return;
  els[id].value = String(value);
}

export function applyControlState(state, skipRender = false, levelToBitsMap) {
  const merged = { ...defaultControls, ...state };
  const family = merged.family || schemeToFamily(merged.scheme);
  els.family.value = family;
  populateSchemeSelector(merged.scheme);

  els.baseband.value = merged.baseband;
  setControlValue('carrierFreq', merged.carrierFreq);
  setControlValue('messageFreq', merged.messageFreq);
  setControlValue('carrierAmp', merged.carrierAmp);
  setControlValue('messageAmp', merged.messageAmp);
  setControlValue('modIndex', merged.modIndex);
  setControlValue('freqDev', merged.freqDev);
  setControlValue('bitRate', merged.bitRate);
  setControlValue('duration', merged.duration);
  setControlValue('snrDb', merged.snrDb);
  setControlValue('fadingDepth', merged.fadingDepth);
  setControlValue('rxCarrierOffset', merged.rxCarrierOffset);
  setControlValue('rxPhaseOffset', merged.rxPhaseOffset);
  els.receiverModel.value = merged.receiverModel;
  els.timingRecovery.checked = !!merged.timingRecovery;
  els.compareMode.checked = !!merged.compareMode;
  els.deterministicMode.checked = !!merged.deterministicMode;
  setControlValue('rngSeed', merged.rngSeed ?? 12345);

  populateCompareSelector();
  if (merged.compareScheme) {
    els.compareScheme.value = merged.compareScheme;
  }

  els.compareScheme.disabled = !els.compareMode.checked;

  if (!skipRender) {
    render(levelToBitsMap);
  }
}

export function applyScenario(name, levelToBitsMap) {
  const scenario = scenarioPresets[name];
  if (!scenario) {
    setStatus('error', `Scenario ${name} not found.`);
    return;
  }
  applyControlState(scenario, false, levelToBitsMap);
  setStatus('success', `Scenario applied: ${name}`);
  trackFunctionalEvent('scenario_applied', { scenario: name });
}

function saveCurrentPreset() {
  saveCurrentPresetStore(
    els,
    currentControlState,
    setStatus,
    (presetName) => trackFunctionalEvent('preset_saved', { presetName }),
  );
}

function loadSelectedPreset(levelToBitsMap) {
  loadSelectedPresetStore(els, applyControlState, setStatus, levelToBitsMap);
}

function deleteSelectedPreset() {
  deleteSelectedPresetStore(els, setStatus);
}

export function render(levelToBitsMap) {
  ensureRenderController().render(levelToBitsMap);
}

export function bindEvents(levelToBitsMap) {
  if (eventsBound) return;
  eventsBound = true;

  els.family.addEventListener('change', () => {
    populateSchemeSelector();
    render(levelToBitsMap);
  });

  els.scheme.addEventListener('change', () => render(levelToBitsMap));
  els.baseband.addEventListener('change', () => render(levelToBitsMap));
  els.receiverModel.addEventListener('change', () => render(levelToBitsMap));
  els.timingRecovery.addEventListener('change', () => render(levelToBitsMap));
  els.compareMode.addEventListener('change', () => render(levelToBitsMap));
  els.compareScheme.addEventListener('change', () => render(levelToBitsMap));
  els.deterministicMode.addEventListener('change', () => render(levelToBitsMap));
  els.rngSeed.addEventListener('input', () => {
    if (els.deterministicMode.checked) {
      render(levelToBitsMap);
    }
  });

  let debounceTimer = null;
  const debouncedRender = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(levelToBitsMap), 60);
  };

  [
    'carrierFreq',
    'messageFreq',
    'carrierAmp',
    'messageAmp',
    'modIndex',
    'freqDev',
    'bitRate',
    'duration',
    'snrDb',
    'fadingDepth',
    'rxCarrierOffset',
    'rxPhaseOffset',
  ].forEach((id) => {
    els[id].addEventListener('input', debouncedRender);
  });

  els.refresh.addEventListener('click', () => render(levelToBitsMap));

  els.resetDefaults.addEventListener('click', () => {
    applyControlState(defaultControls, false, levelToBitsMap);
    setStatus('success', 'Reset to defaults.');
  });

  els.savePreset.addEventListener('click', saveCurrentPreset);
  els.loadPreset.addEventListener('click', () => loadSelectedPreset(levelToBitsMap));
  els.deletePreset.addEventListener('click', deleteSelectedPreset);

  els.savedPresetSelect.addEventListener('change', () => {
    const name = els.savedPresetSelect.value;
    els.presetName.value = name;
  });

  els.presetName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCurrentPreset();
    }
  });

  els.exportCsv.addEventListener('click', () => {
    const renderData = ensureRenderController().getLastRenderData();
    exportCurrentCsv(renderData, setStatus);
  });

  els.exportPng.addEventListener('click', () => {
    const renderData = ensureRenderController().getLastRenderData();
    exportCurrentPng(renderData, els, setStatus);
  });

  els.starterPresetBtn.addEventListener('click', () => {
    applyScenario('offsetQpsk', levelToBitsMap);
  });

  getScenarioButtons().forEach((button) => {
    button.addEventListener('click', () => {
      applyScenario(button.dataset.scenario, levelToBitsMap);
    });
  });
}

export { els, initGsapAnimations };
