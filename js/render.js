import { computeSpectrum, normalize } from './utils.js';
import { colors } from './config.js';

export function drawLinePlot(canvas, series) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const valid = series.filter((entry) => entry.data.length > 1);
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

  const values = valid.flatMap((entry) => entry.data);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);

  valid.forEach((entry) => {
    ctx.strokeStyle = entry.color;
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    entry.data.forEach((y, idx) => {
      const xPix = pad + (idx / (entry.data.length - 1)) * (width - 2 * pad);
      const yPix = height - pad - ((y - min) / span) * (height - 2 * pad);
      if (idx === 0) ctx.moveTo(xPix, yPix);
      else ctx.lineTo(xPix, yPix);
    });
    ctx.stroke();
  });
}

export function drawXYPlot(canvas, xList, yList, colorsList) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
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

  if (!xList.length) return;

  const xMin = Math.min(...xList.map((x) => x[0]));
  const xMax = Math.max(...xList.map((x) => x[x.length - 1]));
  const yMin = Math.min(...yList.flatMap((y) => y));
  const yMax = Math.max(...yList.flatMap((y) => y));
  const xSpan = Math.max(1e-9, xMax - xMin);
  const ySpan = Math.max(1e-9, yMax - yMin);

  xList.forEach((xVals, p) => {
    const yVals = yList[p];
    ctx.strokeStyle = colorsList[p];
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    xVals.forEach((xVal, idx) => {
      const px = pad + ((xVal - xMin) / xSpan) * (width - 2 * pad);
      const py = height - pad - ((yVals[idx] - yMin) / ySpan) * (height - 2 * pad);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });
}

export function drawConstellation(canvas, groups) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
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

  const flat = groups.flatMap((g) => g.points);
  if (!flat.length) {
    ctx.fillStyle = "#7aa57a";
    ctx.font = "13px JetBrains Mono, monospace";
    ctx.fillText("// constellation available for digital schemes", 34, height / 2);
    return;
  }

  const maxAbs = Math.max(1, ...flat.map((p) => Math.max(Math.abs(p.i), Math.abs(p.q))));

  groups.forEach((group) => {
    ctx.fillStyle = group.color;
    group.points.forEach((p) => {
      const x = width / 2 + (p.i / maxAbs) * (width / 2 - pad - 8);
      const y = height / 2 - (p.q / maxAbs) * (height / 2 - pad - 8);
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
}

export function renderPlots(cvs, data, primaryScheme, compareScheme, compareActive) {
  drawLinePlot(cvs.basebandCanvas, [
    { data: normalize(data.primary.baseband), color: colors.primaryBase },
    ...(data.compare
      ? [{ data: normalize(data.compare.baseband), color: colors.compareBase }]
      : []),
  ]);

  drawLinePlot(cvs.modulatedCanvas, [
    { data: normalize(data.primary.rxSignal), color: colors.primaryRx },
    ...(data.compare
      ? [{ data: normalize(data.compare.rxSignal), color: colors.compareRx }]
      : []),
  ]);

  drawLinePlot(cvs.demodulatedCanvas, [
    { data: normalize(data.primary.demodulated), color: colors.primaryDemod },
    ...(data.compare
      ? [{ data: normalize(data.compare.demodulated), color: colors.compareDemod }]
      : []),
  ]);

  const primarySpectrum = computeSpectrum(data.primary.rxSignal, 8000);
  const xList = [primarySpectrum.freq];
  const yList = [primarySpectrum.magDb];
  const cList = [colors.spectrumPrimary];
  if (data.compare) {
    const compareSpectrum = computeSpectrum(data.compare.rxSignal, 8000);
    xList.push(compareSpectrum.freq);
    yList.push(compareSpectrum.magDb);
    cList.push(colors.spectrumCompare);
  }
  drawXYPlot(cvs.spectrumCanvas, xList, yList, cList);

  const constellationGroups = [];
  if (primaryScheme.digital) {
    constellationGroups.push({ color: colors.constellationPrimary, points: data.primary.constellation });
  }
  if (compareScheme?.digital) {
    constellationGroups.push({ color: colors.constellationCompare, points: data.compare.constellation });
  }
  drawConstellation(cvs.constellationCanvas, constellationGroups);

  return constellationGroups.length > 0;
}
