export function renderLatex(latex) {
  if (typeof katex === "undefined") return latex;
  try {
    const rendered = katex.renderToString(latex, { throwOnError: false, displayMode: false });
    return rendered.replace(/\sstyle=\"[^\"]*\"/g, "");
  } catch (_e) {
    return latex;
  }
}

export function renderLatexInto(element, latex) {
  if (!element) return;

  if (typeof katex === "undefined") {
    element.textContent = latex;
    return;
  }

  try {
    katex.render(latex, element, { throwOnError: false, displayMode: false, trust: false });
  } catch (_e) {
    element.textContent = latex;
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatHz(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MHz`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)} kHz`;
  return `${value.toFixed(2)} Hz`;
}

export function nowStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

export function linspace(duration, sampleRate) {
  const n = Math.max(64, Math.floor(duration * sampleRate));
  const t = new Array(n);
  for (let i = 0; i < n; i += 1) {
    t[i] = i / sampleRate;
  }
  return t;
}

export function normalize(signal) {
  if (!signal.length) return [];
  let maxAbs = 0;
  for (let i = 0; i < signal.length; i += 1) {
    maxAbs = Math.max(maxAbs, Math.abs(signal[i]));
  }
  if (maxAbs < 1e-9) return new Array(signal.length).fill(0);
  return signal.map((x) => x / maxAbs);
}

export function movingAverage(signal, windowSize) {
  const width = Math.max(1, Math.floor(windowSize));
  const out = new Array(signal.length).fill(0);
  let sum = 0;
  for (let i = 0; i < signal.length; i += 1) {
    sum += signal[i];
    if (i >= width) {
      sum -= signal[i - width];
    }
    out[i] = sum / Math.min(i + 1, width);
  }
  return out;
}

export function unwrapPhase(phase) {
  const out = [...phase];
  for (let i = 1; i < out.length; i += 1) {
    let delta = out[i] - out[i - 1];
    if (delta > Math.PI) out[i] -= 2 * Math.PI;
    if (delta < -Math.PI) out[i] += 2 * Math.PI;
    delta = out[i] - out[i - 1];
    if (delta > Math.PI) out[i] -= 2 * Math.PI;
    if (delta < -Math.PI) out[i] += 2 * Math.PI;
  }
  return out;
}

export function coherentIQ(signal, t, rxFc, rxPhase, lpfWindow) {
  const iRaw = signal.map((s, idx) => 2 * s * Math.cos(2 * Math.PI * rxFc * t[idx] + rxPhase));
  const qRaw = signal.map((s, idx) => -2 * s * Math.sin(2 * Math.PI * rxFc * t[idx] + rxPhase));
  return {
    i: movingAverage(iRaw, lpfWindow),
    q: movingAverage(qRaw, lpfWindow),
  };
}

export function nearestPowerOf2(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function bitReverse(index, bits) {
  let reversed = 0;
  for (let i = 0; i < bits; i += 1) {
    reversed = (reversed << 1) | ((index >> i) & 1);
  }
  return reversed;
}

function fftInPlace(real, imag) {
  const n = real.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error("fftInPlace requires a power-of-2 sample length.");
  }
  const bits = Math.round(Math.log2(n));

  for (let i = 0; i < n; i += 1) {
    const j = bitReverse(i, bits);
    if (j > i) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2;
    const step = (-2 * Math.PI) / len;

    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < half; j += 1) {
        const angle = j * step;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const k = i + j;
        const l = k + half;

        const tr = wr * real[l] - wi * imag[l];
        const ti = wr * imag[l] + wi * real[l];

        real[l] = real[k] - tr;
        imag[l] = imag[k] - ti;
        real[k] += tr;
        imag[k] += ti;
      }
    }
  }
}

export function computeSpectrum(signal, sampleRate) {
  if (signal.length < 2) {
    return { freq: [], magDb: [] };
  }

  const n = Math.min(512, nearestPowerOf2(signal.length));
  if (n < 2) {
    return { freq: [], magDb: [] };
  }

  const x = signal.slice(0, n).map((v, i) => {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    return v * w;
  });
  const real = x.slice();
  const imag = new Array(n).fill(0);
  fftInPlace(real, imag);

  const freq = [];
  const magDb = [];
  for (let k = 0; k < n / 2; k += 1) {
    const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / n;
    freq.push((k * sampleRate) / n);
    magDb.push(20 * Math.log10(mag + 1e-8));
  }
  return { freq, magDb };
}
