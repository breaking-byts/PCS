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
- Optional adaptive receiver mode (PLL + timing recovery)

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
bun install
bun run dev
# Open http://localhost:4173
```

## Testing

```bash
bun run test
# or run suites individually:
bun run test:unit
bun run test:smoke
bun run test:a11y
```

## Runtime Production Controls

The app supports optional runtime configuration through a global object:

```js
window.__MOD_STUDIO_CONFIG__ = {
  observabilityEndpoint: "https://example.com/observability",
  analyticsEndpoint: "https://example.com/analytics",
  analyticsEnabled: true,
};
```

- `observabilityEndpoint` is optional; when omitted, errors/events stay local in structured console logs.
- `analyticsEnabled` defaults to `false`.
- `analyticsEndpoint` is optional and only used when `analyticsEnabled: true`.
- Analytics respects privacy signals (`Do Not Track` and `Global Privacy Control`) and will suppress tracking when enabled.

## Deployment

Ready for static hosting:

| Platform | Config |
|----------|--------|
| GitHub Pages | Just push to `master` |
| Vercel | `vercel.json` included |
| Netlify | `netlify.toml` included |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Security Headers

`netlify.toml` and `vercel.json` are aligned and include:
- strict CSP with `img-src 'self'` and `upgrade-insecure-requests`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- restrictive `Permissions-Policy`
- asset caching policy (`max-age=600`, `stale-while-revalidate=86400`)

## Project Structure

```
├── index.html         # Main entry point
├── js/
│   ├── main.js        # App bootstrap and initialization
│   ├── ui.js          # UI orchestration, state, and event binding
│   ├── ui-presets.js  # Preset persistence and validation logic
│   ├── ui-render-controller.js # Render orchestration and simulation pipeline
│   ├── ui-exports.js  # CSV/PNG export services
│   ├── ui-animations.js # GSAP animation bootstrap
│   ├── analytics.js   # Privacy-aware functional analytics hooks
│   ├── observability.js # Runtime error/event telemetry utilities
│   ├── signal.js      # Public signal API surface
│   ├── signal-core.js # Channel model, receiver sync, error metrics
│   ├── signal-analog.js # Analog modulation/demodulation implementations
│   ├── signal-digital.js # Digital modulation/demodulation implementations
│   ├── render.js      # Canvas drawing and plot composition
│   ├── utils.js       # Shared math and helper utilities
│   └── config.js      # Schemes, defaults, and constants
├── vendor/            # Vendored third-party browser assets (GSAP, KaTeX)
├── styles.css         # Styling
├── vercel.json        # Vercel config + security headers
├── netlify.toml       # Netlify config + security headers
└── package.json       # Scripts and dependencies
```

## License

MIT
