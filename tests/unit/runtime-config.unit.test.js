import { afterEach, describe, expect, it } from 'vitest';
import { getRuntimeConfig, getRuntimeConfigString, isRuntimeConfigEnabled } from '../../js/runtime-config.js';

afterEach(() => {
  delete globalThis.window;
});

describe('runtime config', () => {
  it('returns an empty config when the window config is absent', () => {
    expect(getRuntimeConfig()).toEqual({});
    expect(getRuntimeConfigString('analyticsEndpoint')).toBe(null);
    expect(isRuntimeConfigEnabled('analyticsEnabled')).toBe(false);
  });

  it('reads and trims runtime config values safely', () => {
    globalThis.window = {
      __MOD_STUDIO_CONFIG__: {
        analyticsEnabled: true,
        analyticsEndpoint: ' https://example.com/analytics ',
      },
    };

    expect(getRuntimeConfig()).toEqual(globalThis.window.__MOD_STUDIO_CONFIG__);
    expect(getRuntimeConfigString('analyticsEndpoint')).toBe('https://example.com/analytics');
    expect(isRuntimeConfigEnabled('analyticsEnabled')).toBe(true);
  });

  it('ignores invalid runtime config payloads', () => {
    globalThis.window = {
      __MOD_STUDIO_CONFIG__: 'not-an-object',
    };

    expect(getRuntimeConfig()).toEqual({});
    expect(getRuntimeConfigString('analyticsEndpoint')).toBe(null);
    expect(isRuntimeConfigEnabled('analyticsEnabled')).toBe(false);
  });
});
