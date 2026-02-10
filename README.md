# Modulation Studio

Deployable web application for visualizing analog and digital modulation, channel impairments, and demodulation recovery quality.

## What Is Included
- Modulation hierarchy under umbrella families:
  - Amplitude: AM DSB-LC, AM DSB-SC
  - Angle: FM, PM
  - Digital: ASK, FSK, BPSK, QPSK, 16-QAM
- Three baseband signal models with equations:
  - Sine: `m(t) = Am sin(2*pi*fm*t)`
  - Square: `m(t) = Am sgn(sin(2*pi*fm*t))`
  - Triangle: `m(t) = (2*Am/pi) asin(sin(2*pi*fm*t))`
- Per-scheme modulation and demodulation equations.
- Channel impairment model:
  - AWGN (SNR dB)
  - Fading depth
  - Receiver carrier/phase mismatch
- Visual outputs:
  - Baseband waveform
  - Received waveform
  - Demodulated waveform
  - FFT magnitude spectrum
  - Constellation plot (digital)
- Recovery metrics:
  - BER / SER for digital schemes
  - Correlation for analog schemes
- Side-by-side comparison mode.
- Scenario cards (curated lab presets).
- Save/load/delete custom presets in browser local storage.
- Export tools:
  - CSV signal dump
  - PNG composite of plots
- Modulation atlas section for quick learning/reference.

## Local Run
1. In `/Users/leelanshkharbanda/codex/PCS`, run:
   - `npm run dev`
2. Open `http://localhost:4173`.

You can also open `/Users/leelanshkharbanda/codex/PCS/index.html` directly.

## Deploy
- Netlify: `netlify.toml` included (publish `.`)
- Vercel: `vercel.json` included
- Generic static hosting: upload all project files as-is

Detailed steps are in `/Users/leelanshkharbanda/codex/PCS/DEPLOYMENT.md`.

## Main Files
- `/Users/leelanshkharbanda/codex/PCS/index.html`
- `/Users/leelanshkharbanda/codex/PCS/styles.css`
- `/Users/leelanshkharbanda/codex/PCS/app.js`
- `/Users/leelanshkharbanda/codex/PCS/package.json`
- `/Users/leelanshkharbanda/codex/PCS/netlify.toml`
- `/Users/leelanshkharbanda/codex/PCS/vercel.json`
