import {
  PRESET_STORAGE_KEY,
  modulationFamilies,
  basebandSignals,
  defaultControls,
  scenarioPresets,
  allSchemes,
  SAMPLE_RATE,
} from './config.js';
import { renderLatexInto, clamp, formatHz, linspace, normalize, nowStamp } from './utils.js';
import { generateAnalog, generateDigital, randomBits, computeBitErrorRate, computeSymbolErrorRate, computeCorrelation } from './signal.js';
import { renderPlots } from './render.js';
import { exportCurrentCsv, exportCurrentPng } from './ui-exports.js';
import { initGsapAnimations } from './ui-animations.js';

const elementIdByKey = {
  family: "family",
  scheme: "scheme",
  baseband: "baseband",
  carrierFreq: "carrierFreq",
  messageFreq: "messageFreq",
  carrierAmp: "carrierAmp",
  messageAmp: "messageAmp",
  modIndex: "modIndex",
  freqDev: "freqDev",
  bitRate: "bitRate",
  duration: "duration",
  snrDb: "snrDb",
  fadingDepth: "fadingDepth",
  rxCarrierOffset: "rxCarrierOffset",
  rxPhaseOffset: "rxPhaseOffset",
  receiverModel: "receiverModel",
  timingRecovery: "timingRecovery",
  compareMode: "compareMode",
  compareScheme: "compareScheme",
  presetName: "presetName",
  savedPresetSelect: "savedPresetSelect",
  refresh: "refresh",
  resetDefaults: "resetDefaults",
  savePreset: "savePreset",
  loadPreset: "loadPreset",
  deletePreset: "deletePreset",
  exportCsv: "exportCsv",
  exportPng: "exportPng",
  starterPresetBtn: "starterPresetBtn",
  basebandEq: "basebandEq",
  modEq: "modEq",
  demodEq: "demodEq",
  compareModEq: "compareModEq",
  compareDemodEq: "compareDemodEq",
  primaryMetrics: "primaryMetrics",
  compareMetrics: "compareMetrics",
  taxonomy: "taxonomy",
  atlas: "atlas",
  plotLegend: "plotLegend",
  statusText: "statusText",
  bandwidthEstimate: "bandwidthEstimate",
  constellationPanel: "constellationPanel",
  basebandCanvas: "basebandCanvas",
  modulatedCanvas: "modulatedCanvas",
  demodulatedCanvas: "demodulatedCanvas",
  spectrumCanvas: "spectrumCanvas",
  constellationCanvas: "constellationCanvas",
};

const els = new Proxy({}, {
  get(_target, prop) {
    const key = typeof prop === 'string' ? prop : '';
    const id = elementIdByKey[key];
    return id ? document.getElementById(id) : undefined;
  },
});

let eventsBound = false;

let savedPresets = {};
let lastRenderData = null;
let renderFrameId = null;

function storageErrorMessage(err) {
  if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
    return "Storage limit exceeded. Delete an old preset and try again.";
  }
  return "Unable to save preset data in local storage.";
}

function getScenarioButtons() {
  return Array.from(document.querySelectorAll(".scenario-btn"));
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
  if (typeof gsap !== "undefined") {
    gsap.fromTo(els.statusText,
      { boxShadow: "0 0 0 0 rgba(0,255,156,0.22)" },
      { boxShadow: "0 0 14px 2px rgba(0,255,156,0.22)", duration: 0.3, yoyo: true, repeat: 1, ease: "power2.out" }
    );
  }
}

export function buildSelectors() {
  els.family.innerHTML = "";
  modulationFamilies.forEach((family) => {
    const option = document.createElement("option");
    option.value = family.id;
    option.textContent = family.name;
    els.family.appendChild(option);
  });

  els.baseband.innerHTML = "";
  basebandSignals.forEach((baseband) => {
    const option = document.createElement("option");
    option.value = baseband.id;
    option.textContent = baseband.label;
    els.baseband.appendChild(option);
  });

  populateCompareSelector();
}

export function populateSchemeSelector(selectedSchemeId) {
  const family = modulationFamilies.find((item) => item.id === els.family.value);
  if (!family) return;

  els.scheme.innerHTML = "";
  family.schemes.forEach((scheme) => {
    const option = document.createElement("option");
    option.value = scheme.id;
    option.textContent = scheme.label;
    els.scheme.appendChild(option);
  });

  const hasSelected = family.schemes.some((scheme) => scheme.id === selectedSchemeId);
  els.scheme.value = hasSelected ? selectedSchemeId : family.schemes[0].id;
}

export function populateCompareSelector() {
  const previous = els.compareScheme.value;
  els.compareScheme.innerHTML = "";

  allSchemes.forEach((scheme) => {
    const option = document.createElement("option");
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
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    savedPresets = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    savedPresets = {};
  }
}

export function persistPresets() {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export function refreshPresetDropdown() {
  const names = Object.keys(savedPresets).sort();
  els.savedPresetSelect.innerHTML = "";
  if (!names.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No presets saved";
    els.savedPresetSelect.appendChild(option);
    return;
  }

  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.savedPresetSelect.appendChild(option);
  });
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
  setControlValue("carrierFreq", merged.carrierFreq);
  setControlValue("messageFreq", merged.messageFreq);
  setControlValue("carrierAmp", merged.carrierAmp);
  setControlValue("messageAmp", merged.messageAmp);
  setControlValue("modIndex", merged.modIndex);
  setControlValue("freqDev", merged.freqDev);
  setControlValue("bitRate", merged.bitRate);
  setControlValue("duration", merged.duration);
  setControlValue("snrDb", merged.snrDb);
  setControlValue("fadingDepth", merged.fadingDepth);
  setControlValue("rxCarrierOffset", merged.rxCarrierOffset);
  setControlValue("rxPhaseOffset", merged.rxPhaseOffset);
  els.receiverModel.value = merged.receiverModel;
  els.timingRecovery.checked = !!merged.timingRecovery;
  els.compareMode.checked = !!merged.compareMode;

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
    setStatus("error", `Scenario ${name} not found.`);
    return;
  }
  applyControlState(scenario, false, levelToBitsMap);
  setStatus("success", `Scenario applied: ${name}`);
}

function saveCurrentPreset() {
  const explicit = els.presetName.value.trim();
  const name = explicit || `preset-${nowStamp()}`;
  const previous = savedPresets[name];
  savedPresets[name] = currentControlState();
  const persistResult = persistPresets();
  if (!persistResult.ok) {
    if (previous === undefined) {
      delete savedPresets[name];
    } else {
      savedPresets[name] = previous;
    }
    setStatus("error", storageErrorMessage(persistResult.error));
    return;
  }
  refreshPresetDropdown();
  els.savedPresetSelect.value = name;
  els.presetName.value = name;
  setStatus("success", `Preset saved: ${name}`);
}

function loadSelectedPreset(levelToBitsMap) {
  const name = els.savedPresetSelect.value;
  if (!name || !savedPresets[name]) {
    setStatus("error", "Select a saved preset first.");
    return;
  }
  applyControlState(savedPresets[name], false, levelToBitsMap);
  els.presetName.value = name;
  setStatus("success", `Preset loaded: ${name}`);
}

function deleteSelectedPreset() {
  const name = els.savedPresetSelect.value;
  if (!name || !savedPresets[name]) {
    setStatus("error", "No preset selected for deletion.");
    return;
  }
  const previous = savedPresets[name];
  delete savedPresets[name];
  const persistResult = persistPresets();
  if (!persistResult.ok) {
    savedPresets[name] = previous;
    setStatus("error", storageErrorMessage(persistResult.error));
    return;
  }
  refreshPresetDropdown();
  els.presetName.value = "";
  setStatus("success", `Preset deleted: ${name}`);
}

function getRenderParams() {
  const carrierFreq = clamp(Number(els.carrierFreq.value), 20, 2200);
  const messageFreq = clamp(Number(els.messageFreq.value), 1, 500);
  const carrierAmp = clamp(Number(els.carrierAmp.value), 0.2, 5);
  const messageAmp = clamp(Number(els.messageAmp.value), 0.1, 5);
  const modIndex = clamp(Number(els.modIndex.value), 0.1, 5);
  const freqDev = clamp(Number(els.freqDev.value), 1, 600);
  const bitRate = clamp(Number(els.bitRate.value), 10, 2000);
  const duration = clamp(Number(els.duration.value), 0.02, 0.4);
  const snrDb = clamp(Number(els.snrDb.value), 0, 60);
  const fadingDepth = clamp(Number(els.fadingDepth.value), 0, 0.95);
  const rxCarrierOffset = clamp(Number(els.rxCarrierOffset.value), -300, 300);
  const rxPhaseOffset = clamp(Number(els.rxPhaseOffset.value), -180, 180);
  const receiverModel = els.receiverModel.value || "manual";
  const timingRecovery = !!els.timingRecovery.checked;

  return {
    carrierFreq,
    messageFreq,
    carrierAmp,
    messageAmp,
    modIndex,
    freqDev,
    bitRate,
    duration,
    receiverFc: carrierFreq + rxCarrierOffset,
    receiverPhase: (rxPhaseOffset * Math.PI) / 180,
    receiverModel,
    timingRecovery,
    channel: {
      snrDb,
      fadingDepth,
    },
  };
}

function getSchemeById(id) {
  return allSchemes.find((scheme) => scheme.id === id);
}

function runScheme(scheme, t, params, basebandDef, sharedBits, levelToBitsMap) {
  if (scheme.digital) {
    return generateDigital(t, params, scheme.id, sharedBits, levelToBitsMap);
  }
  const baseband = t.map((time) => basebandDef.generator(time, params.messageAmp, params.messageFreq));
  return generateAnalog(t, params, scheme.id, baseband);
}

function estimateBandwidthHz(schemeId, params) {
  if (schemeId === "am_dsb_lc" || schemeId === "am_dsb_sc") {
    return 2 * params.messageFreq;
  }
  if (schemeId === "fm") {
    return 2 * (params.freqDev + params.messageFreq);
  }
  if (schemeId === "pm") {
    return 2 * (params.messageFreq * (1 + params.modIndex));
  }
  if (schemeId === "ask" || schemeId === "bpsk") {
    return 2 * params.bitRate;
  }
  if (schemeId === "fsk") {
    return 2 * (params.freqDev + params.bitRate);
  }
  if (schemeId === "qpsk") {
    return Math.max(1, params.bitRate);
  }
  if (schemeId === "qam16") {
    return Math.max(1, params.bitRate / 2);
  }
  return params.messageFreq;
}

function formatMetricText(result, scheme) {
  if (scheme.digital) {
    const ber = computeBitErrorRate(result.txBits, result.rxBits);
    const ser = computeSymbolErrorRate(result.txSymbols, result.rxSymbols);
    return `BER ${ber.rate.toFixed(4)} (${ber.errors}/${ber.total}), SER ${ser.rate.toFixed(4)} (${ser.errors}/${ser.total})`;
  }

  const corr = computeCorrelation(normalize(result.baseband), normalize(result.demodulated));
  return `Correlation(baseband, demod): ${corr.toFixed(4)}`;
}

export function render(levelToBitsMap) {
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId);
  }
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    performRender(levelToBitsMap);
  });
}

function performRender(levelToBitsMap) {
  try {
    const primaryScheme = getSchemeById(els.scheme.value);
    if (!primaryScheme) return;

    const params = getRenderParams();
    const t = linspace(params.duration, SAMPLE_RATE);
    const basebandDef = basebandSignals.find((b) => b.id === els.baseband.value) || basebandSignals[0];

    const compareActive = els.compareMode.checked;
    els.compareScheme.disabled = !compareActive;
    const compareScheme = compareActive ? getSchemeById(els.compareScheme.value) : null;

    const needSharedBits = primaryScheme.digital || compareScheme?.digital;
    const sharedBits = needSharedBits ? randomBits(10000) : null;

    const primary = runScheme(primaryScheme, t, params, basebandDef, sharedBits, levelToBitsMap);
    const compare = compareScheme ? runScheme(compareScheme, t, params, basebandDef, sharedBits, levelToBitsMap) : null;

    const digitalBasebandEq = "m(t) = \\sum_k b(k) p(t-kT_b), \\quad b(k) \\in \\{0,1\\}";
    if (primaryScheme.digital) {
      renderLatexInto(els.basebandEq, digitalBasebandEq);
    } else {
      renderLatexInto(els.basebandEq, basebandDef.equation);
    }
    renderLatexInto(els.modEq, primaryScheme.modulationEq);
    renderLatexInto(els.demodEq, primaryScheme.demodEq);
    if (compareScheme) {
      renderLatexInto(els.compareModEq, compareScheme.modulationEq);
      renderLatexInto(els.compareDemodEq, compareScheme.demodEq);
    } else {
      els.compareModEq.textContent = "N/A";
      els.compareDemodEq.textContent = "N/A";
    }

    els.primaryMetrics.textContent = formatMetricText(primary, primaryScheme);
    els.compareMetrics.textContent = compareScheme
      ? formatMetricText(compare, compareScheme)
      : "Comparison disabled";

    const bwPrimary = estimateBandwidthHz(primaryScheme.id, params);
    let bwText = `Estimated Occupied BW: Primary ${formatHz(bwPrimary)}`;
    if (compareScheme) {
      const bwCompare = estimateBandwidthHz(compareScheme.id, params);
      bwText += ` | Compare ${formatHz(bwCompare)}`;
    }
    els.bandwidthEstimate.textContent = bwText;

    renderLegend(compareActive, primaryScheme, compareScheme);

    const hasConstellation = renderPlots(
      {
        basebandCanvas: els.basebandCanvas,
        modulatedCanvas: els.modulatedCanvas,
        demodulatedCanvas: els.demodulatedCanvas,
        spectrumCanvas: els.spectrumCanvas,
        constellationCanvas: els.constellationCanvas,
      },
      { primary, compare },
      primaryScheme,
      compareScheme,
    );

    els.constellationPanel.style.display = hasConstellation ? "block" : "none";

    lastRenderData = {
      time: t,
      primary,
      compare,
      primaryScheme,
      compareScheme,
      params,
    };

    setStatus("success", "Simulation updated.");
  } catch (err) {
    setStatus("error", `Render failed: ${err.message}`);
  }
}

export function bindEvents(levelToBitsMap) {
  if (eventsBound) return;
  eventsBound = true;

  els.family.addEventListener("change", () => {
    populateSchemeSelector();
    render(levelToBitsMap);
  });

  els.scheme.addEventListener("change", () => render(levelToBitsMap));
  els.baseband.addEventListener("change", () => render(levelToBitsMap));
  els.receiverModel.addEventListener("change", () => render(levelToBitsMap));
  els.timingRecovery.addEventListener("change", () => render(levelToBitsMap));
  els.compareMode.addEventListener("change", () => render(levelToBitsMap));
  els.compareScheme.addEventListener("change", () => render(levelToBitsMap));

  let debounceTimer = null;
  const debouncedRender = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(levelToBitsMap), 60);
  };

  [
    "carrierFreq",
    "messageFreq",
    "carrierAmp",
    "messageAmp",
    "modIndex",
    "freqDev",
    "bitRate",
    "duration",
    "snrDb",
    "fadingDepth",
    "rxCarrierOffset",
    "rxPhaseOffset",
  ].forEach((id) => {
    els[id].addEventListener("input", debouncedRender);
  });

  els.refresh.addEventListener("click", () => render(levelToBitsMap));

  els.resetDefaults.addEventListener("click", () => {
    applyControlState(defaultControls, false, levelToBitsMap);
    setStatus("success", "Reset to defaults.");
  });

  els.savePreset.addEventListener("click", saveCurrentPreset);
  els.loadPreset.addEventListener("click", () => loadSelectedPreset(levelToBitsMap));
  els.deletePreset.addEventListener("click", deleteSelectedPreset);

  els.savedPresetSelect.addEventListener("change", () => {
    const name = els.savedPresetSelect.value;
    els.presetName.value = name;
  });

  els.presetName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveCurrentPreset();
    }
  });

  els.exportCsv.addEventListener('click', () => exportCurrentCsv(lastRenderData, setStatus));
  els.exportPng.addEventListener('click', () => exportCurrentPng(lastRenderData, els, setStatus));

  els.starterPresetBtn.addEventListener("click", () => {
    applyScenario("offsetQpsk", levelToBitsMap);
  });

  getScenarioButtons().forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(button.dataset.scenario, levelToBitsMap);
    });
  });
}

export { els, initGsapAnimations };
