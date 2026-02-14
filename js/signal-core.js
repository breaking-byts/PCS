import { SAMPLE_RATE } from './config.js';
import { coherentIQ, unwrapPhase } from './utils.js';
import { random, gaussianRandom } from './rng.js';

export function signalPower(signal) {
  if (!signal.length) return 0;
  return signal.reduce((acc, x) => acc + x * x, 0) / signal.length;
}

export function applyChannel(signal, t, channel) {
  if (!Array.isArray(signal) || !signal.length) return [];
  const safeChannel = channel && typeof channel === 'object' ? channel : {};
  const fadingDepth = clampValue(
    Number.isFinite(safeChannel.fadingDepth) ? safeChannel.fadingDepth : 0,
    0,
    0.95,
  );
  const snrDb = Number.isFinite(safeChannel.snrDb) ? safeChannel.snrDb : 30;
  const fadeHz = 2;
  const faded = signal.map((s, idx) => {
    const time = Number.isFinite(t?.[idx]) ? t[idx] : idx / SAMPLE_RATE;
    const envelope =
      1 - fadingDepth +
      fadingDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * fadeHz * time));
    return s * envelope;
  });

  const pow = Math.max(1e-10, signalPower(faded));
  const snrLinear = Math.pow(10, snrDb / 10);
  const noiseVar = pow / Math.max(1e-9, snrLinear);
  const noiseStd = Math.sqrt(noiseVar);

  return faded.map((s) => s + noiseStd * gaussianRandom());
}

export function randomBits(count) {
  return Array.from({ length: count }, () => (random() > 0.5 ? 1 : 0));
}

export function bitsToWaveform(bits, bitSamples) {
  const out = [];
  bits.forEach((b) => {
    for (let i = 0; i < bitSamples; i += 1) out.push(b ? 1 : -1);
  });
  return out;
}

export function integrateSegment(signal, start, end, tone) {
  if (!Array.isArray(signal) || typeof tone !== 'function') return 0;
  const from = clampValue(Math.floor(start), 0, signal.length);
  const to = clampValue(Math.floor(end), 0, signal.length);
  if (to <= from) return 0;

  let sum = 0;
  for (let i = from; i < to; i += 1) {
    sum += signal[i] * tone(i);
  }
  return sum;
}

export function map2BitsToLevel(b1, b0) {
  const key = `${b1}${b0}`;
  if (key === '00') return -3;
  if (key === '01') return -1;
  if (key === '11') return 1;
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
  if (schemeId === 'qpsk') return bitSamples * 2;
  if (schemeId === 'qam16') return bitSamples * 4;
  return bitSamples;
}

export function estimateAdaptiveReceiverState(rxSignal, t, params, schemeId, bitSamples) {
  const model = params.receiverModel || 'manual';
  let receiverFc = params.receiverFc;
  let receiverPhase = params.receiverPhase;
  let timingOffset = 0;

  if (!rxSignal.length || !t.length) {
    return { receiverFc, receiverPhase, timingOffset };
  }

  const sampleLimit = Math.min(rxSignal.length, Math.max(128, bitSamples * 64));
  if (model === 'pll' && sampleLimit > 16) {
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
    if (schemeId === 'bpsk') {
      phaseError = 0.5 * Math.atan2(sum2Im, sum2Re);
    } else if (schemeId === 'qpsk' || schemeId === 'qam16') {
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
          schemeId === 'bpsk' ? 2 : (schemeId === 'qpsk' || schemeId === 'qam16' ? 4 : 1);
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
