const NUMERIC_CONTROL_IDS = [
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
];

function getControlParts(id) {
  return {
    range: document.getElementById(id),
    number: document.getElementById(`${id}Input`),
    readout: document.getElementById(`${id}Val`),
  };
}

function getPrecision(step) {
  const raw = `${step ?? ''}`;
  if (!raw.includes('.')) return 0;
  return raw.split('.')[1].length;
}

function formatValue(control, value) {
  const precision = getPrecision(control.step);
  const fixed = Number(value).toFixed(precision);
  return fixed.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

function clampToControl(control, rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return Number(control.value);
  }

  const min = Number(control.min);
  const max = Number(control.max);
  const step = Number(control.step);

  let next = parsed;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);

  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(min) ? min : 0;
    next = base + Math.round((next - base) / step) * step;
  }

  const precision = getPrecision(control.step);
  return Number(next.toFixed(precision));
}

export function syncNumericControl(id, rawValue) {
  const { range, number, readout } = getControlParts(id);
  if (!range) return;

  const nextValue = clampToControl(range, rawValue);
  const formatted = formatValue(range, nextValue);

  range.value = formatted;
  if (number) number.value = formatted;
  if (readout) readout.textContent = formatted;
}

export function bindNumericControls(onChange) {
  NUMERIC_CONTROL_IDS.forEach((id) => {
    const { range, number } = getControlParts(id);
    if (!range || !number) return;

    range.addEventListener('input', (event) => {
      syncNumericControl(id, event.target.value);
      onChange();
    });

    number.addEventListener('input', (event) => {
      if (!event.target.value.trim()) return;
      syncNumericControl(id, event.target.value);
      onChange();
    });

    number.addEventListener('change', (event) => {
      syncNumericControl(id, event.target.value);
    });
  });
}

export { NUMERIC_CONTROL_IDS };
