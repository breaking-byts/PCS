function hasRuntimeConfig() {
  return typeof window !== 'undefined' && typeof window.__MOD_STUDIO_CONFIG__ === 'object';
}

export function getRuntimeConfig() {
  return hasRuntimeConfig() ? window.__MOD_STUDIO_CONFIG__ || {} : {};
}

export function getRuntimeConfigString(key) {
  const value = getRuntimeConfig()[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function isRuntimeConfigEnabled(key) {
  return getRuntimeConfig()[key] === true;
}
