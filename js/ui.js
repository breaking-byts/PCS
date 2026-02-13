import {
  PRESET_STORAGE_KEY,
  modulationFamilies,
  basebandSignals,
  defaultControls,
  scenarioPresets,
  colors,
  allSchemes,
  SAMPLE_RATE,
} from './config.js';
import { renderLatex, clamp, formatHz, nowStamp, linspace, normalize } from './utils.js';
import { generateAnalog, generateDigital, randomBits, computeBitErrorRate, computeSymbolErrorRate, computeCorrelation } from './signal.js';
import { renderPlots } from './render.js';

const els = {
  family: document.getElementById("family"),
  scheme: document.getElementById("scheme"),
  baseband: document.getElementById("baseband"),
  carrierFreq: document.getElementById("carrierFreq"),
  messageFreq: document.getElementById("messageFreq"),
  carrierAmp: document.getElementById("carrierAmp"),
  messageAmp: document.getElementById("messageAmp"),
  modIndex: document.getElementById("modIndex"),
  freqDev: document.getElementById("freqDev"),
  bitRate: document.getElementById("bitRate"),
  duration: document.getElementById("duration"),
  snrDb: document.getElementById("snrDb"),
  fadingDepth: document.getElementById("fadingDepth"),
  rxCarrierOffset: document.getElementById("rxCarrierOffset"),
  rxPhaseOffset: document.getElementById("rxPhaseOffset"),
  receiverModel: document.getElementById("receiverModel"),
  timingRecovery: document.getElementById("timingRecovery"),
  compareMode: document.getElementById("compareMode"),
  compareScheme: document.getElementById("compareScheme"),
  presetName: document.getElementById("presetName"),
  savedPresetSelect: document.getElementById("savedPresetSelect"),
  refresh: document.getElementById("refresh"),
  resetDefaults: document.getElementById("resetDefaults"),
  savePreset: document.getElementById("savePreset"),
  loadPreset: document.getElementById("loadPreset"),
  deletePreset: document.getElementById("deletePreset"),
  exportCsv: document.getElementById("exportCsv"),
  exportPng: document.getElementById("exportPng"),
  starterPresetBtn: document.getElementById("starterPresetBtn"),
  basebandEq: document.getElementById("basebandEq"),
  modEq: document.getElementById("modEq"),
  demodEq: document.getElementById("demodEq"),
  compareModEq: document.getElementById("compareModEq"),
  compareDemodEq: document.getElementById("compareDemodEq"),
  primaryMetrics: document.getElementById("primaryMetrics"),
  compareMetrics: document.getElementById("compareMetrics"),
  taxonomy: document.getElementById("taxonomy"),
  atlas: document.getElementById("atlas"),
  plotLegend: document.getElementById("plotLegend"),
  statusText: document.getElementById("statusText"),
  bandwidthEstimate: document.getElementById("bandwidthEstimate"),
  constellationPanel: document.getElementById("constellationPanel"),
  basebandCanvas: document.getElementById("basebandCanvas"),
  modulatedCanvas: document.getElementById("modulatedCanvas"),
  demodulatedCanvas: document.getElementById("demodulatedCanvas"),
  spectrumCanvas: document.getElementById("spectrumCanvas"),
  constellationCanvas: document.getElementById("constellationCanvas"),
};

const scenarioButtons = Array.from(document.querySelectorAll(".scenario-btn"));

let savedPresets = {};
let lastRenderData = null;
let renderFrameId = null;

export function setStatus(type, message) {
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
  els.taxonomy.innerHTML = modulationFamilies
    .map(
      (family) =>
        `<div class="taxonomy-row"><strong>${family.name}</strong>${family.schemes
          .map((scheme) => scheme.label)
          .join(" • ")}</div>`,
    )
    .join("");
}

export function renderAtlas() {
  els.atlas.innerHTML = modulationFamilies
    .map(
      (family) => `
      <article class="atlas-card">
        <h3>${family.name}</h3>
        <ul>
          ${family.schemes
          .map(
            (scheme) =>
              `<li><strong>${scheme.label}</strong><span class="eq">${renderLatex(scheme.modulationEq)}</span><span class="eq">${renderLatex(scheme.demodEq)}</span></li>`,
          )
          .join("")}
        </ul>
      </article>
    `,
    )
    .join("");
}

export function renderLegend(compareActive, primaryScheme, compareScheme) {
  const items = [
    { color: colors.primaryBase, label: `Primary Baseband (${primaryScheme.label})` },
    { color: colors.primaryRx, label: `Primary Received (${primaryScheme.label})` },
    { color: colors.primaryDemod, label: `Primary Demod (${primaryScheme.label})` },
    { color: colors.spectrumPrimary, label: `Primary Spectrum (${primaryScheme.label})` },
  ];

  if (compareActive && compareScheme) {
    items.push({ color: colors.compareBase, label: `Compare Baseband (${compareScheme.label})` });
    items.push({ color: colors.compareRx, label: `Compare Received (${compareScheme.label})` });
    items.push({ color: colors.compareDemod, label: `Compare Demod (${compareScheme.label})` });
    items.push({ color: colors.spectrumCompare, label: `Compare Spectrum (${compareScheme.label})` });
  }

  if (primaryScheme.digital) {
    items.push({ color: colors.constellationPrimary, label: `Primary Constellation (${primaryScheme.label})` });
  }
  if (compareActive && compareScheme?.digital) {
    items.push({ color: colors.constellationCompare, label: `Compare Constellation (${compareScheme.label})` });
  }

  els.plotLegend.innerHTML = items
    .map(
      (item) =>
        `<span class="legend-chip"><span class="legend-dot" style="background:${item.color}"></span>${item.label}</span>`,
    )
    .join("");
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
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
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
  savedPresets[name] = currentControlState();
  persistPresets();
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
  delete savedPresets[name];
  persistPresets();
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

function exportCurrentCsv() {
  if (!lastRenderData) {
    setStatus("error", "Nothing to export yet. Run a simulation first.");
    return;
  }

  const { time, primary, compare } = lastRenderData;
  const headers = [
    "time_s",
    "primary_baseband",
    "primary_rx",
    "primary_demod",
    "compare_baseband",
    "compare_rx",
    "compare_demod",
  ];

  const rows = [headers.join(",")];
  for (let i = 0; i < time.length; i += 1) {
    const row = [
      time[i],
      primary.baseband[i] ?? "",
      primary.rxSignal[i] ?? "",
      primary.demodulated[i] ?? "",
      compare ? compare.baseband[i] ?? "" : "",
      compare ? compare.rxSignal[i] ?? "" : "",
      compare ? compare.demodulated[i] ?? "" : "",
    ];
    rows.push(row.join(","));
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `modulation-signals-${nowStamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("success", "CSV exported.");
}

function exportCurrentPng() {
  if (!lastRenderData) {
    setStatus("error", "Nothing to export yet. Run a simulation first.");
    return;
  }

  const blocks = [
    { title: "Baseband", canvas: els.basebandCanvas },
    { title: "Received", canvas: els.modulatedCanvas },
    { title: "Demodulated", canvas: els.demodulatedCanvas },
    { title: "Spectrum", canvas: els.spectrumCanvas },
  ];

  if (els.constellationPanel.style.display !== "none") {
    blocks.push({ title: "Constellation", canvas: els.constellationCanvas });
  }

  const cols = 2;
  const rows = Math.ceil(blocks.length / cols);
  const tileW = 760;
  const tileH = 310;
  const pad = 20;
  const header = 70;

  const out = document.createElement("canvas");
  out.width = cols * tileW + (cols + 1) * pad;
  out.height = header + rows * tileH + (rows + 1) * pad;
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = "#102446";
  ctx.font = "600 28px Space Grotesk, sans-serif";
  ctx.fillText("Modulation Studio Export", pad, 38);
  ctx.fillStyle = "#4f5e7f";
  ctx.font = "15px IBM Plex Sans, sans-serif";
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, pad, 60);

  blocks.forEach((block, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = pad + col * (tileW + pad);
    const y = header + pad + row * (tileH + pad);

    ctx.fillStyle = "#f7faff";
    ctx.fillRect(x, y, tileW, tileH);
    ctx.strokeStyle = "#d8e3f6";
    ctx.strokeRect(x, y, tileW, tileH);

    ctx.fillStyle = "#17325f";
    ctx.font = "600 17px Space Grotesk, sans-serif";
    ctx.fillText(block.title, x + 12, y + 24);

    ctx.drawImage(block.canvas, x + 12, y + 36, tileW - 24, tileH - 48);
  });

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `modulation-plots-${nowStamp()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus("success", "PNG exported.");
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
    els.basebandEq.innerHTML = primaryScheme.digital
      ? renderLatex(digitalBasebandEq)
      : renderLatex(basebandDef.equation);
    els.modEq.innerHTML = renderLatex(primaryScheme.modulationEq);
    els.demodEq.innerHTML = renderLatex(primaryScheme.demodEq);
    els.compareModEq.innerHTML = compareScheme ? renderLatex(compareScheme.modulationEq) : "N/A";
    els.compareDemodEq.innerHTML = compareScheme ? renderLatex(compareScheme.demodEq) : "N/A";

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

  els.exportCsv.addEventListener("click", exportCurrentCsv);
  els.exportPng.addEventListener("click", exportCurrentPng);

  els.starterPresetBtn.addEventListener("click", () => {
    applyScenario("offsetQpsk", levelToBitsMap);
  });

  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(button.dataset.scenario, levelToBitsMap);
    });
  });
}

export function initGsapAnimations() {
  if (typeof gsap !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);

    const sections = document.querySelectorAll("[data-section]");
    gsap.to(sections, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: "power2.out",
      delay: 0.1
    });

    const heroH1 = document.querySelector(".hero-copy h1");
    if (heroH1) {
      const glitchTL = gsap.timeline({ delay: 0.8 });
      glitchTL
        .to(heroH1, { x: -2, y: 1, textShadow: "2px 0 #ff003c, -2px 0 #00fff2", duration: 0.08, ease: "power4.in" })
        .to(heroH1, { x: 2, y: -1, textShadow: "-2px 0 #ff003c, 2px 0 #00fff2", duration: 0.08, ease: "power4.out" })
        .to(heroH1, { x: -1, y: 2, duration: 0.06, ease: "none" })
        .to(heroH1, { x: 0, y: 0, textShadow: "none", duration: 0.1, ease: "power2.out" });
    }

    sections.forEach((el) => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: () => {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
        }
      });
    });
  }

  window.addEventListener("scroll", () => {
    document.body.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });
}

export { els };
