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
});
