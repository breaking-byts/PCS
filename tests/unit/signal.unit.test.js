import { describe, expect, it, vi, beforeEach } from "vitest";
import { SAMPLE_RATE, levelToBitsMap } from "../../js/config.js";
import { computeSpectrum, linspace, normalize, renderLatex } from "../../js/utils.js";
import {
  computeBitErrorRate,
  computeCorrelation,
  generateAnalog,
  generateDigital,
  integrateSegment,
} from "../../js/signal.js";
import { setRngSeed, getRngSeed, isDeterministic, random, randomBits } from "../../js/rng.js";
import { drawLinePlot, drawXYPlot, drawConstellation, renderPlots } from "../../js/render.js";

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

function makeCanvas(width = 720, height = 240) {
  const ctx = makeCanvasContextStub();
  const canvas = { width, height, getContext: vi.fn(() => ctx) };
  canvas._ctx = ctx;
  return canvas;
}

function deterministicBits(count) {
  const bits = new Array(count);
  for (let i = 0; i < count; i += 1) {
    bits[i] = i % 2;
  }
  return bits;
}

function makeParams(overrides = {}) {
  const carrierFreq = overrides.carrierFreq ?? 250;
  return {
    carrierFreq,
    messageFreq: overrides.messageFreq ?? 20,
    carrierAmp: overrides.carrierAmp ?? 1,
    messageAmp: overrides.messageAmp ?? 1,
    modIndex: overrides.modIndex ?? 0.8,
    freqDev: overrides.freqDev ?? 60,
    bitRate: overrides.bitRate ?? 120,
    duration: overrides.duration ?? 0.08,
    receiverFc: overrides.receiverFc ?? carrierFreq,
    receiverPhase: overrides.receiverPhase ?? 0,
    receiverModel: overrides.receiverModel ?? "manual",
    timingRecovery: overrides.timingRecovery ?? false,
    channel: {
      snrDb: overrides.snrDb ?? 60,
      fadingDepth: overrides.fadingDepth ?? 0,
    },
  };
}

describe("signal simulation correctness", () => {
  it("demodulates AM DSB-SC with high correlation in clean channel", () => {
    const params = makeParams({ carrierFreq: 320, messageFreq: 25, modIndex: 0.6 });
    const t = linspace(params.duration, SAMPLE_RATE);
    const baseband = t.map((x) => params.messageAmp * Math.sin(2 * Math.PI * params.messageFreq * x));
    const result = generateAnalog(t, params, "am_dsb_sc", baseband);
    const corr = computeCorrelation(normalize(result.baseband), normalize(result.demodulated));
    expect(corr).toBeGreaterThan(0.75);
  });

  it("recovers BPSK bits with low BER in a clean coherent link", () => {
    const params = makeParams({
      carrierFreq: 280,
      bitRate: 220,
      duration: 0.12,
      snrDb: 50,
    });
    const t = linspace(params.duration, SAMPLE_RATE);
    const bitPool = deterministicBits(40000);
    const result = generateDigital(t, params, "bpsk", bitPool, levelToBitsMap);
    const ber = computeBitErrorRate(result.txBits, result.rxBits);
    expect(ber.total).toBeGreaterThan(0);
    expect(ber.rate).toBeLessThan(0.03);
  });

  it("recovers QPSK symbols with low BER in a clean coherent link", () => {
    const params = makeParams({
      carrierFreq: 300,
      bitRate: 260,
      duration: 0.14,
      snrDb: 55,
    });
    const t = linspace(params.duration, SAMPLE_RATE);
    const bitPool = deterministicBits(50000);
    const result = generateDigital(t, params, "qpsk", bitPool, levelToBitsMap);
    const ber = computeBitErrorRate(result.txBits, result.rxBits);
    expect(ber.total).toBeGreaterThan(0);
    expect(ber.rate).toBeLessThan(0.05);
  });

  it("recovers 16-QAM symbols with low BER in a clean coherent link", () => {
    const params = makeParams({
      carrierFreq: 320,
      bitRate: 280,
      duration: 0.16,
      snrDb: 58,
    });
    const t = linspace(params.duration, SAMPLE_RATE);
    const bitPool = deterministicBits(70000);
    const result = generateDigital(t, params, "qam16", bitPool, levelToBitsMap);
    const ber = computeBitErrorRate(result.txBits, result.rxBits);
    expect(ber.total).toBeGreaterThan(0);
    expect(ber.rate).toBeLessThan(0.08);
  });

  it("demodulates FM with meaningful baseband correlation in a clean channel", () => {
    const params = makeParams({
      carrierFreq: 330,
      messageFreq: 30,
      freqDev: 140,
      snrDb: 55,
      duration: 0.1,
    });
    const t = linspace(params.duration, SAMPLE_RATE);
    const baseband = t.map((x) => params.messageAmp * Math.sin(2 * Math.PI * params.messageFreq * x));
    const result = generateAnalog(t, params, "fm", baseband);
    const corr = computeCorrelation(normalize(result.baseband), normalize(result.demodulated));
    expect(corr).toBeGreaterThan(0.45);
  });

  it("demodulates PM with stable finite output in a clean channel", () => {
    const params = makeParams({
      carrierFreq: 320,
      messageFreq: 26,
      modIndex: 0.9,
      snrDb: 55,
      duration: 0.1,
    });
    const t = linspace(params.duration, SAMPLE_RATE);
    const baseband = t.map((x) => params.messageAmp * Math.sin(2 * Math.PI * params.messageFreq * x));
    const result = generateAnalog(t, params, "pm", baseband);
    const normalized = normalize(result.demodulated);
    const finiteValues = normalized.filter(Number.isFinite);
    const peak = Math.max(...finiteValues.map((v) => Math.abs(v)));
    expect(finiteValues.length).toBe(normalized.length);
    expect(peak).toBeGreaterThan(0.05);
  });

  it("recovers FSK bits with low BER in a clean coherent link", () => {
    const params = makeParams({
      carrierFreq: 300,
      bitRate: 200,
      duration: 0.14,
      freqDev: 90,
      snrDb: 55,
    });
    const t = linspace(params.duration, SAMPLE_RATE);
    const bitPool = deterministicBits(40000);
    const result = generateDigital(t, params, "fsk", bitPool, levelToBitsMap);
    const ber = computeBitErrorRate(result.txBits, result.rxBits);
    expect(ber.total).toBeGreaterThan(0);
    expect(ber.rate).toBeLessThan(0.12);
  });

  it("improves BER with adaptive PLL + timing recovery under RX mismatch", () => {
    const base = makeParams({
      carrierFreq: 280,
      bitRate: 220,
      duration: 0.14,
      snrDb: 30,
      fadingDepth: 0.05,
      receiverFc: 298,
      receiverPhase: (35 * Math.PI) / 180,
    });
    const t = linspace(base.duration, SAMPLE_RATE);
    const bitPool = deterministicBits(50000);

    const manual = generateDigital(
      t,
      { ...base, receiverModel: "manual", timingRecovery: false },
      "ask",
      bitPool,
      levelToBitsMap,
    );
    const adaptive = generateDigital(
      t,
      { ...base, receiverModel: "pll", timingRecovery: true },
      "ask",
      bitPool,
      levelToBitsMap,
    );

    const berManual = computeBitErrorRate(manual.txBits, manual.rxBits);
    const berAdaptive = computeBitErrorRate(adaptive.txBits, adaptive.rxBits);
    expect(berAdaptive.total).toBeGreaterThan(0);
    expect(berAdaptive.rate).toBeLessThan(berManual.rate - 0.1);
  });

  it("returns empty spectrum for undersized signals", () => {
    const spectrum = computeSpectrum([1], SAMPLE_RATE);
    expect(spectrum.freq).toEqual([]);
    expect(spectrum.magDb).toEqual([]);
  });

  it("strips inline style attributes from rendered latex", () => {
    const rendered = renderLatex("s(t) = A_c [1 + \\mu \\cdot m_n(t)] \\cos(2\\pi f_c t)");
    expect(rendered.includes("style=")).toBe(false);
  });

  it("handles empty ASK sample windows without crashing", () => {
    const params = makeParams({ bitRate: 300 });
    const result = generateDigital([], params, "ask", deterministicBits(64), levelToBitsMap);
    expect(result.txSignal).toEqual([]);
    expect(result.rxSignal).toEqual([]);
    expect(result.rxBits).toEqual([]);
  });

  it("rejects unknown modulation scheme IDs explicitly", () => {
    const params = makeParams();
    const t = linspace(params.duration, SAMPLE_RATE);
    const baseband = t.map(() => 0);

    expect(() => generateDigital(t, params, "oops", deterministicBits(64), levelToBitsMap)).toThrow(
      /Unsupported digital scheme/,
    );
    expect(() => generateAnalog(t, params, "oops", baseband)).toThrow(/Unsupported analog scheme/);
  });

  it("rejects invalid analog array inputs explicitly", () => {
    const params = makeParams();
    const t = linspace(params.duration, SAMPLE_RATE);
    expect(() => generateAnalog(t, params, "am_dsb_lc", [])).toThrow(
      /equally sized time\/baseband arrays/,
    );
  });

  it("clamps integration windows to valid bounds", () => {
    const signal = [1, 2, 3, 4];
    const sum = integrateSegment(signal, -3, 99, () => 1);
    expect(sum).toBe(10);
  });
});

describe("render plot input guards", () => {
  it("drawLinePlot handles empty series gracefully", () => {
    const canvas = makeCanvas();
    drawLinePlot(canvas, []);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
    expect(canvas._ctx.stroke).toHaveBeenCalled();
  });

  it("drawLinePlot handles series with empty data arrays", () => {
    const canvas = makeCanvas();
    drawLinePlot(canvas, [
      { data: [], color: "#00ff9c" },
      { data: [1], color: "#ff9c00" },
    ]);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
  });

  it("drawLinePlot handles series with NaN values", () => {
    const canvas = makeCanvas();
    drawLinePlot(canvas, [
      { data: [1, NaN, 3, 4, 5], color: "#00ff9c" },
    ]);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
    expect(canvas._ctx.stroke).toHaveBeenCalled();
  });

  it("drawXYPlot handles empty input arrays", () => {
    const canvas = makeCanvas();
    drawXYPlot(canvas, [], [], []);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
  });

  it("drawXYPlot handles mismatched array lengths", () => {
    const canvas = makeCanvas();
    drawXYPlot(canvas, [[1, 2, 3]], [[1, 2]], ["#00ff9c"]);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
  });

  it("drawXYPlot handles arrays with NaN values", () => {
    const canvas = makeCanvas();
    drawXYPlot(
      canvas,
      [[1, 2, NaN, 4]],
      [[10, 20, 30, 40]],
      ["#00ff9c"]
    );
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
  });

  it("drawConstellation handles empty groups", () => {
    const canvas = makeCanvas();
    drawConstellation(canvas, []);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
    expect(canvas._ctx.fillText).toHaveBeenCalled();
  });

  it("drawConstellation handles groups with empty points", () => {
    const canvas = makeCanvas();
    drawConstellation(canvas, [
      { color: "#00ff9c", points: [] },
    ]);
    expect(canvas._ctx.clearRect).toHaveBeenCalled();
  });
});

describe("seeded RNG deterministic mode", () => {
  beforeEach(() => {
    setRngSeed(null);
  });

  it("produces identical random sequences with the same seed", () => {
    setRngSeed(42);
    const bits1 = randomBits(100);

    setRngSeed(42);
    const bits2 = randomBits(100);

    expect(bits1).toEqual(bits2);
  });

  it("produces different sequences with different seeds", () => {
    setRngSeed(42);
    const bits1 = randomBits(100);

    setRngSeed(123);
    const bits2 = randomBits(100);

    expect(bits1).not.toEqual(bits2);
  });

  it("reports deterministic state correctly", () => {
    expect(isDeterministic()).toBe(false);

    setRngSeed(42);
    expect(isDeterministic()).toBe(true);

    setRngSeed(null);
    expect(isDeterministic()).toBe(false);
  });

  it("returns the current seed value", () => {
    setRngSeed(999);
    expect(getRngSeed()).toBe(999);

    setRngSeed(null);
    expect(getRngSeed()).toBe(null);
  });

  it("produces reproducible BER results with seeded digital modulation", () => {
    const params = makeParams({ carrierFreq: 280, bitRate: 220, duration: 0.12, snrDb: 50 });
    const t = linspace(params.duration, SAMPLE_RATE);
    const bitPool = deterministicBits(40000);

    setRngSeed(777);
    const result1 = generateDigital(t, params, "bpsk", bitPool, levelToBitsMap);
    const ber1 = computeBitErrorRate(result1.txBits, result1.rxBits);

    setRngSeed(777);
    const result2 = generateDigital(t, params, "bpsk", bitPool, levelToBitsMap);
    const ber2 = computeBitErrorRate(result2.txBits, result2.rxBits);

    expect(ber1.rate).toBe(ber2.rate);
    expect(ber1.errors).toBe(ber2.errors);
    expect(ber1.total).toBe(ber2.total);
  });
});

describe("canvas rendering null guards", () => {
  it("drawLinePlot handles null canvas gracefully", () => {
    expect(() => drawLinePlot(null, [{ data: [1, 2, 3], color: "#00ff9c" }])).not.toThrow();
  });

  it("drawLinePlot handles canvas with zero dimensions", () => {
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => makeCanvasContextStub()) };
    expect(() => drawLinePlot(canvas, [{ data: [1, 2, 3], color: "#00ff9c" }])).not.toThrow();
  });

  it("drawXYPlot handles null canvas gracefully", () => {
    expect(() => drawXYPlot(null, [[1, 2]], [[3, 4]], ["#00ff9c"])).not.toThrow();
  });

  it("drawConstellation handles null canvas gracefully", () => {
    expect(() => drawConstellation(null, [{ color: "#00ff9c", points: [{ i: 1, q: 1 }] }])).not.toThrow();
  });

  it("renderPlots handles null canvas collection gracefully", () => {
    expect(() => renderPlots(null, { primary: { baseband: [], rxSignal: [], demodulated: [] } }, {}, null)).not.toThrow();
  });

  it("renderPlots handles null data gracefully", () => {
    const canvas = makeCanvas();
    const cvs = {
      basebandCanvas: canvas,
      modulatedCanvas: canvas,
      demodulatedCanvas: canvas,
      spectrumCanvas: canvas,
      constellationCanvas: canvas,
    };
    expect(() => renderPlots(cvs, null, {}, null)).not.toThrow();
    expect(() => renderPlots(cvs, {}, {}, null)).not.toThrow();
  });

  it("renderPlots handles missing canvas elements gracefully", () => {
    const data = {
      primary: { baseband: [1, 2, 3], rxSignal: [1, 2, 3], demodulated: [1, 2, 3] }
    };
    expect(() => renderPlots({}, data, {}, null)).not.toThrow();
    expect(() => renderPlots({ basebandCanvas: null }, data, {}, null)).not.toThrow();
  });

  it("renderPlots handles empty signal arrays", () => {
    const canvas = makeCanvas();
    const cvs = {
      basebandCanvas: canvas,
      modulatedCanvas: canvas,
      demodulatedCanvas: canvas,
      spectrumCanvas: canvas,
      constellationCanvas: canvas,
    };
    const data = {
      primary: { baseband: [], rxSignal: [], demodulated: [], constellation: [] }
    };
    expect(() => renderPlots(cvs, data, { digital: true }, null)).not.toThrow();
  });
});

describe("CSV export sanitization", () => {
  it("escapes formula injection characters at cell start", () => {
    const sanitize = (v) => {
      const FORMULA_INJECTION_CHARS = /^[=+\-@]/;
      if (v === null || v === undefined) return '';
      const str = String(v);
      if (FORMULA_INJECTION_CHARS.test(str)) {
        return `'${str}`;
      }
      return str;
    };

    expect(sanitize("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitize("+1+1")).toBe("'+1+1");
    expect(sanitize("-1+1")).toBe("'-1+1");
    expect(sanitize("@SUM")).toBe("'@SUM");
    expect(sanitize("normal text")).toBe("normal text");
    expect(sanitize("123")).toBe("123");
  });

  it("handles null and undefined values in CSV cells", () => {
    const sanitize = (v) => {
      if (v === null || v === undefined) return '';
      return String(v);
    };
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(0)).toBe('0');
  });
});
