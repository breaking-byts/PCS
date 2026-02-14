import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, levelToBitsMap } from "../../js/config.js";
import { computeSpectrum, linspace, normalize, renderLatex } from "../../js/utils.js";
import {
  computeBitErrorRate,
  computeCorrelation,
  generateAnalog,
  generateDigital,
  integrateSegment,
} from "../../js/signal.js";

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

  it("clamps integration windows to valid bounds", () => {
    const signal = [1, 2, 3, 4];
    const sum = integrateSegment(signal, -3, 99, () => 1);
    expect(sum).toBe(10);
  });
});
