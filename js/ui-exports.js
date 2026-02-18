import { nowStamp } from './utils.js';
import { trackFunctionalEvent } from './analytics.js';

const FORMULA_INJECTION_CHARS = /^[=+\-@]/;

function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (FORMULA_INJECTION_CHARS.test(str)) {
    return `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function safeCanvasContext(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  try {
    return canvas.getContext('2d');
  } catch (_e) {
    return null;
  }
}

export function exportCurrentCsv(lastRenderData, setStatus) {
  if (!lastRenderData) {
    setStatus('error', 'Nothing to export yet. Run a simulation first.');
    return;
  }

  const { time, primary, compare } = lastRenderData;
  if (!time || !time.length || !primary) {
    setStatus('error', 'Invalid render data. Run a simulation again.');
    return;
  }

  const headers = [
    'time_s',
    'primary_baseband',
    'primary_rx',
    'primary_demod',
    'compare_baseband',
    'compare_rx',
    'compare_demod',
  ];

  const rows = [headers.join(',')];
  for (let i = 0; i < time.length; i += 1) {
    const row = [
      sanitizeCsvCell(time[i]),
      sanitizeCsvCell(primary.baseband[i]),
      sanitizeCsvCell(primary.rxSignal[i]),
      sanitizeCsvCell(primary.demodulated[i]),
      sanitizeCsvCell(compare ? compare.baseband[i] : ''),
      sanitizeCsvCell(compare ? compare.rxSignal[i] : ''),
      sanitizeCsvCell(compare ? compare.demodulated[i] : ''),
    ];
    rows.push(row.join(','));
  }

  try {
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modulation-signals-${nowStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('success', 'CSV exported.');
    trackFunctionalEvent('export_csv');
  } catch (_e) {
    setStatus('error', 'Failed to create CSV export.');
  }
}

export function exportCurrentPng(lastRenderData, els, setStatus) {
  if (!lastRenderData) {
    setStatus('error', 'Nothing to export yet. Run a simulation first.');
    return;
  }

  if (!els) {
    setStatus('error', 'UI elements not available.');
    return;
  }

  const blocks = [
    { title: 'Baseband', canvas: els.basebandCanvas },
    { title: 'Received', canvas: els.modulatedCanvas },
    { title: 'Demodulated', canvas: els.demodulatedCanvas },
    { title: 'Spectrum', canvas: els.spectrumCanvas },
  ];

  if (els.constellationPanel && els.constellationPanel.style.display !== 'none') {
    blocks.push({ title: 'Constellation', canvas: els.constellationCanvas });
  }

  const validBlocks = blocks.filter((b) => b.canvas && safeCanvasContext(b.canvas));
  if (!validBlocks.length) {
    setStatus('error', 'No valid canvases available for export.');
    return;
  }

  const cols = 2;
  const rows = Math.ceil(validBlocks.length / cols);
  const tileW = 760;
  const tileH = 310;
  const pad = 20;
  const header = 70;

  const out = document.createElement('canvas');
  out.width = cols * tileW + (cols + 1) * pad;
  out.height = header + rows * tileH + (rows + 1) * pad;
  const ctx = safeCanvasContext(out);
  if (!ctx) {
    setStatus('error', 'Failed to create export canvas.');
    return;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = '#102446';
  ctx.font = '600 28px Space Grotesk, sans-serif';
  ctx.fillText('Modulation Studio Export', pad, 38);
  ctx.fillStyle = '#4f5e7f';
  ctx.font = '15px IBM Plex Sans, sans-serif';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, pad, 60);

  validBlocks.forEach((block, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = pad + col * (tileW + pad);
    const y = header + pad + row * (tileH + pad);

    ctx.fillStyle = '#f7faff';
    ctx.fillRect(x, y, tileW, tileH);
    ctx.strokeStyle = '#d8e3f6';
    ctx.strokeRect(x, y, tileW, tileH);

    ctx.fillStyle = '#17325f';
    ctx.font = '600 17px Space Grotesk, sans-serif';
    ctx.fillText(block.title, x + 12, y + 24);

    try {
      const canvasWidth = block.canvas.width || tileW - 24;
      const canvasHeight = block.canvas.height || tileH - 48;
      ctx.drawImage(block.canvas, x + 12, y + 36, canvasWidth, canvasHeight);
    } catch (_e) {
      ctx.fillStyle = '#999999';
      ctx.font = '12px IBM Plex Sans, sans-serif';
      ctx.fillText('Canvas unavailable', x + 12, y + 60);
    }
  });

  try {
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `modulation-plots-${nowStamp()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus('success', 'PNG exported.');
    trackFunctionalEvent('export_png');
  } catch (_e) {
    setStatus('error', 'Failed to create PNG export.');
  }
}
