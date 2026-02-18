function getRuntimeConfig() {
  if (typeof window === 'undefined' || typeof window.__MOD_STUDIO_CONFIG__ !== 'object') {
    return {};
  }
  return window.__MOD_STUDIO_CONFIG__ || {};
}

function getObservabilityEndpoint() {
  const endpoint = getRuntimeConfig().observabilityEndpoint;
  if (typeof endpoint !== 'string') return null;
  const trimmed = endpoint.trim();
  return trimmed ? trimmed : null;
}

function getPageMetadata() {
  if (typeof window === 'undefined') {
    return { href: null, path: null };
  }
  return {
    href: window.location?.href || null,
    path: window.location?.pathname || null,
  };
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack || null,
    };
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error, stack: null };
  }
  return {
    name: 'Error',
    message: 'Unknown error',
    stack: null,
  };
}

function serializePayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (_err) {
    return { serializationError: true };
  }
}

function dispatchRemote(payload) {
  const endpoint = getObservabilityEndpoint();
  if (!endpoint) return;

  try {
    const body = JSON.stringify(payload);
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(endpoint, body)
    ) {
      return;
    }

    if (typeof fetch === 'function') {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch (_err) {
    // Failing telemetry must never affect app behavior.
  }
}

export function reportError(error, context = {}) {
  const normalizedError = normalizeError(error);
  const envelope = {
    type: 'error',
    ts: new Date().toISOString(),
    page: getPageMetadata(),
    error: normalizedError,
    context: serializePayload(context),
  };

  console.error('[observability:error]', envelope);
  dispatchRemote(envelope);
}

export function reportEvent(name, payload = {}) {
  if (typeof name !== 'string' || !name.trim()) return;

  const envelope = {
    type: 'event',
    eventName: name.trim(),
    ts: new Date().toISOString(),
    page: getPageMetadata(),
    payload: serializePayload(payload),
  };

  console.info('[observability:event]', envelope);
  dispatchRemote(envelope);
}

let observabilityInitialized = false;

export function initObservability() {
  if (observabilityInitialized || typeof window === 'undefined') return;
  observabilityInitialized = true;

  window.addEventListener('error', (event) => {
    reportError(event.error || event.message || 'Window error', {
      source: event.filename || null,
      line: Number.isFinite(event.lineno) ? event.lineno : null,
      column: Number.isFinite(event.colno) ? event.colno : null,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason || 'Unhandled promise rejection', {
      source: 'unhandledrejection',
    });
  });
}
