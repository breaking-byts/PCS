# Modulation Studio

A terminal-style web application for visualizing analog and digital signal modulation, channel impairments, and demodulation recovery.

**Live Demo:** [https://breaking-byts.github.io/Modulation-Studio/](https://breaking-byts.github.io/Modulation-Studio/)
<img width="1710" height="1112" alt="image" src="https://github.com/user-attachments/assets/c4023d38-b95d-401a-98df-1c06b4100522" />


## Features

### Modulation Schemes
- **Amplitude:** AM DSB-LC, AM DSB-SC
- **Angle:** FM, PM
- **Digital:** ASK, FSK, BPSK, QPSK, 16-QAM

### Baseband Signals
- Sine: `m(t) = Am sin(2πfm t)`
- Square: `m(t) = Am sgn(sin(2πfm t))`
- Triangle: `m(t) = (2Am/π) asin(sin(2πfm t))`

### Channel Impairments
- AWGN (adjustable SNR)
- Fading depth
- Receiver carrier/phase offset

### Visualizations
- Baseband waveform
- Received signal (after channel)
- Demodulated signal
- FFT magnitude spectrum
- Constellation plot (digital schemes)

### Metrics
- BER/SER for digital schemes
- Correlation coefficient for analog schemes

### Tools
- Side-by-side comparison mode
- Scenario presets for quick demos
- Save/load custom presets (localStorage)
- Export to CSV and PNG

## Quick Start

Open `index.html` directly in your browser, or run a local server:

```bash
npm run dev
# Open http://localhost:4173
```

## Deployment

Ready for static hosting:

| Platform | Config |
|----------|--------|
| GitHub Pages | Just push to `master` |
| Vercel | `vercel.json` included |
| Netlify | `netlify.toml` included |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
├── index.html      # Main entry point
├── app.js          # Application logic
├── styles.css      # Styling
├── vercel.json     # Vercel config
├── netlify.toml    # Netlify config
└── package.json    # Metadata
```

## License

MIT
