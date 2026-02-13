import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const INDEX_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const STYLES = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const int = Number.parseInt(clean, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  return (0.2126 * linearize(rgb.r)) + (0.7152 * linearize(rgb.g)) + (0.0722 * linearize(rgb.b));
}

function contrastRatio(hexA, hexB) {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function getColorVar(name) {
  const match = STYLES.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) {
    throw new Error(`Missing CSS token: --${name}`);
  }
  return match[1];
}

describe("accessibility audit checks", () => {
  it("provides keyboard landmarks and screen-reader status semantics", () => {
    const dom = new JSDOM(INDEX_HTML);
    const { document } = dom.window;

    const skipLink = document.querySelector(".skip-link");
    const main = document.getElementById("main-content");
    const statusText = document.getElementById("statusText");

    expect(skipLink).toBeTruthy();
    expect(skipLink?.getAttribute("href")).toBe("#family");
    expect(main).toBeTruthy();
    expect(statusText?.getAttribute("role")).toBe("status");
    expect(statusText?.getAttribute("aria-live")).toBe("polite");
  });

  it("maintains focus-visible rules for major interactive controls", () => {
    expect(STYLES.includes("button:focus-visible")).toBe(true);
    expect(STYLES.includes("input:focus-visible")).toBe(true);
    expect(STYLES.includes("select:focus-visible")).toBe(true);
    expect(STYLES.includes(".topnav a:focus-visible")).toBe(true);
  });

  it("keeps core foreground/background contrast within accessible bounds", () => {
    const bg = getColorVar("bg");
    const ink = getColorVar("ink");
    const accent = getColorVar("accent");
    const muted = getColorVar("muted");

    expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(accent, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, bg)).toBeGreaterThanOrEqual(3);
  });
});
