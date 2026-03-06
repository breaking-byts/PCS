export const elementIdByKey = {
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

export const els = new Proxy({}, {
  get(_target, prop) {
    const key = typeof prop === 'string' ? prop : '';
    const id = elementIdByKey[key];
    return id ? document.getElementById(id) : undefined;
  },
});

export function ensureRequiredUiElements() {
  const missing = Object.entries(elementIdByKey)
    .filter(([, id]) => !document.getElementById(id))
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing required UI elements: ${missing.join(', ')}`);
  }
}

export function getScenarioButtons(root = document) {
  return Array.from(root.querySelectorAll('.scenario-btn'));
}
