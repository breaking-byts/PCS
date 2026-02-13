# Modulation Studio TODO

## Audit Remediation (2026-02-13)
- [x] 1) Security hardening: remove third-party runtime CDN dependencies and add CSP/security headers on all deploy targets.
- [x] 2) Docs correctness: update README to reflect modular `js/` architecture and current startup workflow.
- [x] 3) Tooling compatibility: align scripts so local development uses Bun-first commands.
- [x] 4) Maintainability: replace hardcoded sample-rate literals with shared `SAMPLE_RATE` constant.
- [x] 5) Refactor cleanup: remove unused function parameters and stale API surface.
- [x] 6) Review pass: run smoke checks and re-audit diffs before commit.

## Completed
- [x] Deployable production-style UI redesign
- [x] Modulation family taxonomy + scheme drill-down
- [x] Three baseband models with equations
- [x] Modulation + demodulation equations in UI
- [x] Channel impairment controls (AWGN, fading, RX offsets)
- [x] Time-domain plots for baseband/received/demodulated
- [x] FFT magnitude spectrum
- [x] Constellation plotting for digital schemes
- [x] BER/SER metrics (digital) and correlation metric (analog)
- [x] Side-by-side comparison mode with overlays
- [x] Scenario presets and starter demo
- [x] Save/load/delete custom presets (local storage)
- [x] CSV and PNG export tools
- [x] Deployment configs for Netlify and Vercel

## Remaining Hardening
- [x] Add automated unit tests for modulation/demodulation correctness
- [x] Add end-to-end smoke tests for UI controls and exports
- [x] Add optional advanced receiver models (timing recovery/PLL)
- [x] Add accessibility audit pass (keyboard and contrast deep check)
