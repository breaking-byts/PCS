import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultControls, levelToBitsMap } from "../../js/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function makeCanvasContextStub() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    set strokeStyle(_v) {},
    set fillStyle(_v) {},
    set lineWidth(_v) {},
    set font(_v) {},
  };
}

function setupDom() {
  const dom = new JSDOM(INDEX_HTML, { url: "http://localhost", pretendToBeVisual: true });
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.Blob = window.Blob;
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

  const createObjectURL = vi.fn(() => "blob:mock");
  const revokeObjectURL = vi.fn();
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;
  globalThis.URL = window.URL;

  const raf = vi.fn((cb) => {
    cb();
    return 1;
  });
  const caf = vi.fn();
  window.requestAnimationFrame = raf;
  window.cancelAnimationFrame = caf;
  globalThis.requestAnimationFrame = raf;
  globalThis.cancelAnimationFrame = caf;

  const ctx = makeCanvasContextStub();
  window.HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx);
  window.HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,AAAA");

  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push({ download: this.download, href: this.href });
  };

  return { createObjectURL, revokeObjectURL, downloads, raf };
}

async function loadUiModule() {
  const moduleUrl = `${pathToFileURL(path.join(ROOT, "js/ui.js")).href}?ts=${Date.now()}`;
  return import(moduleUrl);
}

async function loadExportsModule() {
  const moduleUrl = `${pathToFileURL(path.join(ROOT, "js/ui-exports.js")).href}?ts=${Date.now()}`;
  return import(moduleUrl);
}

beforeEach(() => {
  vi.resetModules();
});

describe("UI smoke tests", () => {
  it("initializes controls and supports save/load preset flow", async () => {
    const { raf } = setupDom();
    const ui = await loadUiModule();

    ui.buildSelectors();
    ui.renderTaxonomy();
    ui.renderAtlas();
    ui.applyControlState(defaultControls, true, levelToBitsMap);
    ui.bindEvents(levelToBitsMap);
    ui.bindEvents(levelToBitsMap);
    ui.render(levelToBitsMap);

    const family = document.getElementById("family");
    const scheme = document.getElementById("scheme");
    const compareMode = document.getElementById("compareMode");
    const compareScheme = document.getElementById("compareScheme");

    expect(family.options.length).toBeGreaterThan(0);
    expect(scheme.options.length).toBeGreaterThan(0);
    expect(compareScheme.disabled).toBe(true);

    compareMode.checked = true;
    compareMode.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(compareScheme.disabled).toBe(false);

    raf.mockClear();
    scheme.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(raf).toHaveBeenCalledTimes(1);

    const presetName = document.getElementById("presetName");
    presetName.value = "smoke-preset";
    document.getElementById("savePreset").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("savedPresetSelect").value).toBe("smoke-preset");

    document.getElementById("loadPreset").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("statusText").textContent).toContain("Preset loaded");

    const storageSetItem = vi.spyOn(window.Storage.prototype, "setItem").mockImplementation(() => {
      throw new window.DOMException("Quota exceeded", "QuotaExceededError");
    });
    presetName.value = "quota-preset";
    document.getElementById("savePreset").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("statusText").textContent).toContain("Storage limit exceeded");
    storageSetItem.mockRestore();
  });

  it("exports CSV and PNG from rendered simulation state", async () => {
    const { createObjectURL, downloads } = setupDom();
    const ui = await loadUiModule();

    ui.buildSelectors();
    ui.applyControlState(defaultControls, true, levelToBitsMap);
    ui.bindEvents(levelToBitsMap);
    ui.render(levelToBitsMap);

    document.getElementById("exportCsv").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    document.getElementById("exportPng").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloads.some((item) => item.download.endsWith(".csv"))).toBe(true);
    expect(downloads.some((item) => item.download.endsWith(".png"))).toBe(true);
  });

  it("sections are visible by default without JS animation (progressive enhancement)", async () => {
    const dom = new JSDOM(INDEX_HTML, { url: "http://localhost", pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;

    const sections = document.querySelectorAll("[data-section]");
    expect(sections.length).toBeGreaterThan(0);

    const computedStyle = (el) => window.getComputedStyle(el);
    sections.forEach((section) => {
      const opacity = computedStyle(section).opacity;
      const transform = computedStyle(section).transform;
      expect(opacity === "1" || opacity === "").toBe(true);
      expect(transform === "none" || transform === "").toBe(true);
    });
  });

  it("body does not have js class initially (progressive enhancement)", async () => {
    const dom = new JSDOM(INDEX_HTML, { url: "http://localhost", pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;

    expect(document.body.classList.contains('js')).toBe(false);
  });
});

describe("preset sanitization and validation", () => {
  it("rejects malformed preset names with special characters", async () => {
    setupDom();
    const ui = await loadUiModule();

    const invalidNames = [
      "preset<script>",
      "preset'or'1'='1",
      "preset; DROP TABLE",
      "preset with spaces",
      "../../../etc/passwd",
      "preset\ntest",
    ];

    for (const name of invalidNames) {
      const normalized = name.toLowerCase().replace(/[^a-z0-9\-_.]/g, '-');
      expect(normalized).not.toContain('<');
      expect(normalized).not.toContain("'");
      expect(normalized).not.toContain(';');
      expect(normalized).not.toContain(' ');
    }
  });

  it("normalizes preset names to safe format", async () => {
    const normalizePresetName = (name) => {
      if (!name || typeof name !== 'string') return '';
      let normalized = name.trim().toLowerCase();
      normalized = normalized.replace(/[^a-z0-9\-_.]/g, '-');
      normalized = normalized.replace(/-+/g, '-');
      normalized = normalized.replace(/^-+|-+$/g, '');
      return normalized.slice(0, 64);
    };

    expect(normalizePresetName("My Cool Preset!")).toBe("my-cool-preset");
    expect(normalizePresetName("---test---")).toBe("test");
    expect(normalizePresetName("a".repeat(100))).toBe("a".repeat(64));
    expect(normalizePresetName("")).toBe("");
  });

  it("validates loaded preset data structure", async () => {
    const sanitizePresetData = (data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
      }
      const VALID_KEYS = [
        'family', 'scheme', 'baseband', 'carrierFreq', 'messageFreq', 'carrierAmp',
        'messageAmp', 'modIndex', 'freqDev', 'bitRate', 'duration', 'snrDb',
        'fadingDepth', 'rxCarrierOffset', 'rxPhaseOffset', 'receiverModel',
        'timingRecovery', 'compareMode', 'compareScheme', 'deterministicMode', 'rngSeed'
      ];
      const sanitized = {};
      for (const key of VALID_KEYS) {
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
    };

    expect(sanitizePresetData(null)).toBe(null);
    expect(sanitizePresetData([])).toBe(null);
    expect(sanitizePresetData("string")).toBe(null);
    expect(sanitizePresetData({ family: "amplitude", scheme: "am_dsb_lc" })).toBeTruthy();
    expect(sanitizePresetData({ family: "amplitude", scheme: "am_dsb_lc", malicious: "data" })).toBeTruthy();
    expect(sanitizePresetData({ family: 123, scheme: "am_dsb_lc" })).toBe(null);
  });

  it("rejects preset data with prototype pollution attempts", async () => {
    const sanitizePresetData = (data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
      }
      const VALID_KEYS = ['family', 'scheme', 'baseband'];
      const sanitized = {};
      for (const key of VALID_KEYS) {
        if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
          sanitized[key] = data[key];
        }
      }
      return sanitized;
    };

    const malicious = { __proto__: { polluted: true }, family: "amplitude", scheme: "am_dsb_lc" };
    const result = sanitizePresetData(malicious);
    expect(result).not.toHaveProperty('polluted');
    expect(result).not.toHaveProperty('__proto__');
  });

  it("handles corrupted localStorage data gracefully", async () => {
    setupDom();
    
    window.localStorage.setItem('modulationStudio.presets.v1', 'not valid json');
    const ui = await loadUiModule();
    ui.loadPresetsFromStorage();
    ui.refreshPresetDropdown();
    
    const presetSelect = document.getElementById('savedPresetSelect');
    expect(presetSelect.options.length).toBe(1);
    expect(presetSelect.options[0].value).toBe('');
  });

  it("ignores invalid preset names from localStorage", async () => {
    setupDom();
    
    const invalidPresets = {
      "<script>": { family: "amplitude", scheme: "am_dsb_lc" },
      "valid-preset": { family: "amplitude", scheme: "am_dsb_lc" },
      "'; DROP TABLE--": { family: "amplitude", scheme: "am_dsb_lc" },
    };
    window.localStorage.setItem('modulationStudio.presets.v1', JSON.stringify(invalidPresets));
    
    const ui = await loadUiModule();
    ui.loadPresetsFromStorage();
    ui.refreshPresetDropdown();
    
    const presetSelect = document.getElementById('savedPresetSelect');
    const options = Array.from(presetSelect.options).map(o => o.value);
    expect(options).toContain('valid-preset');
    expect(options).not.toContain('<script>');
    expect(options).not.toContain("'; DROP TABLE--");
  });
});

describe("export error handling", () => {
  it("exportCurrentCsv handles invalid render data gracefully", async () => {
    setupDom();
    const exports = await loadExportsModule();
    const setStatus = vi.fn();
    
    exports.exportCurrentCsv(null, setStatus);
    expect(setStatus).toHaveBeenCalledWith('error', expect.stringContaining('Nothing to export'));
    
    exports.exportCurrentCsv({}, setStatus);
    expect(setStatus).toHaveBeenCalledWith('error', expect.stringContaining('Invalid render data'));
    
    exports.exportCurrentCsv({ time: [], primary: null }, setStatus);
    expect(setStatus).toHaveBeenCalledWith('error', expect.stringContaining('Invalid render data'));
  });

  it("exportCurrentPng handles missing elements gracefully", async () => {
    setupDom();
    const exports = await loadExportsModule();
    const setStatus = vi.fn();
    
    exports.exportCurrentPng(null, null, setStatus);
    expect(setStatus).toHaveBeenCalledWith('error', expect.stringContaining('Nothing to export'));
    
    exports.exportCurrentPng({ time: [1, 2], primary: {} }, null, setStatus);
    expect(setStatus).toHaveBeenCalledWith('error', expect.stringContaining('UI elements'));
  });
});
