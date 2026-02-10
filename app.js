const SAMPLE_RATE = 8000;
const PRESET_STORAGE_KEY = "modulationStudio.presets.v1";

const modulationFamilies = [
  {
    id: "amplitude",
    name: "Amplitude Modulation",
    schemes: [
      {
        id: "am_dsb_lc",
        label: "AM DSB-LC (Conventional AM)",
        digital: false,
        modulationEq: "s(t) = Ac [1 + mu * m_n(t)] cos(2*pi*fc*t)",
        demodEq: "m_hat(t) ~= LPF{|r(t)|} - DC",
      },
      {
        id: "am_dsb_sc",
        label: "AM DSB-SC",
        digital: false,
        modulationEq: "s(t) = Ac * m_n(t) * cos(2*pi*fc*t)",
        demodEq: "m_hat(t) = LPF{2 r(t) cos(2*pi*frx*t + phi_rx)}",
      },
    ],
  },
  {
    id: "angle",
    name: "Angle Modulation",
    schemes: [
      {
        id: "fm",
        label: "Frequency Modulation (FM)",
        digital: false,
        modulationEq: "s(t) = Ac cos(2*pi*fc*t + 2*pi*kf * integral(m_n(t) dt))",
        demodEq: "m_hat(t) = (f_inst(t) - frx)/kf, f_inst = (1/2*pi) dphi/dt",
      },
      {
        id: "pm",
        label: "Phase Modulation (PM)",
        digital: false,
        modulationEq: "s(t) = Ac cos(2*pi*fc*t + kp * m_n(t))",
        demodEq: "m_hat(t) = (phi(t) - 2*pi*frx*t) / kp",
      },
    ],
  },
  {
    id: "digital",
    name: "Digital Modulation",
    schemes: [
      {
        id: "ask",
        label: "ASK (Binary)",
        digital: true,
        modulationEq: "s(t) = Ac [a0 + a1*b(k)] cos(2*pi*fc*t)",
        demodEq: "b_hat(k) = threshold{integral r(t) cos(2*pi*frx*t + phi_rx) dt}",
      },
      {
        id: "fsk",
        label: "FSK (Binary)",
        digital: true,
        modulationEq: "s(t) = Ac cos(2*pi*f_i*t), f_i in {fc-df, fc+df}",
        demodEq: "b_hat(k) = argmax_i integral r(t) cos(2*pi*f_i_rx*t) dt",
      },
      {
        id: "bpsk",
        label: "BPSK",
        digital: true,
        modulationEq: "s(t) = Ac cos(2*pi*fc*t + pi*(1-b(k)))",
        demodEq: "b_hat(k) = sign{integral r(t) cos(2*pi*frx*t + phi_rx) dt}",
      },
      {
        id: "qpsk",
        label: "QPSK",
        digital: true,
        modulationEq: "s(t) = Ac[I_k cos(2*pi*fc*t) - Q_k sin(2*pi*fc*t)]",
        demodEq: "I_hat,Q_hat from coherent I/Q integrators",
      },
      {
        id: "qam16",
        label: "16-QAM",
        digital: true,
        modulationEq: "s(t) = Ac[I_k cos(2*pi*fc*t) - Q_k sin(2*pi*fc*t)], I,Q in {-3,-1,1,3}",
        demodEq: "Nearest-neighbor symbol decision in I/Q plane",
      },
    ],
  },
];

const basebandSignals = [
  {
    id: "sine",
    label: "Sine Wave",
    equation: "m(t) = Am sin(2*pi*fm*t)",
    generator: (t, am, fm) => am * Math.sin(2 * Math.PI * fm * t),
  },
  {
    id: "square",
    label: "Square Wave",
    equation: "m(t) = Am sgn(sin(2*pi*fm*t))",
    generator: (t, am, fm) => am * (Math.sin(2 * Math.PI * fm * t) >= 0 ? 1 : -1),
  },
  {
    id: "triangle",
    label: "Triangle Wave",
    equation: "m(t) = (2*Am/pi) asin(sin(2*pi*fm*t))",
    generator: (t, am, fm) => (2 * am / Math.PI) * Math.asin(Math.sin(2 * Math.PI * fm * t)),
  },
];

const defaultControls = {
  family: "amplitude",
  scheme: "am_dsb_lc",
  baseband: "sine",
  carrierFreq: 250,
  messageFreq: 20,
  carrierAmp: 1,
  messageAmp: 1,
  modIndex: 0.8,
  freqDev: 60,
  bitRate: 120,
  duration: 0.08,
  snrDb: 24,
  fadingDepth: 0.25,
  rxCarrierOffset: 0,
  rxPhaseOffset: 0,
  compareMode: false,
  compareScheme: "qpsk",
};

const scenarioPresets = {
  cleanAnalog: {
    family: "amplitude",
    scheme: "am_dsb_lc",
    baseband: "sine",
    messageFreq: 20,
    modIndex: 0.6,
    snrDb: 38,
    fadingDepth: 0.05,
    rxCarrierOffset: 0,
    rxPhaseOffset: 0,
    compareMode: false,
  },
  noisyBpsk: {
    family: "digital",
    scheme: "bpsk",
    baseband: "sine",
    carrierFreq: 260,
    bitRate: 180,
    snrDb: 6,
    fadingDepth: 0.35,
    rxCarrierOffset: 5,
    rxPhaseOffset: 8,
    compareMode: true,
    compareScheme: "qpsk",
  },
  offsetQpsk: {
    family: "digital",
    scheme: "qpsk",
    carrierFreq: 280,
    bitRate: 220,
    snrDb: 16,
    fadingDepth: 0.2,
    rxCarrierOffset: 22,
    rxPhaseOffset: 24,
    compareMode: true,
    compareScheme: "qam16",
  },
  wideFm: {
    family: "angle",
    scheme: "fm",
    baseband: "triangle",
    carrierFreq: 330,
    messageFreq: 35,
    freqDev: 180,
    snrDb: 26,
    fadingDepth: 0.12,
    compareMode: true,
    compareScheme: "pm",
  },
};

const colors = {
  primaryBase: "#0f7bff",
  compareBase: "#f97316",
  primaryRx: "#0a8f63",
  compareRx: "#d97706",
  primaryDemod: "#bf5408",
  compareDemod: "#7c3aed",
  spectrumPrimary: "#f97316",
  spectrumCompare: "#0f7bff",
  constellationPrimary: "#0f7bff",
  constellationCompare: "#f97316",
};

const allSchemes = modulationFamilies.flatMap((family) =>
  family.schemes.map((scheme) => ({
    ...scheme,
    familyId: family.id,
    familyName: family.name,
  })),
);

const levelToBitsMap = {
  "-3": [0, 0],
  "-1": [0, 1],
  1: [1, 1],
  3: [1, 0],
};

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

function setStatus(type, message) {
  els.statusText.className = `status ${type}`;
  els.statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatHz(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MHz`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)} kHz`;
  return `${value.toFixed(2)} Hz`;
}

function nowStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function buildSelectors() {
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

function populateSchemeSelector(selectedSchemeId) {
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

function populateCompareSelector() {
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

function renderTaxonomy() {
  els.taxonomy.innerHTML = modulationFamilies
    .map(
      (family) =>
        `<div class="taxonomy-row"><strong>${family.name}</strong>${family.schemes
          .map((scheme) => scheme.label)
          .join(" • ")}</div>`,
    )
    .join("");
}

function renderAtlas() {
  els.atlas.innerHTML = modulationFamilies
    .map(
      (family) => `
      <article class="atlas-card">
        <h3>${family.name}</h3>
        <ul>
          ${family.schemes
            .map(
              (scheme) =>
                `<li><strong>${scheme.label}</strong><span class="eq">${scheme.modulationEq}</span><span class="eq">${scheme.demodEq}</span></li>`,
            )
            .join("")}
        </ul>
      </article>
    `,
    )
    .join("");
}

function renderLegend(compareActive, primaryScheme, compareScheme) {
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

function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    savedPresets = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    savedPresets = {};
  }
}

function persistPresets() {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
}

function refreshPresetDropdown() {
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

function currentControlState() {
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
    compareMode: !!els.compareMode.checked,
    compareScheme: els.compareScheme.value,
  };
}

function setControlValue(id, value) {
  if (value === undefined || value === null) return;
  if (!els[id]) return;
  els[id].value = String(value);
}

function applyControlState(state, skipRender = false) {
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
  els.compareMode.checked = !!merged.compareMode;

  populateCompareSelector();
  if (merged.compareScheme) {
    els.compareScheme.value = merged.compareScheme;
  }

  els.compareScheme.disabled = !els.compareMode.checked;

  if (!skipRender) {
    render();
  }
}

function applyScenario(name) {
  const scenario = scenarioPresets[name];
  if (!scenario) {
    setStatus("error", `Scenario ${name} not found.`);
    return;
  }
  applyControlState(scenario);
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

function loadSelectedPreset() {
  const name = els.savedPresetSelect.value;
  if (!name || !savedPresets[name]) {
    setStatus("error", "Select a saved preset first.");
    return;
  }
  applyControlState(savedPresets[name]);
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

function linspace(duration, sampleRate) {
  const n = Math.max(64, Math.floor(duration * sampleRate));
  const t = new Array(n);
  for (let i = 0; i < n; i += 1) {
    t[i] = i / sampleRate;
  }
  return t;
}

function normalize(signal) {
  if (!signal.length) return [];
  const maxAbs = Math.max(...signal.map((x) => Math.abs(x)), 1e-9);
  return signal.map((x) => x / maxAbs);
}

function movingAverage(signal, windowSize) {
  const width = Math.max(1, Math.floor(windowSize));
  const out = new Array(signal.length).fill(0);
  let sum = 0;
  for (let i = 0; i < signal.length; i += 1) {
    sum += signal[i];
    if (i >= width) {
      sum -= signal[i - width];
    }
    out[i] = sum / Math.min(i + 1, width);
  }
  return out;
}

function unwrapPhase(phase) {
  const out = [...phase];
  for (let i = 1; i < out.length; i += 1) {
    let delta = out[i] - out[i - 1];
    if (delta > Math.PI) out[i] -= 2 * Math.PI;
    if (delta < -Math.PI) out[i] += 2 * Math.PI;
    delta = out[i] - out[i - 1];
    if (delta > Math.PI) out[i] -= 2 * Math.PI;
    if (delta < -Math.PI) out[i] += 2 * Math.PI;
  }
  return out;
}

function coherentIQ(signal, t, rxFc, rxPhase, lpfWindow) {
  const iRaw = signal.map((s, idx) => 2 * s * Math.cos(2 * Math.PI * rxFc * t[idx] + rxPhase));
  const qRaw = signal.map((s, idx) => -2 * s * Math.sin(2 * Math.PI * rxFc * t[idx] + rxPhase));
  return {
    i: movingAverage(iRaw, lpfWindow),
    q: movingAverage(qRaw, lpfWindow),
  };
}

function nearestPowerOf2(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function computeSpectrum(signal, sampleRate) {
  const n = Math.min(512, nearestPowerOf2(signal.length));
  const x = signal.slice(0, n).map((v, i) => {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    return v * w;
  });

  const freq = [];
  const magDb = [];
  for (let k = 0; k < n / 2; k += 1) {
    let re = 0;
    let im = 0;
    for (let m = 0; m < n; m += 1) {
      const angle = (-2 * Math.PI * k * m) / n;
      re += x[m] * Math.cos(angle);
      im += x[m] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im) / n;
    freq.push((k * sampleRate) / n);
    magDb.push(20 * Math.log10(mag + 1e-8));
  }
  return { freq, magDb };
}

function drawLinePlot(canvas, series) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const valid = series.filter((entry) => entry.data.length > 1);
  ctx.clearRect(0, 0, width, height);
  const pad = 22;

  ctx.strokeStyle = "#d2deef";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height / 2);
  ctx.lineTo(width - pad, height / 2);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.stroke();

  if (!valid.length) return;

  const values = valid.flatMap((entry) => entry.data);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);

  valid.forEach((entry) => {
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    entry.data.forEach((y, idx) => {
      const xPix = pad + (idx / (entry.data.length - 1)) * (width - 2 * pad);
      const yPix = height - pad - ((y - min) / span) * (height - 2 * pad);
      if (idx === 0) ctx.moveTo(xPix, yPix);
      else ctx.lineTo(xPix, yPix);
    });
    ctx.stroke();
  });
}

function drawXYPlot(canvas, xList, yList, colorsList) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const pad = 22;

  ctx.strokeStyle = "#d2deef";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.stroke();

  if (!xList.length) return;

  const xMin = Math.min(...xList.map((x) => x[0]));
  const xMax = Math.max(...xList.map((x) => x[x.length - 1]));
  const yMin = Math.min(...yList.flatMap((y) => y));
  const yMax = Math.max(...yList.flatMap((y) => y));
  const xSpan = Math.max(1e-9, xMax - xMin);
  const ySpan = Math.max(1e-9, yMax - yMin);

  xList.forEach((xVals, p) => {
    const yVals = yList[p];
    ctx.strokeStyle = colorsList[p];
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    xVals.forEach((xVal, idx) => {
      const px = pad + ((xVal - xMin) / xSpan) * (width - 2 * pad);
      const py = height - pad - ((yVals[idx] - yMin) / ySpan) * (height - 2 * pad);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });
}

function drawConstellation(canvas, groups) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const pad = 24;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#d2deef";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, pad);
  ctx.lineTo(width / 2, height - pad);
  ctx.moveTo(pad, height / 2);
  ctx.lineTo(width - pad, height / 2);
  ctx.stroke();

  const flat = groups.flatMap((g) => g.points);
  if (!flat.length) {
    ctx.fillStyle = "#5c667f";
    ctx.font = "14px IBM Plex Sans";
    ctx.fillText("Constellation is available for digital schemes.", 34, height / 2);
    return;
  }

  const maxAbs = Math.max(1, ...flat.map((p) => Math.max(Math.abs(p.i), Math.abs(p.q))));

  groups.forEach((group) => {
    ctx.fillStyle = group.color;
    group.points.forEach((p) => {
      const x = width / 2 + (p.i / maxAbs) * (width / 2 - pad - 8);
      const y = height / 2 - (p.q / maxAbs) * (height / 2 - pad - 8);
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
}

let gaussSpare;
function gaussianRandom() {
  if (gaussSpare !== undefined) {
    const value = gaussSpare;
    gaussSpare = undefined;
    return value;
  }
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u));
  gaussSpare = mag * Math.sin(2 * Math.PI * v);
  return mag * Math.cos(2 * Math.PI * v);
}

function signalPower(signal) {
  if (!signal.length) return 0;
  return signal.reduce((acc, x) => acc + x * x, 0) / signal.length;
}

function applyChannel(signal, t, channel) {
  const fadeHz = 2;
  const faded = signal.map((s, idx) => {
    const envelope =
      1 - channel.fadingDepth +
      channel.fadingDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * fadeHz * t[idx]));
    return s * envelope;
  });

  const pow = Math.max(1e-10, signalPower(faded));
  const snrLinear = Math.pow(10, channel.snrDb / 10);
  const noiseVar = pow / Math.max(1e-9, snrLinear);
  const noiseStd = Math.sqrt(noiseVar);
  return faded.map((s) => s + noiseStd * gaussianRandom());
}

function randomBits(count) {
  return Array.from({ length: count }, () => (Math.random() > 0.5 ? 1 : 0));
}

function bitsToWaveform(bits, bitSamples) {
  const out = [];
  bits.forEach((b) => {
    for (let i = 0; i < bitSamples; i += 1) out.push(b ? 1 : -1);
  });
  return out;
}

function integrateSegment(signal, start, end, tone) {
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += signal[i] * tone(i);
  return sum;
}

function map2BitsToLevel(b1, b0) {
  const key = `${b1}${b0}`;
  if (key === "00") return -3;
  if (key === "01") return -1;
  if (key === "11") return 1;
  return 3;
}

function quantizeLevel(value) {
  const levels = [-3, -1, 1, 3];
  let best = levels[0];
  let bestErr = Infinity;
  levels.forEach((level) => {
    const err = Math.abs(value - level);
    if (err < bestErr) {
      bestErr = err;
      best = level;
    }
  });
  return best;
}

function decodeQpskQuadrant(iComp, qComp) {
  if (iComp >= 0 && qComp >= 0) return [0, 0];
  if (iComp < 0 && qComp >= 0) return [0, 1];
  if (iComp < 0 && qComp < 0) return [1, 1];
  return [1, 0];
}

function computeBitErrorRate(txBits, rxBits) {
  const total = Math.min(txBits.length, rxBits.length);
  if (!total) return { errors: 0, total: 0, rate: 0 };
  let errors = 0;
  for (let i = 0; i < total; i += 1) {
    if (txBits[i] !== rxBits[i]) errors += 1;
  }
  return { errors, total, rate: errors / total };
}

function computeSymbolErrorRate(txSyms, rxSyms) {
  const total = Math.min(txSyms.length, rxSyms.length);
  if (!total) return { errors: 0, total: 0, rate: 0 };
  let errors = 0;
  for (let i = 0; i < total; i += 1) {
    if (txSyms[i] !== rxSyms[i]) errors += 1;
  }
  return { errors, total, rate: errors / total };
}

function computeCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  const ac = a.slice(0, n);
  const bc = b.slice(0, n);
  const meanA = ac.reduce((sum, x) => sum + x, 0) / n;
  const meanB = bc.reduce((sum, x) => sum + x, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = ac[i] - meanA;
    const db = bc[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  return num / Math.max(1e-9, Math.sqrt(denA * denB));
}

function getSchemeById(id) {
  return allSchemes.find((scheme) => scheme.id === id);
}

function generateAnalog(t, params, schemeId, baseband) {
  const mn = normalize(baseband);
  const txSignal = new Array(t.length).fill(0);
  const demodulated = new Array(t.length).fill(0);

  if (schemeId === "am_dsb_lc") {
    for (let i = 0; i < t.length; i += 1) {
      txSignal[i] =
        params.carrierAmp *
        (1 + params.modIndex * mn[i]) *
        Math.cos(2 * Math.PI * params.carrierFreq * t[i]);
    }
  } else if (schemeId === "am_dsb_sc") {
    for (let i = 0; i < t.length; i += 1) {
      txSignal[i] =
        params.carrierAmp * mn[i] * Math.cos(2 * Math.PI * params.carrierFreq * t[i]);
    }
  } else if (schemeId === "fm") {
    const dt = 1 / SAMPLE_RATE;
    let integral = 0;
    for (let i = 0; i < t.length; i += 1) {
      integral += mn[i] * dt;
      const phase =
        2 * Math.PI * params.carrierFreq * t[i] + 2 * Math.PI * params.freqDev * integral;
      txSignal[i] = params.carrierAmp * Math.cos(phase);
    }
  } else if (schemeId === "pm") {
    for (let i = 0; i < t.length; i += 1) {
      txSignal[i] =
        params.carrierAmp *
        Math.cos(2 * Math.PI * params.carrierFreq * t[i] + params.modIndex * mn[i]);
    }
  }

  const rxSignal = applyChannel(txSignal, t, params.channel);

  if (schemeId === "am_dsb_lc") {
    const env = movingAverage(
      rxSignal.map((v) => Math.abs(v)),
      Math.max(3, Math.floor(SAMPLE_RATE / (params.messageFreq * 4.5))),
    );
    const dc = env.reduce((sum, v) => sum + v, 0) / env.length;
    for (let i = 0; i < t.length; i += 1) {
      demodulated[i] = env[i] - dc;
    }
  } else if (schemeId === "am_dsb_sc") {
    const mixed = rxSignal.map(
      (v, i) => 2 * v * Math.cos(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
    );
    const filtered = movingAverage(
      mixed,
      Math.max(3, Math.floor(SAMPLE_RATE / (params.messageFreq * 4))),
    );
    for (let i = 0; i < t.length; i += 1) {
      demodulated[i] = filtered[i];
    }
  } else if (schemeId === "fm") {
    const { i, q } = coherentIQ(
      rxSignal,
      t,
      params.receiverFc,
      params.receiverPhase,
      Math.max(5, Math.floor(SAMPLE_RATE / (params.messageFreq * 6))),
    );
    const phase = unwrapPhase(i.map((ival, idx) => Math.atan2(q[idx], ival)));
    for (let k = 1; k < phase.length; k += 1) {
      const fInst = ((phase[k] - phase[k - 1]) * SAMPLE_RATE) / (2 * Math.PI);
      demodulated[k] = (fInst - params.receiverFc) / Math.max(1, params.freqDev);
    }
  } else if (schemeId === "pm") {
    const { i, q } = coherentIQ(
      rxSignal,
      t,
      params.receiverFc,
      params.receiverPhase,
      Math.max(5, Math.floor(SAMPLE_RATE / (params.messageFreq * 6))),
    );
    const phase = unwrapPhase(i.map((ival, idx) => Math.atan2(q[idx], ival)));
    for (let k = 0; k < phase.length; k += 1) {
      demodulated[k] =
        (phase[k] - 2 * Math.PI * params.receiverFc * t[k]) / Math.max(1e-9, params.modIndex);
    }
  }

  return {
    baseband,
    txSignal,
    rxSignal,
    demodulated,
    constellation: [],
    txBits: [],
    rxBits: [],
    txSymbols: [],
    rxSymbols: [],
  };
}

function generateDigital(t, params, schemeId, bitPool) {
  const bitSamples = Math.max(4, Math.floor(SAMPLE_RATE / params.bitRate));
  const bitCount = Math.max(16, Math.floor(t.length / bitSamples));
  const neededBits = bitCount * 4 + 32;
  const sourceBits = bitPool && bitPool.length >= neededBits ? bitPool : randomBits(neededBits + 64);

  const txBits = [];
  const rxBits = [];
  const txSymbols = [];
  const rxSymbols = [];

  const txSignal = new Array(t.length).fill(0);
  const demodulated = new Array(t.length).fill(0);
  const constellation = [];
  const baseband = bitsToWaveform(sourceBits.slice(0, bitCount), bitSamples).slice(0, t.length);

  if (schemeId === "ask") {
    for (let i = 0; i < t.length; i += 1) {
      const b = sourceBits[Math.floor(i / bitSamples)] ?? 0;
      const amp = 0.2 + 0.8 * b;
      txSignal[i] = params.carrierAmp * amp * Math.cos(2 * Math.PI * params.carrierFreq * t[i]);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);
    const comps = [];

    for (let b = 0; b < bitCount; b += 1) {
      const start = b * bitSamples;
      const end = Math.min(start + bitSamples, t.length);
      const iComp =
        (2 / Math.max(1, end - start)) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.cos(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
        );
      const qComp =
        (-2 / Math.max(1, end - start)) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.sin(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
        );
      comps.push(iComp);
      constellation.push({ i: iComp, q: qComp });
      txBits.push(sourceBits[b]);
      txSymbols.push(String(sourceBits[b]));
    }

    const threshold = (Math.max(...comps) + Math.min(...comps)) / 2;

    for (let b = 0; b < bitCount; b += 1) {
      const start = b * bitSamples;
      const end = Math.min(start + bitSamples, t.length);
      const detected = comps[b] > threshold ? 1 : 0;
      rxBits.push(detected);
      rxSymbols.push(String(detected));
      for (let i = start; i < end; i += 1) demodulated[i] = detected ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  if (schemeId === "fsk") {
    const f0 = params.carrierFreq - params.freqDev / 2;
    const f1 = params.carrierFreq + params.freqDev / 2;

    for (let i = 0; i < t.length; i += 1) {
      const b = sourceBits[Math.floor(i / bitSamples)] ?? 0;
      txSignal[i] = params.carrierAmp * Math.cos(2 * Math.PI * (b ? f1 : f0) * t[i]);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);
    const rf0 = params.receiverFc - params.freqDev / 2;
    const rf1 = params.receiverFc + params.freqDev / 2;

    for (let b = 0; b < bitCount; b += 1) {
      const start = b * bitSamples;
      const end = Math.min(start + bitSamples, t.length);
      const c0 = integrateSegment(rxSignal, start, end, (i) => Math.cos(2 * Math.PI * rf0 * t[i]));
      const c1 = integrateSegment(rxSignal, start, end, (i) => Math.cos(2 * Math.PI * rf1 * t[i]));
      const detected = c1 > c0 ? 1 : 0;
      txBits.push(sourceBits[b]);
      rxBits.push(detected);
      txSymbols.push(String(sourceBits[b]));
      rxSymbols.push(String(detected));
      constellation.push({ i: c1, q: c0 });
      for (let i = start; i < end; i += 1) demodulated[i] = detected ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  if (schemeId === "bpsk") {
    for (let i = 0; i < t.length; i += 1) {
      const b = sourceBits[Math.floor(i / bitSamples)] ?? 0;
      const phase = b ? 0 : Math.PI;
      txSignal[i] = params.carrierAmp * Math.cos(2 * Math.PI * params.carrierFreq * t[i] + phase);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);

    for (let b = 0; b < bitCount; b += 1) {
      const start = b * bitSamples;
      const end = Math.min(start + bitSamples, t.length);
      const corr = integrateSegment(rxSignal, start, end, (i) =>
        Math.cos(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
      );
      const detected = corr >= 0 ? 1 : 0;
      txBits.push(sourceBits[b]);
      rxBits.push(detected);
      txSymbols.push(String(sourceBits[b]));
      rxSymbols.push(String(detected));
      constellation.push({ i: corr, q: 0 });
      for (let i = start; i < end; i += 1) demodulated[i] = detected ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  if (schemeId === "qpsk") {
    const symbolSamples = bitSamples * 2;
    const symbolCount = Math.max(8, Math.floor(t.length / symbolSamples));
    const phaseMap = {
      "00": Math.PI / 4,
      "01": (3 * Math.PI) / 4,
      "11": (-3 * Math.PI) / 4,
      "10": -Math.PI / 4,
    };

    for (let sym = 0; sym < symbolCount; sym += 1) {
      const b1 = sourceBits[2 * sym] ?? 0;
      const b0 = sourceBits[2 * sym + 1] ?? 0;
      const phase = phaseMap[`${b1}${b0}`];
      const start = sym * symbolSamples;
      const end = Math.min(start + symbolSamples, t.length);

      for (let i = start; i < end; i += 1) {
        txSignal[i] = params.carrierAmp * Math.cos(2 * Math.PI * params.carrierFreq * t[i] + phase);
      }

      txBits.push(b1, b0);
      txSymbols.push(`${b1}${b0}`);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);

    for (let sym = 0; sym < symbolCount; sym += 1) {
      const start = sym * symbolSamples;
      const end = Math.min(start + symbolSamples, t.length);
      const len = Math.max(1, end - start);
      const iComp =
        (2 / len) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.cos(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
        );
      const qComp =
        (-2 / len) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.sin(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
        );
      const [b1, b0] = decodeQpskQuadrant(iComp, qComp);
      rxBits.push(b1, b0);
      rxSymbols.push(`${b1}${b0}`);
      constellation.push({ i: iComp, q: qComp });
      for (let i = start; i < end; i += 1) demodulated[i] = b1 ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  const symbolSamples = bitSamples * 4;
  const symbolCount = Math.max(6, Math.floor(t.length / symbolSamples));
  const norm = 1 / Math.sqrt(10);

  for (let sym = 0; sym < symbolCount; sym += 1) {
    const b1 = sourceBits[4 * sym] ?? 0;
    const b0 = sourceBits[4 * sym + 1] ?? 0;
    const b3 = sourceBits[4 * sym + 2] ?? 0;
    const b2 = sourceBits[4 * sym + 3] ?? 0;

    const iLevel = map2BitsToLevel(b1, b0);
    const qLevel = map2BitsToLevel(b3, b2);
    const iAmp = iLevel * norm;
    const qAmp = qLevel * norm;

    const start = sym * symbolSamples;
    const end = Math.min(start + symbolSamples, t.length);
    for (let i = start; i < end; i += 1) {
      txSignal[i] =
        params.carrierAmp *
        (iAmp * Math.cos(2 * Math.PI * params.carrierFreq * t[i]) -
          qAmp * Math.sin(2 * Math.PI * params.carrierFreq * t[i]));
    }

    txBits.push(b1, b0, b3, b2);
    txSymbols.push(`${iLevel},${qLevel}`);
  }

  const rxSignal = applyChannel(txSignal, t, params.channel);

  for (let sym = 0; sym < symbolCount; sym += 1) {
    const start = sym * symbolSamples;
    const end = Math.min(start + symbolSamples, t.length);
    const len = Math.max(1, end - start);

    const iComp =
      (2 / len) *
      integrateSegment(rxSignal, start, end, (i) =>
        Math.cos(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
      ) /
      Math.max(1e-9, params.carrierAmp);

    const qComp =
      (-2 / len) *
      integrateSegment(rxSignal, start, end, (i) =>
        Math.sin(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
      ) /
      Math.max(1e-9, params.carrierAmp);

    const iHat = quantizeLevel(iComp / norm);
    const qHat = quantizeLevel(qComp / norm);
    const iBits = levelToBitsMap[String(iHat)] || [0, 0];
    const qBits = levelToBitsMap[String(qHat)] || [0, 0];

    rxBits.push(iBits[0], iBits[1], qBits[0], qBits[1]);
    rxSymbols.push(`${iHat},${qHat}`);
    constellation.push({ i: iComp / norm, q: qComp / norm });

    for (let i = start; i < end; i += 1) demodulated[i] = iHat > 0 ? 1 : -1;
  }

  return {
    baseband,
    txSignal,
    rxSignal,
    demodulated,
    constellation,
    txBits,
    rxBits,
    txSymbols,
    rxSymbols,
  };
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
    channel: {
      snrDb,
      fadingDepth,
    },
  };
}

function runScheme(scheme, t, params, basebandDef, sharedBits) {
  if (scheme.digital) {
    return generateDigital(t, params, scheme.id, sharedBits);
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

function render() {
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

    const primary = runScheme(primaryScheme, t, params, basebandDef, sharedBits);
    const compare = compareScheme ? runScheme(compareScheme, t, params, basebandDef, sharedBits) : null;

    els.basebandEq.textContent = primaryScheme.digital
      ? "m(t) = sum_k b(k) p(t-kTb), b(k) in {0,1}"
      : basebandDef.equation;
    els.modEq.textContent = primaryScheme.modulationEq;
    els.demodEq.textContent = primaryScheme.demodEq;
    els.compareModEq.textContent = compareScheme ? compareScheme.modulationEq : "N/A";
    els.compareDemodEq.textContent = compareScheme ? compareScheme.demodEq : "N/A";

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

    drawLinePlot(els.basebandCanvas, [
      { data: normalize(primary.baseband), color: colors.primaryBase },
      ...(compare
        ? [{ data: normalize(compare.baseband), color: colors.compareBase }]
        : []),
    ]);

    drawLinePlot(els.modulatedCanvas, [
      { data: normalize(primary.rxSignal), color: colors.primaryRx },
      ...(compare
        ? [{ data: normalize(compare.rxSignal), color: colors.compareRx }]
        : []),
    ]);

    drawLinePlot(els.demodulatedCanvas, [
      { data: normalize(primary.demodulated), color: colors.primaryDemod },
      ...(compare
        ? [{ data: normalize(compare.demodulated), color: colors.compareDemod }]
        : []),
    ]);

    const primarySpectrum = computeSpectrum(primary.rxSignal, SAMPLE_RATE);
    const xList = [primarySpectrum.freq];
    const yList = [primarySpectrum.magDb];
    const cList = [colors.spectrumPrimary];
    if (compare) {
      const compareSpectrum = computeSpectrum(compare.rxSignal, SAMPLE_RATE);
      xList.push(compareSpectrum.freq);
      yList.push(compareSpectrum.magDb);
      cList.push(colors.spectrumCompare);
    }
    drawXYPlot(els.spectrumCanvas, xList, yList, cList);

    const constellationGroups = [];
    if (primaryScheme.digital) {
      constellationGroups.push({ color: colors.constellationPrimary, points: primary.constellation });
    }
    if (compareScheme?.digital) {
      constellationGroups.push({ color: colors.constellationCompare, points: compare.constellation });
    }
    drawConstellation(els.constellationCanvas, constellationGroups);
    els.constellationPanel.style.display = constellationGroups.length ? "block" : "none";

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

function bindEvents() {
  els.family.addEventListener("change", () => {
    populateSchemeSelector();
    render();
  });

  els.scheme.addEventListener("change", render);
  els.baseband.addEventListener("change", render);
  els.compareMode.addEventListener("change", render);
  els.compareScheme.addEventListener("change", render);

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
    els[id].addEventListener("input", render);
  });

  els.refresh.addEventListener("click", render);

  els.resetDefaults.addEventListener("click", () => {
    applyControlState(defaultControls);
    setStatus("success", "Reset to defaults.");
  });

  els.savePreset.addEventListener("click", saveCurrentPreset);
  els.loadPreset.addEventListener("click", loadSelectedPreset);
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
    applyScenario("offsetQpsk");
  });

  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(button.dataset.scenario);
    });
  });
}

function init() {
  buildSelectors();
  renderTaxonomy();
  renderAtlas();
  loadPresetsFromStorage();
  refreshPresetDropdown();
  applyControlState(defaultControls, true);
  bindEvents();
  render();
}

init();
