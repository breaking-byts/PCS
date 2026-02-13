import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, levelToBitsMap } from "../../js/config.js";
import { linspace, normalize } from "../../js/utils.js";
import {
  computeBitErrorRate,
  computeCorrelation,
  generateAnalog,
  generateDigital,
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
});
