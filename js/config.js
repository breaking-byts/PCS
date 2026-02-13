export const SAMPLE_RATE = 8000;
export const PRESET_STORAGE_KEY = "modulationStudio.presets.v1";

export const modulationFamilies = [
  {
    id: "amplitude",
    name: "Amplitude Modulation",
    schemes: [
      {
        id: "am_dsb_lc",
        label: "AM DSB-LC (Conventional AM)",
        digital: false,
        modulationEq: "s(t) = A_c [1 + \\mu \\cdot m_n(t)] \\cos(2\\pi f_c t)",
        demodEq: "\\hat{m}(t) \\approx \\text{LPF}\\{|r(t)|\\} - \\text{DC}",
      },
      {
        id: "am_dsb_sc",
        label: "AM DSB-SC",
        digital: false,
        modulationEq: "s(t) = A_c \\cdot m_n(t) \\cdot \\cos(2\\pi f_c t)",
        demodEq: "\\hat{m}(t) = \\text{LPF}\\{2 r(t) \\cos(2\\pi f_{rx} t + \\phi_{rx})\\}",
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
        modulationEq: "s(t) = A_c \\cos\\left(2\\pi f_c t + 2\\pi k_f \\int m_n(t)\\,dt\\right)",
        demodEq: "\\hat{m}(t) = \\frac{f_{inst}(t) - f_{rx}}{k_f}, \\quad f_{inst} = \\frac{1}{2\\pi}\\frac{d\\phi}{dt}",
      },
      {
        id: "pm",
        label: "Phase Modulation (PM)",
        digital: false,
        modulationEq: "s(t) = A_c \\cos(2\\pi f_c t + k_p \\cdot m_n(t))",
        demodEq: "\\hat{m}(t) = \\frac{\\phi(t) - 2\\pi f_{rx} t}{k_p}",
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
        modulationEq: "s(t) = A_c [a_0 + a_1 \\cdot b(k)] \\cos(2\\pi f_c t)",
        demodEq: "\\hat{b}(k) = \\text{threshold}\\left\\{\\int r(t) \\cos(2\\pi f_{rx} t + \\phi_{rx})\\,dt\\right\\}",
      },
      {
        id: "fsk",
        label: "FSK (Binary)",
        digital: true,
        modulationEq: "s(t) = A_c \\cos(2\\pi f_i t), \\quad f_i \\in \\{f_c-\\Delta f, f_c+\\Delta f\\}",
        demodEq: "\\hat{b}(k) = \\arg\\max_i \\int r(t) \\cos(2\\pi f_{i,rx} t)\\,dt",
      },
      {
        id: "bpsk",
        label: "BPSK",
        digital: true,
        modulationEq: "s(t) = A_c \\cos(2\\pi f_c t + \\pi(1-b(k)))",
        demodEq: "\\hat{b}(k) = \\text{sign}\\left\\{\\int r(t) \\cos(2\\pi f_{rx} t + \\phi_{rx})\\,dt\\right\\}",
      },
      {
        id: "qpsk",
        label: "QPSK",
        digital: true,
        modulationEq: "s(t) = A_c[I_k \\cos(2\\pi f_c t) - Q_k \\sin(2\\pi f_c t)]",
        demodEq: "\\hat{I}, \\hat{Q} \\text{ from coherent I/Q integrators}",
      },
      {
        id: "qam16",
        label: "16-QAM",
        digital: true,
        modulationEq: "s(t) = A_c[I_k \\cos(2\\pi f_c t) - Q_k \\sin(2\\pi f_c t)], \\quad I,Q \\in \\{-3,-1,1,3\\}",
        demodEq: "\\text{Nearest-neighbor symbol decision in I/Q plane}",
      },
    ],
  },
];

export const basebandSignals = [
  {
    id: "sine",
    label: "Sine Wave",
    equation: "m(t) = A_m \\sin(2\\pi f_m t)",
    generator: (t, am, fm) => am * Math.sin(2 * Math.PI * fm * t),
  },
  {
    id: "square",
    label: "Square Wave",
    equation: "m(t) = A_m \\cdot \\text{sgn}(\\sin(2\\pi f_m t))",
    generator: (t, am, fm) => am * (Math.sin(2 * Math.PI * fm * t) >= 0 ? 1 : -1),
  },
  {
    id: "triangle",
    label: "Triangle Wave",
    equation: "m(t) = \\frac{2A_m}{\\pi} \\arcsin(\\sin(2\\pi f_m t))",
    generator: (t, am, fm) => (2 * am / Math.PI) * Math.asin(Math.sin(2 * Math.PI * fm * t)),
  },
];

export const defaultControls = {
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
  receiverModel: "manual",
  timingRecovery: false,
  compareMode: false,
  compareScheme: "qpsk",
};

export const scenarioPresets = {
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
    receiverModel: "manual",
    timingRecovery: false,
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
    receiverModel: "pll",
    timingRecovery: true,
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
    receiverModel: "pll",
    timingRecovery: true,
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
    receiverModel: "manual",
    timingRecovery: false,
    compareMode: true,
    compareScheme: "pm",
  },
};

export const colors = {
  primaryBase: "#00ff9c",
  compareBase: "#ff9c00",
  primaryRx: "#00e676",
  compareRx: "#ffab40",
  primaryDemod: "#40c4ff",
  compareDemod: "#ea80fc",
  spectrumPrimary: "#00ff9c",
  spectrumCompare: "#ff9c00",
  constellationPrimary: "#00ff9c",
  constellationCompare: "#ff9c00",
};

export const allSchemes = modulationFamilies.flatMap((family) =>
  family.schemes.map((scheme) => ({
    ...scheme,
    familyId: family.id,
    familyName: family.name,
  })),
);

export const levelToBitsMap = {
  "-3": [0, 0],
  "-1": [0, 1],
  1: [1, 1],
  3: [1, 0],
};
