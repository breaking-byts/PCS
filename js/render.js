import { computeSpectrum, normalize } from './utils.js';
import { colors, SAMPLE_RATE } from './config.js';

function getCanvasContext(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const width = canvas.width || 0;
    const height = canvas.height || 0;
    if (width <= 0 || height <= 0) return null;
    return ctx;
  } catch (_e) {
    return null;
  }
}

function safeCanvasDimensions(canvas) {
  if (!canvas) return { width: 0, height: 0 };
  const width = Math.max(1, Math.floor(canvas.width) || 1);
  const height = Math.max(1, Math.floor(canvas.height) || 1);
  return { width, height };
}

export function drawLinePlot(canvas, series) {
  const ctx = getCanvasContext(canvas);
  if (!ctx || !canvas) return;
  const { width, height } = safeCanvasDimensions(canvas);
  const valid = Array.isArray(series)
    ? series.filter((entry) => entry && entry.data && entry.data.length > 1)
    : [];
  ctx.clearRect(0, 0, width, height);
  const pad = 22;

  ctx.strokeStyle = "#1f2b1f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height / 2);
  ctx.lineTo(width - pad, height / 2);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.stroke();

  if (!valid.length) return;

  const values = valid
    .flatMap((entry) => entry.data)
    .filter((value) => Number.isFinite(value));
  if (!values.length) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);

  valid.forEach((entry) => {
    if (!entry.data || entry.data.length < 2) return;
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    let hasMoved = false;
    entry.data.forEach((y, idx) => {
      if (!Number.isFinite(y)) return;
      const xPix = pad + (idx / (entry.data.length - 1)) * (width - 2 * pad);
      const yPix = height - pad - ((y - min) / span) * (height - 2 * pad);
      if (!hasMoved) {
        ctx.moveTo(xPix, yPix);
        hasMoved = true;
      } else {
        ctx.lineTo(xPix, yPix);
      }
    });
    if (hasMoved) ctx.stroke();
  });
}

export function drawXYPlot(canvas, xList, yList, colorsList) {
  const ctx = getCanvasContext(canvas);
  if (!ctx || !canvas) return;
  const { width, height } = safeCanvasDimensions(canvas);
  ctx.clearRect(0, 0, width, height);
  const pad = 22;

  ctx.strokeStyle = "#1f2b1f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.stroke();

  if (!xList || !yList || !xList.length || !yList.length) return;
  if (xList.length !== yList.length) return;

  const validPairs = xList
    .map((x, i) => ({ x, y: yList[i], color: colorsList[i] }))
    .filter((pair) => pair.x && pair.y && pair.x.length > 0 && pair.y.length > 0);

  if (!validPairs.length) return;

  const xMin = Math.min(...validPairs.flatMap((p) => p.x).filter(Number.isFinite));
  const xMax = Math.max(...validPairs.flatMap((p) => p.x).filter(Number.isFinite));
  const yMin = Math.min(...validPairs.flatMap((p) => p.y).filter(Number.isFinite));
  const yMax = Math.max(...validPairs.flatMap((p) => p.y).filter(Number.isFinite));

  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) return;

  const xSpan = Math.max(1e-9, xMax - xMin);
  const ySpan = Math.max(1e-9, yMax - yMin);

  validPairs.forEach((pair) => {
    const { x: xVals, y: yVals, color } = pair;
    if (xVals.length !== yVals.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    let hasMoved = false;
    xVals.forEach((xVal, idx) => {
      if (!Number.isFinite(xVal) || !Number.isFinite(yVals[idx])) return;
      const px = pad + ((xVal - xMin) / xSpan) * (width - 2 * pad);
      const py = height - pad - ((yVals[idx] - yMin) / ySpan) * (height - 2 * pad);
      if (!hasMoved) {
        ctx.moveTo(px, py);
        hasMoved = true;
      } else {
        ctx.lineTo(px, py);
      }
    });
    if (hasMoved) ctx.stroke();
  });
}

export function drawConstellation(canvas, groups) {
  const ctx = getCanvasContext(canvas);
  if (!ctx || !canvas) return;
  const { width, height } = safeCanvasDimensions(canvas);
  const pad = 24;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#1f2b1f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, pad);
  ctx.lineTo(width / 2, height - pad);
  ctx.moveTo(pad, height / 2);
  ctx.lineTo(width - pad, height / 2);
  ctx.stroke();

  const normalizedGroups = Array.isArray(groups) ? groups : [];
  const flat = normalizedGroups.flatMap((g) => g.points || []);
  if (!flat.length) {
    ctx.fillStyle = "#7aa57a";
    ctx.font = "13px JetBrains Mono, monospace";
    ctx.fillText("// constellation available for digital schemes", 34, height / 2);
    return;
  }

  const maxAbs = Math.max(1, ...flat.map((p) => Math.max(Math.abs(p.i), Math.abs(p.q))));

  normalizedGroups.forEach((group) => {
    ctx.fillStyle = group.color;
    (group.points || []).forEach((p) => {
      const x = width / 2 + (p.i / maxAbs) * (width / 2 - pad - 8);
      const y = height / 2 - (p.q / maxAbs) * (height / 2 - pad - 8);
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
}

export function renderPlots(cvs, data, primaryScheme, compareScheme) {
  if (!cvs || !data || !data.primary) return false;

  const basebandCanvas = cvs.basebandCanvas;
  const modulatedCanvas = cvs.modulatedCanvas;
  const demodulatedCanvas = cvs.demodulatedCanvas;
  const spectrumCanvas = cvs.spectrumCanvas;
  const constellationCanvas = cvs.constellationCanvas;

  if (!basebandCanvas || !modulatedCanvas || !demodulatedCanvas || !spectrumCanvas || !constellationCanvas) {
    return false;
  }

  drawLinePlot(basebandCanvas, [
    { data: normalize(data.primary.baseband || []), color: colors.primaryBase },
    ...(data.compare
      ? [{ data: normalize(data.compare.baseband || []), color: colors.compareBase }]
      : []),
  ]);

  drawLinePlot(modulatedCanvas, [
    { data: normalize(data.primary.rxSignal || []), color: colors.primaryRx },
    ...(data.compare
      ? [{ data: normalize(data.compare.rxSignal || []), color: colors.compareRx }]
      : []),
  ]);

  drawLinePlot(demodulatedCanvas, [
    { data: normalize(data.primary.demodulated || []), color: colors.primaryDemod },
    ...(data.compare
      ? [{ data: normalize(data.compare.demodulated || []), color: colors.compareDemod }]
      : []),
  ]);

  const primaryRx = data.primary.rxSignal || [];
  const primarySpectrum = primaryRx.length > 1 ? computeSpectrum(primaryRx, SAMPLE_RATE) : { freq: [], magDb: [] };
  const xList = [primarySpectrum.freq];
  const yList = [primarySpectrum.magDb];
  const cList = [colors.spectrumPrimary];
  if (data.compare && data.compare.rxSignal && data.compare.rxSignal.length > 1) {
    const compareSpectrum = computeSpectrum(data.compare.rxSignal, SAMPLE_RATE);
    xList.push(compareSpectrum.freq);
    yList.push(compareSpectrum.magDb);
    cList.push(colors.spectrumCompare);
  }
  drawXYPlot(spectrumCanvas, xList, yList, cList);

  const constellationGroups = [];
  if (primaryScheme && primaryScheme.digital) {
    constellationGroups.push({ color: colors.constellationPrimary, points: data.primary.constellation || [] });
  }
  if (compareScheme && compareScheme.digital && data.compare) {
    constellationGroups.push({ color: colors.constellationCompare, points: data.compare.constellation || [] });
  }
  drawConstellation(constellationCanvas, constellationGroups);

  return constellationGroups.length > 0;
}
