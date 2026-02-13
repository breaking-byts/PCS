import { SAMPLE_RATE } from './config.js';
import { movingAverage, unwrapPhase, coherentIQ } from './utils.js';

let gaussSpare;

export function gaussianRandom() {
  if (gaussSpare !== undefined) {
    const value = gaussSpare;
    gaussSpare = undefined;
    return value;
  }
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u));
  gaussSpare = mag * Math.sin(2 * Math.PI * v);
  return mag * Math.cos(2 * Math.PI * v);
}

export function signalPower(signal) {
  if (!signal.length) return 0;
  return signal.reduce((acc, x) => acc + x * x, 0) / signal.length;
}

export function applyChannel(signal, t, channel) {
  const fadeHz = 2;
  const faded = signal.map((s, idx) => {
    const envelope =
      1 - channel.fadingDepth +
      channel.fadingDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * fadeHz * t[idx]));
    return s * envelope;
  });

  const pow = Math.max(1e-10, signalPower(faded));
  const snrLinear = Math.pow(10, channel.snrDb / 10);
  const noiseVar = pow / Math.max(1e-9, snrLinear);
  const noiseStd = Math.sqrt(noiseVar);
  return faded.map((s) => s + noiseStd * gaussianRandom());
}

export function randomBits(count) {
  return Array.from({ length: count }, () => (Math.random() > 0.5 ? 1 : 0));
}

export function bitsToWaveform(bits, bitSamples) {
  const out = [];
  bits.forEach((b) => {
    for (let i = 0; i < bitSamples; i += 1) out.push(b ? 1 : -1);
  });
  return out;
}

export function integrateSegment(signal, start, end, tone) {
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += signal[i] * tone(i);
  return sum;
}

export function map2BitsToLevel(b1, b0) {
  const key = `${b1}${b0}`;
  if (key === "00") return -3;
  if (key === "01") return -1;
  if (key === "11") return 1;
  return 3;
}

export function quantizeLevel(value) {
  const levels = [-3, -1, 1, 3];
  let best = levels[0];
  let bestErr = Infinity;
  levels.forEach((level) => {
    const err = Math.abs(value - level);
    if (err < bestErr) {
      bestErr = err;
      best = level;
    }
  });
  return best;
}

export function decodeQpskQuadrant(iComp, qComp) {
  if (iComp >= 0 && qComp >= 0) return [0, 0];
  if (iComp < 0 && qComp >= 0) return [0, 1];
  if (iComp < 0 && qComp < 0) return [1, 1];
  return [1, 0];
}

export function computeBitErrorRate(txBits, rxBits) {
  const total = Math.min(txBits.length, rxBits.length);
  if (!total) return { errors: 0, total: 0, rate: 0 };
  let errors = 0;
  for (let i = 0; i < total; i += 1) {
    if (txBits[i] !== rxBits[i]) errors += 1;
  }
  return { errors, total, rate: errors / total };
}

export function computeSymbolErrorRate(txSyms, rxSyms) {
  const total = Math.min(txSyms.length, rxSyms.length);
  if (!total) return { errors: 0, total: 0, rate: 0 };
  let errors = 0;
  for (let i = 0; i < total; i += 1) {
    if (txSyms[i] !== rxSyms[i]) errors += 1;
  }
  return { errors, total, rate: errors / total };
}

export function computeCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  const ac = a.slice(0, n);
  const bc = b.slice(0, n);
  const meanA = ac.reduce((sum, x) => sum + x, 0) / n;
  const meanB = bc.reduce((sum, x) => sum + x, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = ac[i] - meanA;
    const db = bc[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  return num / Math.max(1e-9, Math.sqrt(denA * denB));
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function symbolSamplesForScheme(schemeId, bitSamples) {
  if (schemeId === "qpsk") return bitSamples * 2;
  if (schemeId === "qam16") return bitSamples * 4;
  return bitSamples;
}

export function estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples) {
  const model = params.receiverModel || "manual";
  let receiverFc = params.receiverFc;
  let receiverPhase = params.receiverPhase;
  let timingOffset = 0;

  if (!rxSignal.length || !t.length) {
    return { receiverFc, receiverPhase, timingOffset };
  }

  const sampleLimit = Math.min(rxSignal.length, Math.max(128, bitSamples * 64));
  if (model === "pll" && sampleLimit > 16) {
    let sumI = 0;
    let sumQ = 0;
    let sum2Re = 0;
    let sum2Im = 0;
    let sum4Re = 0;
    let sum4Im = 0;

    for (let i = 0; i < sampleLimit; i += 1) {
      const theta = 2 * Math.PI * receiverFc * t[i] + receiverPhase;
      const iComp = rxSignal[i] * Math.cos(theta);
      const qComp = -rxSignal[i] * Math.sin(theta);
      sumI += iComp;
      sumQ += qComp;

      const re2 = iComp * iComp - qComp * qComp;
      const im2 = 2 * iComp * qComp;
      sum2Re += re2;
      sum2Im += im2;
      sum4Re += re2 * re2 - im2 * im2;
      sum4Im += 2 * re2 * im2;
    }

    let phaseError = Math.atan2(sumQ, sumI);
    if (schemeId === "bpsk") {
      phaseError = 0.5 * Math.atan2(sum2Im, sum2Re);
    } else if (schemeId === "qpsk" || schemeId === "qam16") {
      phaseError = 0.25 * Math.atan2(sum4Im, sum4Re);
    }
    receiverPhase += 0.85 * phaseError;

    const filterWindow = Math.max(3, Math.floor(bitSamples / 5));
    const { i, q } = coherentIQ(
      rxSignal.slice(0, sampleLimit),
      t.slice(0, sampleLimit),
      receiverFc,
      receiverPhase,
      filterWindow,
    );
    const instPhase = unwrapPhase(i.map((ival, idx) => Math.atan2(q[idx], ival)));
    if (instPhase.length > 10) {
      const phaseSteps = [];
      for (let idx = 1; idx < instPhase.length; idx += 1) {
        const step = instPhase[idx] - instPhase[idx - 1];
        if (Math.abs(step) < Math.PI / 2) {
          phaseSteps.push(step);
        }
      }
      if (phaseSteps.length > 4) {
        const meanStep = phaseSteps.reduce((acc, step) => acc + step, 0) / phaseSteps.length;
        const modulationOrder =
          schemeId === "bpsk" ? 2 : (schemeId === "qpsk" || schemeId === "qam16" ? 4 : 1);
        const freqErrorHz = (meanStep * SAMPLE_RATE) / (2 * Math.PI * modulationOrder);
        receiverFc += clampValue(freqErrorHz, -80, 80);
      }
    }
  }

  if (params.timingRecovery) {
    const symbolSamples = symbolSamplesForScheme(schemeId, bitSamples);
    const evalLen = Math.min(rxSignal.length, symbolSamples * 128);
    let bestOffset = 0;
    let bestScore = -Infinity;
    for (let offset = 0; offset < symbolSamples; offset += 1) {
      let energy = 0;
      let count = 0;
      for (let idx = offset; idx < evalLen; idx += symbolSamples) {
        energy += Math.abs(rxSignal[idx]);
        count += 1;
      }
      const score = energy / Math.max(1, count);
      if (score > bestScore) {
        bestScore = score;
        bestOffset = offset;
      }
    }
    timingOffset = bestOffset;
  }

  return { receiverFc, receiverPhase, timingOffset };
}

export function generateAnalog(t, params, schemeId, baseband) {
  const mn = baseband.map((x) => x / Math.max(1e-9, Math.max(...baseband.map(Math.abs))));
  const txSignal = new Array(t.length).fill(0);
  const demodulated = new Array(t.length).fill(0);

  if (schemeId === "am_dsb_lc") {
    for (let i = 0; i < t.length; i += 1) {
      txSignal[i] =
        params.carrierAmp *
        (1 + params.modIndex * mn[i]) *
        Math.cos(2 * Math.PI * params.carrierFreq * t[i]);
    }
  } else if (schemeId === "am_dsb_sc") {
    for (let i = 0; i < t.length; i += 1) {
      txSignal[i] =
        params.carrierAmp * mn[i] * Math.cos(2 * Math.PI * params.carrierFreq * t[i]);
    }
  } else if (schemeId === "fm") {
    const dt = 1 / SAMPLE_RATE;
    let integral = 0;
    for (let i = 0; i < t.length; i += 1) {
      integral += mn[i] * dt;
      const phase =
        2 * Math.PI * params.carrierFreq * t[i] + 2 * Math.PI * params.freqDev * integral;
      txSignal[i] = params.carrierAmp * Math.cos(phase);
    }
  } else if (schemeId === "pm") {
    for (let i = 0; i < t.length; i += 1) {
      txSignal[i] =
        params.carrierAmp *
        Math.cos(2 * Math.PI * params.carrierFreq * t[i] + params.modIndex * mn[i]);
    }
  }

  const rxSignal = applyChannel(txSignal, t, params.channel);

  if (schemeId === "am_dsb_lc") {
    const env = movingAverage(
      rxSignal.map((v) => Math.abs(v)),
      Math.max(3, Math.floor(SAMPLE_RATE / (params.messageFreq * 4.5))),
    );
    const dc = env.reduce((sum, v) => sum + v, 0) / env.length;
    for (let i = 0; i < t.length; i += 1) {
      demodulated[i] = env[i] - dc;
    }
  } else if (schemeId === "am_dsb_sc") {
    const mixed = rxSignal.map(
      (v, i) => 2 * v * Math.cos(2 * Math.PI * params.receiverFc * t[i] + params.receiverPhase),
    );
    const filtered = movingAverage(
      mixed,
      Math.max(3, Math.floor(SAMPLE_RATE / (params.messageFreq * 4))),
    );
    for (let i = 0; i < t.length; i += 1) {
      demodulated[i] = filtered[i];
    }
  } else if (schemeId === "fm") {
    const { i, q } = coherentIQ(
      rxSignal,
      t,
      params.receiverFc,
      params.receiverPhase,
      Math.max(5, Math.floor(SAMPLE_RATE / (params.messageFreq * 6))),
    );
    const phase = unwrapPhase(i.map((ival, idx) => Math.atan2(q[idx], ival)));
    for (let k = 1; k < phase.length; k += 1) {
      const fInst = ((phase[k] - phase[k - 1]) * SAMPLE_RATE) / (2 * Math.PI);
      demodulated[k] = (fInst - params.receiverFc) / Math.max(1, params.freqDev);
    }
  } else if (schemeId === "pm") {
    const { i, q } = coherentIQ(
      rxSignal,
      t,
      params.receiverFc,
      params.receiverPhase,
      Math.max(5, Math.floor(SAMPLE_RATE / (params.messageFreq * 6))),
    );
    const phase = unwrapPhase(i.map((ival, idx) => Math.atan2(q[idx], ival)));
    for (let k = 0; k < phase.length; k += 1) {
      demodulated[k] =
        (phase[k] - 2 * Math.PI * params.receiverFc * t[k]) / Math.max(1e-9, params.modIndex);
    }
  }

  return {
    baseband,
    txSignal,
    rxSignal,
    demodulated,
    constellation: [],
    txBits: [],
    rxBits: [],
    txSymbols: [],
    rxSymbols: [],
  };
}

export function generateDigital(t, params, schemeId, bitPool, levelToBitsMap) {
  const bitSamples = Math.max(4, Math.floor(SAMPLE_RATE / params.bitRate));
  const bitCount = Math.max(16, Math.floor(t.length / bitSamples));
  const neededBits = bitCount * 4 + 32;
  const sourceBits = bitPool && bitPool.length >= neededBits ? bitPool : randomBits(neededBits + 64);

  const txBits = [];
  const rxBits = [];
  const txSymbols = [];
  const rxSymbols = [];

  const txSignal = new Array(t.length).fill(0);
  const demodulated = new Array(t.length).fill(0);
  const constellation = [];
  const baseband = bitsToWaveform(sourceBits.slice(0, bitCount), bitSamples).slice(0, t.length);

  if (schemeId === "ask") {
    for (let i = 0; i < t.length; i += 1) {
      const b = sourceBits[Math.floor(i / bitSamples)] ?? 0;
      const amp = 0.2 + 0.8 * b;
      txSignal[i] = params.carrierAmp * amp * Math.cos(2 * Math.PI * params.carrierFreq * t[i]);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);
    const receiver = estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples);
    const comps = [];

    for (let b = 0; b < bitCount; b += 1) {
      const start = receiver.timingOffset + b * bitSamples;
      if (start >= t.length) break;
      const end = Math.min(start + bitSamples, t.length);
      const iComp =
        (2 / Math.max(1, end - start)) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.cos(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
        );
      const qComp =
        (-2 / Math.max(1, end - start)) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.sin(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
        );
      comps.push(iComp);
      constellation.push({ i: iComp, q: qComp });
      txBits.push(sourceBits[b]);
      txSymbols.push(String(sourceBits[b]));
    }

    const threshold = (Math.max(...comps) + Math.min(...comps)) / 2;

    for (let b = 0; b < comps.length; b += 1) {
      const start = receiver.timingOffset + b * bitSamples;
      const end = Math.min(start + bitSamples, t.length);
      const detected = comps[b] > threshold ? 1 : 0;
      rxBits.push(detected);
      rxSymbols.push(String(detected));
      for (let i = start; i < end; i += 1) demodulated[i] = detected ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  if (schemeId === "fsk") {
    const f0 = params.carrierFreq - params.freqDev / 2;
    const f1 = params.carrierFreq + params.freqDev / 2;

    for (let i = 0; i < t.length; i += 1) {
      const b = sourceBits[Math.floor(i / bitSamples)] ?? 0;
      txSignal[i] = params.carrierAmp * Math.cos(2 * Math.PI * (b ? f1 : f0) * t[i]);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);
    const receiver = estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples);
    const rf0 = receiver.receiverFc - params.freqDev / 2;
    const rf1 = receiver.receiverFc + params.freqDev / 2;

    for (let b = 0; b < bitCount; b += 1) {
      const start = receiver.timingOffset + b * bitSamples;
      if (start >= t.length) break;
      const end = Math.min(start + bitSamples, t.length);
      const c0 = integrateSegment(rxSignal, start, end, (i) => Math.cos(2 * Math.PI * rf0 * t[i]));
      const c1 = integrateSegment(rxSignal, start, end, (i) => Math.cos(2 * Math.PI * rf1 * t[i]));
      const detected = c1 > c0 ? 1 : 0;
      txBits.push(sourceBits[b]);
      rxBits.push(detected);
      txSymbols.push(String(sourceBits[b]));
      rxSymbols.push(String(detected));
      constellation.push({ i: c1, q: c0 });
      for (let i = start; i < end; i += 1) demodulated[i] = detected ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  if (schemeId === "bpsk") {
    for (let i = 0; i < t.length; i += 1) {
      const b = sourceBits[Math.floor(i / bitSamples)] ?? 0;
      const phase = b ? 0 : Math.PI;
      txSignal[i] = params.carrierAmp * Math.cos(2 * Math.PI * params.carrierFreq * t[i] + phase);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);
    const receiver = estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples);

    for (let b = 0; b < bitCount; b += 1) {
      const start = receiver.timingOffset + b * bitSamples;
      if (start >= t.length) break;
      const end = Math.min(start + bitSamples, t.length);
      const corr = integrateSegment(rxSignal, start, end, (i) =>
        Math.cos(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
      );
      const detected = corr >= 0 ? 1 : 0;
      txBits.push(sourceBits[b]);
      rxBits.push(detected);
      txSymbols.push(String(sourceBits[b]));
      rxSymbols.push(String(detected));
      constellation.push({ i: corr, q: 0 });
      for (let i = start; i < end; i += 1) demodulated[i] = detected ? 1 : -1;
    }

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  if (schemeId === "qpsk") {
    const symbolSamples = bitSamples * 2;
    const symbolCount = Math.max(8, Math.floor(t.length / symbolSamples));
    const phaseMap = {
      "00": Math.PI / 4,
      "01": (3 * Math.PI) / 4,
      "11": (-3 * Math.PI) / 4,
      "10": -Math.PI / 4,
    };

    for (let sym = 0; sym < symbolCount; sym += 1) {
      const b1 = sourceBits[2 * sym] ?? 0;
      const b0 = sourceBits[2 * sym + 1] ?? 0;
      const phase = phaseMap[`${b1}${b0}`];
      const start = sym * symbolSamples;
      const end = Math.min(start + symbolSamples, t.length);

      for (let i = start; i < end; i += 1) {
        txSignal[i] = params.carrierAmp * Math.cos(2 * Math.PI * params.carrierFreq * t[i] + phase);
      }

      txBits.push(b1, b0);
      txSymbols.push(`${b1}${b0}`);
    }

    const rxSignal = applyChannel(txSignal, t, params.channel);
    const receiver = estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples);

    for (let sym = 0; sym < symbolCount; sym += 1) {
      const start = receiver.timingOffset + sym * symbolSamples;
      if (start >= t.length) break;
      const end = Math.min(start + symbolSamples, t.length);
      const len = Math.max(1, end - start);
      const iComp =
        (2 / len) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.cos(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
        );
      const qComp =
        (-2 / len) *
        integrateSegment(rxSignal, start, end, (i) =>
          Math.sin(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
        );
      const [b1, b0] = decodeQpskQuadrant(iComp, qComp);
      rxBits.push(b1, b0);
      rxSymbols.push(`${b1}${b0}`);
      constellation.push({ i: iComp, q: qComp });
      for (let i = start; i < end; i += 1) demodulated[i] = b1 ? 1 : -1;
    }

    txBits.length = rxSymbols.length * 2;
    txSymbols.length = rxSymbols.length;

    return {
      baseband,
      txSignal,
      rxSignal,
      demodulated,
      constellation,
      txBits,
      rxBits,
      txSymbols,
      rxSymbols,
    };
  }

  const symbolSamples = bitSamples * 4;
  const symbolCount = Math.max(6, Math.floor(t.length / symbolSamples));
  const norm = 1 / Math.sqrt(10);

  for (let sym = 0; sym < symbolCount; sym += 1) {
    const b1 = sourceBits[4 * sym] ?? 0;
    const b0 = sourceBits[4 * sym + 1] ?? 0;
    const b3 = sourceBits[4 * sym + 2] ?? 0;
    const b2 = sourceBits[4 * sym + 3] ?? 0;

    const iLevel = map2BitsToLevel(b1, b0);
    const qLevel = map2BitsToLevel(b3, b2);
    const iAmp = iLevel * norm;
    const qAmp = qLevel * norm;

    const start = sym * symbolSamples;
    const end = Math.min(start + symbolSamples, t.length);
    for (let i = start; i < end; i += 1) {
      txSignal[i] =
        params.carrierAmp *
        (iAmp * Math.cos(2 * Math.PI * params.carrierFreq * t[i]) -
          qAmp * Math.sin(2 * Math.PI * params.carrierFreq * t[i]));
    }

    txBits.push(b1, b0, b3, b2);
    txSymbols.push(`${iLevel},${qLevel}`);
  }

  const rxSignal = applyChannel(txSignal, t, params.channel);
  const receiver = estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples);

  for (let sym = 0; sym < symbolCount; sym += 1) {
    const start = receiver.timingOffset + sym * symbolSamples;
    if (start >= t.length) break;
    const end = Math.min(start + symbolSamples, t.length);
    const len = Math.max(1, end - start);

    const iComp =
      (2 / len) *
      integrateSegment(rxSignal, start, end, (i) =>
        Math.cos(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
      ) /
      Math.max(1e-9, params.carrierAmp);

    const qComp =
      (-2 / len) *
      integrateSegment(rxSignal, start, end, (i) =>
        Math.sin(2 * Math.PI * receiver.receiverFc * t[i] + receiver.receiverPhase),
      ) /
      Math.max(1e-9, params.carrierAmp);

    const iHat = quantizeLevel(iComp / norm);
    const qHat = quantizeLevel(qComp / norm);
    const iBits = levelToBitsMap[String(iHat)] || [0, 0];
    const qBits = levelToBitsMap[String(qHat)] || [0, 0];

    rxBits.push(iBits[0], iBits[1], qBits[0], qBits[1]);
    rxSymbols.push(`${iHat},${qHat}`);
    constellation.push({ i: iComp / norm, q: qComp / norm });

    for (let i = start; i < end; i += 1) demodulated[i] = iHat > 0 ? 1 : -1;
  }

  txBits.length = rxSymbols.length * 4;
  txSymbols.length = rxSymbols.length;

  return {
    baseband,
    txSignal,
    rxSignal,
    demodulated,
    constellation,
    txBits,
    rxBits,
    txSymbols,
    rxSymbols,
  };
}
