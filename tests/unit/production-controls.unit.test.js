import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initObservability, reportEvent } from '../../js/observability.js';
import { initAnalytics, trackFunctionalEvent } from '../../js/analytics.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NETLIFY = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
const VERCEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

function extractNetlifyHeader(name) {
  const regex = new RegExp(`${name}\\s*=\\s*\"([^\"]+)\"`);
  const match = NETLIFY.match(regex);
  return match ? match[1] : null;
}

function extractVercelHeader(name, source = '/(.*)') {
  const entry = VERCEL.headers.find((item) => item.source === source);
  if (!entry) return null;
  const header = entry.headers.find((item) => item.key === name);
  return header ? header.value : null;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window;
  delete globalThis.navigator;
  delete globalThis.fetch;
});

describe('production controls', () => {
  it('keeps CSP identical between Netlify and Vercel', () => {
    const netlifyCsp = extractNetlifyHeader('Content-Security-Policy');
    const vercelCsp = extractVercelHeader('Content-Security-Policy');
    expect(netlifyCsp).toBeTruthy();
    expect(netlifyCsp).toBe(vercelCsp);
    expect(netlifyCsp.includes("img-src 'self'")).toBe(true);
    expect(netlifyCsp.includes('upgrade-insecure-requests')).toBe(true);
  });

  it('keeps asset cache policy aligned between Netlify and Vercel', () => {
    const expectedAssetCache = 'public, max-age=600, stale-while-revalidate=86400';
    expect(NETLIFY.includes(`Cache-Control = \"${expectedAssetCache}\"`)).toBe(true);
    expect(extractVercelHeader('Cache-Control', '/js/(.*)')).toBe(expectedAssetCache);
    expect(extractVercelHeader('Cache-Control', '/vendor/(.*)')).toBe(expectedAssetCache);
    expect(extractVercelHeader('Cache-Control', '/styles.css')).toBe(expectedAssetCache);
  });

  it('registers window handlers for error telemetry', () => {
    const handlers = {};
    const addEventListener = vi.fn((eventName, handler) => {
      handlers[eventName] = handler;
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    globalThis.window = {
      addEventListener,
      location: { href: 'http://localhost', pathname: '/' },
      __MOD_STUDIO_CONFIG__: {},
    };
    globalThis.navigator = { sendBeacon: vi.fn(() => false) };
    globalThis.fetch = vi.fn();

    initObservability();
    expect(addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    handlers.error({
      error: new Error('boom'),
      filename: 'main.js',
      lineno: 12,
      colno: 4,
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs observability events in structured form', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    globalThis.window = {
      location: { href: 'http://localhost', pathname: '/' },
      __MOD_STUDIO_CONFIG__: {},
    };

    reportEvent('test_event', { value: 1 });
    expect(infoSpy).toHaveBeenCalled();
  });

  it('keeps analytics disabled by default', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    globalThis.window = {
      __MOD_STUDIO_CONFIG__: {},
      location: { href: 'http://localhost', pathname: '/' },
      doNotTrack: '0',
    };
    globalThis.navigator = { doNotTrack: '0', globalPrivacyControl: false };

    initAnalytics();
    expect(infoSpy).toHaveBeenCalled();
    const emitted = trackFunctionalEvent('app_loaded', { source: 'test' });
    expect(emitted).toBe(false);
  });

  it('suppresses analytics when privacy opt-out is enabled', () => {
    const sendBeacon = vi.fn(() => true);
    globalThis.window = {
      __MOD_STUDIO_CONFIG__: {
        analyticsEnabled: true,
        analyticsEndpoint: 'https://example.com/analytics',
      },
      location: { href: 'http://localhost', pathname: '/' },
      doNotTrack: '1',
    };
    globalThis.navigator = {
      doNotTrack: '1',
      globalPrivacyControl: false,
      sendBeacon,
    };

    const emitted = trackFunctionalEvent('app_loaded');
    expect(emitted).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('emits analytics events when enabled and privacy allows it', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const sendBeacon = vi.fn(() => true);
    globalThis.window = {
      __MOD_STUDIO_CONFIG__: {
        analyticsEnabled: true,
        analyticsEndpoint: 'https://example.com/analytics',
      },
      location: { href: 'http://localhost', pathname: '/' },
      doNotTrack: '0',
    };
    globalThis.navigator = {
      doNotTrack: '0',
      globalPrivacyControl: false,
      sendBeacon,
    };

    const emitted = trackFunctionalEvent('app_loaded', { source: 'test' });
    expect(emitted).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('ignores events outside the allowed functional event list', () => {
    globalThis.window = {
      __MOD_STUDIO_CONFIG__: {
        analyticsEnabled: true,
      },
      location: { href: 'http://localhost', pathname: '/' },
      doNotTrack: '0',
    };
    globalThis.navigator = { doNotTrack: '0', globalPrivacyControl: false };
    expect(trackFunctionalEvent('unsupported_event')).toBe(false);
  });
});
