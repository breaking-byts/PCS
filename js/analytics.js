import { reportEvent } from './observability.js';

const ALLOWED_EVENTS = new Set([
  'app_loaded',
  'scenario_applied',
  'preset_saved',
  'export_csv',
  'export_png',
]);

function getRuntimeConfig() {
  if (typeof window === 'undefined' || typeof window.__MOD_STUDIO_CONFIG__ !== 'object') {
    return {};
  }
  return window.__MOD_STUDIO_CONFIG__ || {};
}

function getAnalyticsEndpoint() {
  const endpoint = getRuntimeConfig().analyticsEndpoint;
  if (typeof endpoint !== 'string') return null;
  const trimmed = endpoint.trim();
  return trimmed ? trimmed : null;
}

function isDoNotTrackEnabled() {
  if (typeof navigator === 'undefined') return false;
  const value = navigator.doNotTrack || globalThis.window?.doNotTrack || navigator.msDoNotTrack;
  return value === '1' || value === 'yes';
}

function isGlobalPrivacyControlEnabled() {
  if (typeof navigator === 'undefined') return false;
  return navigator.globalPrivacyControl === true;
}

function isPrivacyOptOut() {
  return isDoNotTrackEnabled() || isGlobalPrivacyControlEnabled();
}

function isAnalyticsEnabledByConfig() {
  return getRuntimeConfig().analyticsEnabled === true;
}

function dispatchAnalytics(payload) {
  const endpoint = getAnalyticsEndpoint();
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
    // Analytics failures must not affect app behavior.
  }
}

export function initAnalytics() {
  const enabled = isAnalyticsEnabledByConfig();
  reportEvent('analytics_init', {
    enabled,
    privacyOptOut: isPrivacyOptOut(),
    hasEndpoint: !!getAnalyticsEndpoint(),
  });
}

export function trackFunctionalEvent(name, payload = {}) {
  if (!ALLOWED_EVENTS.has(name)) return false;
  if (!isAnalyticsEnabledByConfig()) return false;
  if (isPrivacyOptOut()) return false;

  const eventPayload = {
    eventName: name,
    ts: new Date().toISOString(),
    payload,
  };

  reportEvent('analytics_event', { eventName: name });
  dispatchAnalytics(eventPayload);
  return true;
}
