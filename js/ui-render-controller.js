import { allSchemes, basebandSignals, SAMPLE_RATE } from './config.js';
import { renderLatexInto, clamp, formatHz, linspace, normalize } from './utils.js';
import {
  generateAnalog,
  generateDigital,
  randomBits,
  computeBitErrorRate,
  computeSymbolErrorRate,
  computeCorrelation,
  setRngSeed,
  getRngSeed,
  isDeterministic,
} from './signal.js';
import { renderPlots } from './render.js';

function getSchemeById(id) {
  return allSchemes.find((scheme) => scheme.id === id);
}

function getRenderParams(els) {
  const carrierFreq = clamp(Number(els.carrierFreq.value), 20, 2200);
  const messageFreq = clamp(Number(els.messageFreq.value), 1, 500);
  const carrierAmp = clamp(Number(els.carrierAmp.value), 0.2, 5);
  const messageAmp = clamp(Number(els.messageAmp.value), 0.1, 5);
  const modIndex = clamp(Number(els.modIndex.value), 0.1, 5);
  const freqDev = clamp(Number(els.freqDev.value), 1, 600);
  const bitRate = clamp(Number(els.bitRate.value), 10, 2000);
  const duration = clamp(Number(els.duration.value), 0.02, 0.4);
  const snrDb = clamp(Number(els.snrDb.value), 0, 60);
  const fadingDepth = clamp(Number(els.fadingDepth.value), 0, 0.95);
  const rxCarrierOffset = clamp(Number(els.rxCarrierOffset.value), -300, 300);
  const rxPhaseOffset = clamp(Number(els.rxPhaseOffset.value), -180, 180);
  const receiverModel = els.receiverModel.value || 'manual';
  const timingRecovery = !!els.timingRecovery.checked;

  return {
    carrierFreq,
    messageFreq,
    carrierAmp,
    messageAmp,
    modIndex,
    freqDev,
    bitRate,
    duration,
    receiverFc: carrierFreq + rxCarrierOffset,
    receiverPhase: (rxPhaseOffset * Math.PI) / 180,
    receiverModel,
    timingRecovery,
    channel: {
      snrDb,
      fadingDepth,
    },
  };
}

function runScheme(scheme, t, params, basebandDef, sharedBits, levelToBitsMap) {
  if (scheme.digital) {
    return generateDigital(t, params, scheme.id, sharedBits, levelToBitsMap);
  }
  const baseband = t.map((time) => basebandDef.generator(time, params.messageAmp, params.messageFreq));
  return generateAnalog(t, params, scheme.id, baseband);
}

function estimateBandwidthHz(schemeId, params) {
  if (schemeId === 'am_dsb_lc' || schemeId === 'am_dsb_sc') {
    return 2 * params.messageFreq;
  }
  if (schemeId === 'fm') {
    return 2 * (params.freqDev + params.messageFreq);
  }
  if (schemeId === 'pm') {
    return 2 * (params.messageFreq * (1 + params.modIndex));
  }
  if (schemeId === 'ask' || schemeId === 'bpsk') {
    return 2 * params.bitRate;
  }
  if (schemeId === 'fsk') {
    return 2 * (params.freqDev + params.bitRate);
  }
  if (schemeId === 'qpsk') {
    return Math.max(1, params.bitRate);
  }
  if (schemeId === 'qam16') {
    return Math.max(1, params.bitRate / 2);
  }
  return params.messageFreq;
}

function formatMetricText(result, scheme) {
  if (scheme.digital) {
    const ber = computeBitErrorRate(result.txBits, result.rxBits);
    const ser = computeSymbolErrorRate(result.txSymbols, result.rxSymbols);
    return `BER ${ber.rate.toFixed(4)} (${ber.errors}/${ber.total}), SER ${ser.rate.toFixed(4)} (${ser.errors}/${ser.total})`;
  }

  const corr = computeCorrelation(normalize(result.baseband), normalize(result.demodulated));
  return `Correlation(baseband, demod): ${corr.toFixed(4)}`;
}

export function createRenderController({ els, setStatus, renderLegend }) {
  let renderFrameId = null;
  let lastRenderData = null;

  function performRender(levelToBitsMap) {
    try {
      const primaryScheme = getSchemeById(els.scheme.value);
      if (!primaryScheme) return;

      if (els.deterministicMode.checked) {
        const seed = Math.floor(clamp(Number(els.rngSeed.value), 0, 4294967295));
        setRngSeed(seed);
      } else {
        setRngSeed(null);
      }

      const params = getRenderParams(els);
      const t = linspace(params.duration, SAMPLE_RATE);
      const basebandDef = basebandSignals.find((b) => b.id === els.baseband.value) || basebandSignals[0];

      const compareActive = els.compareMode.checked;
      els.compareScheme.disabled = !compareActive;
      const compareScheme = compareActive ? getSchemeById(els.compareScheme.value) : null;

      const needSharedBits = primaryScheme.digital || compareScheme?.digital;
      const sharedBits = needSharedBits ? randomBits(10000) : null;

      const primary = runScheme(primaryScheme, t, params, basebandDef, sharedBits, levelToBitsMap);
      const compare = compareScheme ? runScheme(compareScheme, t, params, basebandDef, sharedBits, levelToBitsMap) : null;

      const digitalBasebandEq = 'm(t) = \\sum_k b(k) p(t-kT_b), \\quad b(k) \\in \\{0,1\\}';
      if (primaryScheme.digital) {
        renderLatexInto(els.basebandEq, digitalBasebandEq);
      } else {
        renderLatexInto(els.basebandEq, basebandDef.equation);
      }
      renderLatexInto(els.modEq, primaryScheme.modulationEq);
      renderLatexInto(els.demodEq, primaryScheme.demodEq);
      if (compareScheme) {
        renderLatexInto(els.compareModEq, compareScheme.modulationEq);
        renderLatexInto(els.compareDemodEq, compareScheme.demodEq);
      } else {
        els.compareModEq.textContent = 'N/A';
        els.compareDemodEq.textContent = 'N/A';
      }

      let metricsText = formatMetricText(primary, primaryScheme);
      if (isDeterministic()) {
        metricsText += ` | Seed: ${getRngSeed()}`;
      }
      els.primaryMetrics.textContent = metricsText;
      els.compareMetrics.textContent = compareScheme
        ? formatMetricText(compare, compareScheme)
        : 'Comparison disabled';

      const bwPrimary = estimateBandwidthHz(primaryScheme.id, params);
      let bwText = `Estimated Occupied BW: Primary ${formatHz(bwPrimary)}`;
      if (compareScheme) {
        const bwCompare = estimateBandwidthHz(compareScheme.id, params);
        bwText += ` | Compare ${formatHz(bwCompare)}`;
      }
      els.bandwidthEstimate.textContent = bwText;

      renderLegend(compareActive, primaryScheme, compareScheme);

      const hasConstellation = renderPlots(
        {
          basebandCanvas: els.basebandCanvas,
          modulatedCanvas: els.modulatedCanvas,
          demodulatedCanvas: els.demodulatedCanvas,
          spectrumCanvas: els.spectrumCanvas,
          constellationCanvas: els.constellationCanvas,
        },
        { primary, compare },
        primaryScheme,
        compareScheme,
      );

      els.constellationPanel.style.display = hasConstellation ? 'block' : 'none';

      lastRenderData = {
        time: t,
        primary,
        compare,
        primaryScheme,
        compareScheme,
        params,
        seed: getRngSeed(),
      };

      setStatus('success', 'Simulation updated.');
    } catch (err) {
      setStatus('error', `Render failed: ${err.message}`);
    }
  }

  function render(levelToBitsMap) {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
    }
    renderFrameId = requestAnimationFrame(() => {
      renderFrameId = null;
      performRender(levelToBitsMap);
    });
  }

  function getLastRenderData() {
    return lastRenderData;
  }

  return {
    render,
    getLastRenderData,
  };
}
