import { PRESET_STORAGE_KEY } from './config.js';
import { nowStamp } from './utils.js';

const PRESET_NAME_MAX_LENGTH = 64;
const PRESET_NAME_PATTERN = /^[\w\-\.]+$/;
const VALID_PRESET_KEYS = [
  'family', 'scheme', 'baseband', 'carrierFreq', 'messageFreq', 'carrierAmp',
  'messageAmp', 'modIndex', 'freqDev', 'bitRate', 'duration', 'snrDb',
  'fadingDepth', 'rxCarrierOffset', 'rxPhaseOffset', 'receiverModel',
  'timingRecovery', 'compareMode', 'compareScheme', 'deterministicMode', 'rngSeed',
];

let savedPresets = {};

function storageErrorMessage(err) {
  if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
    return 'Storage limit exceeded. Delete an old preset and try again.';
  }
  return 'Unable to save preset data in local storage.';
}

function normalizePresetName(name) {
  if (!name || typeof name !== 'string') return '';
  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\-_.]/g, '-');
  normalized = normalized.replace(/-+/g, '-');
  normalized = normalized.replace(/^-+|-+$/g, '');
  return normalized.slice(0, PRESET_NAME_MAX_LENGTH);
}

function isValidPresetName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length > PRESET_NAME_MAX_LENGTH) return false;
  return PRESET_NAME_PATTERN.test(name);
}

function sanitizePresetData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const sanitized = {};
  for (const key of VALID_PRESET_KEYS) {
    if (data[key] !== undefined && data[key] !== null) {
      const value = data[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
  }
  if (typeof sanitized.family !== 'string' || typeof sanitized.scheme !== 'string') {
    return null;
  }
  return sanitized;
}

function validateLoadedPresets(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const validated = {};
  for (const [name, data] of Object.entries(raw)) {
    if (isValidPresetName(name)) {
      const sanitized = sanitizePresetData(data);
      if (sanitized) {
        validated[name] = sanitized;
      }
    }
  }
  return validated;
}

export function loadPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) {
      savedPresets = {};
      return;
    }
    const parsed = JSON.parse(raw);
    savedPresets = validateLoadedPresets(parsed);
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

export function refreshPresetDropdown(els) {
  const names = Object.keys(savedPresets).filter(isValidPresetName).sort();
  els.savedPresetSelect.innerHTML = '';
  if (!names.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No presets saved';
    els.savedPresetSelect.appendChild(option);
    return;
  }

  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    els.savedPresetSelect.appendChild(option);
  });
}

export function saveCurrentPreset(els, currentControlState, setStatus, onSaved) {
  const explicit = els.presetName.value.trim();
  const rawName = explicit || `preset-${nowStamp()}`;
  const name = normalizePresetName(rawName);

  if (!name) {
    setStatus('error', 'Invalid preset name. Use letters, numbers, hyphens, and underscores only.');
    return;
  }

  const previous = savedPresets[name];
  savedPresets[name] = currentControlState();
  const persistResult = persistPresets();
  if (!persistResult.ok) {
    if (previous === undefined) {
      delete savedPresets[name];
    } else {
      savedPresets[name] = previous;
    }
    setStatus('error', storageErrorMessage(persistResult.error));
    return;
  }

  refreshPresetDropdown(els);
  els.savedPresetSelect.value = name;
  els.presetName.value = name;
  setStatus('success', `Preset saved: ${name}`);
  if (typeof onSaved === 'function') {
    onSaved(name);
  }
}

export function loadSelectedPreset(els, applyControlState, setStatus, levelToBitsMap) {
  const name = els.savedPresetSelect.value;
  if (!name || !savedPresets[name]) {
    setStatus('error', 'Select a saved preset first.');
    return;
  }
  const sanitizedPreset = sanitizePresetData(savedPresets[name]);
  if (!sanitizedPreset) {
    setStatus('error', 'Invalid preset data. Preset may be corrupted.');
    return;
  }
  applyControlState(sanitizedPreset, false, levelToBitsMap);
  els.presetName.value = name;
  setStatus('success', `Preset loaded: ${name}`);
}

export function deleteSelectedPreset(els, setStatus) {
  const name = els.savedPresetSelect.value;
  if (!name || !isValidPresetName(name) || !savedPresets[name]) {
    setStatus('error', 'No preset selected for deletion.');
    return;
  }
  const previous = savedPresets[name];
  delete savedPresets[name];
  const persistResult = persistPresets();
  if (!persistResult.ok) {
    savedPresets[name] = previous;
    setStatus('error', storageErrorMessage(persistResult.error));
    return;
  }
  refreshPresetDropdown(els);
  els.presetName.value = '';
  setStatus('success', `Preset deleted: ${name}`);
}
