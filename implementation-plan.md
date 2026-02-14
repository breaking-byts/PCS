# Implementation Plan

## Scope
This plan converts the audit findings into executable work items. Each task is broken into concrete steps and includes a review block to run immediately after implementation.

## Sequencing
1. P0 resilience and deployment-surface fixes
2. P1 quality-gate and accessibility behavior fixes
3. P2 maintainability and deterministic testing improvements
4. P3 optimization and cleanup

---

## Task 1 (P0): Progressive Enhancement Visibility Fallback
### Goal
Ensure content is visible by default even if animation JS fails to load.

### Steps
1. Add a JS-enabled hook (`html.js`) in bootstrap before UI initialization.
2. Change CSS so `[data-section]` starts visible by default.
3. Move hidden/reveal initial state under `html.js [data-section]`.
4. Confirm reduced-motion and non-GSAP paths still render correctly.
5. Update smoke tests (or add one) to assert sections are visible without GSAP.

### Review
1. Verify no-section-hidden regression by loading page with GSAP blocked.
2. Verify with `prefers-reduced-motion: reduce` that sections remain visible.
3. Run `bun run test`.
4. Manually inspect first paint for flash/jump issues.

---

## Task 2 (P0): Restrict Netlify Publish Surface
### Goal
Deploy only curated static artifacts, not repository root.

### Steps
1. Add a static artifact prep step that creates `dist/`.
2. Update `netlify.toml` publish directory from `.` to `dist`.
3. Ensure `dist/` includes only required files (`index.html`, `styles.css`, `js/`, `vendor/`).
4. Align local docs with deploy artifact behavior.

### Review
1. Build artifact locally and confirm required assets exist.
2. Confirm non-runtime files are absent from `dist/`.
3. Validate site still loads correctly from `dist/`.
4. Re-run deploy workflow simulation checks.

---

## Task 3 (P1): Add CI Lint Gate and Tighten Workflow Permissions
### Goal
Make CI enforce syntax/lint checks and minimize token scope.

### Steps
1. Add explicit lint step to CI before tests.
2. Keep deploy permissions scoped to deploy job only.
3. Reduce CI job permissions to read-only defaults.
4. Ensure workflow still supports GitHub Pages deploy path.

### Review
1. Run workflow locally or via PR validation.
2. Confirm CI fails on intentional syntax issue.
3. Confirm deploy still runs on push to `master`.
4. Verify permissions block reflects least-privilege model.

---

## Task 4 (P1): Reduce `aria-live` Announcement Noise
### Goal
Avoid repeated non-actionable status announcements for assistive tech users.

### Steps
1. Classify status events into: informational, actionable success, error.
2. Stop emitting repetitive `"Simulation updated."` into live region.
3. Keep live announcements for errors, preset operations, and exports.
4. Optionally move high-frequency updates to a non-live visual-only channel.

### Review
1. Keyboard test with rapid control changes.
2. Screen reader pass to confirm reduced chatter.
3. Verify errors and important actions are still announced.
4. Run a11y test suite.

---

## Task 5 (P1): Harden Plot Rendering Input Guards
### Goal
Prevent `NaN` axis extents and silent plotting failures for sparse/empty datasets.

### Steps
1. Guard `drawXYPlot` against empty inner series.
2. Guard against mismatched `xList`/`yList` lengths.
3. Skip invalid series rather than crashing render path.
4. Add unit tests for empty and malformed plot inputs.

### Review
1. Run tests for render utility edge cases.
2. Confirm app render loop survives malformed compare data.
3. Verify canvas output is stable (no console/runtime errors).

---

## Task 6 (P2): Add Deterministic Simulation Mode (Seeded RNG)
### Goal
Support reproducible results for debugging and benchmarking.

### Steps
1. Implement seedable RNG utility (isolated module).
2. Thread RNG through noise generation and random bit creation.
3. Add optional UI seed control and deterministic mode toggle.
4. Include seed value in export metadata/status output.
5. Add unit tests proving same seed => same BER/SER path.

### Review
1. Run repeated simulations with same seed and compare outputs.
2. Validate behavior unchanged when deterministic mode is off.
3. Confirm smoke tests still pass with default settings.

---

## Task 7 (P2): Add Coverage Instrumentation and Thresholds
### Goal
Measure test effectiveness and fail CI on inadequate coverage.

### Steps
1. Add Vitest coverage dependency and scripts.
2. Configure minimum thresholds (line/function/branch).
3. Add CI coverage run and artifact upload (optional).
4. Backfill tests for low-coverage critical branches.

### Review
1. Run `bun run test:coverage`.
2. Confirm thresholds fail when intentionally lowered coverage occurs.
3. Document coverage policy in README.

---

## Task 8 (P2): Split `ui.js` into Smaller Modules
### Goal
Reduce coupling and improve change safety.

### Steps
1. Extract preset storage operations into `ui-presets.js`.
2. Extract control parsing/serialization into `ui-controls.js`.
3. Extract render orchestration into `ui-render-controller.js`.
4. Keep `ui.js` as composition layer with minimal glue logic.
5. Update imports/tests and verify no behavior regression.

### Review
1. Ensure public function signatures remain stable.
2. Re-run smoke and unit tests.
3. Perform targeted manual checks for presets/render/events.

---

## Task 9 (P3): CSS Consolidation and Cascade Cleanup
### Goal
Reduce duplicate selector blocks and improve style maintainability.

### Steps
1. Identify duplicated selector groups (`canvas`, `topbar`, etc.).
2. Merge into canonical blocks near related sections.
3. Remove stale comments and contradictory notes.
4. Validate responsive breakpoints and hover/focus behavior.

### Review
1. Visual regression check across desktop/mobile widths.
2. Focus-visible audit after consolidation.
3. Confirm no animation/accessibility regressions.

---

## Task 10 (P3): Vendor Asset Weight Optimization
### Goal
Reduce payload size while preserving math rendering quality.

### Steps
1. Audit KaTeX font usage and subset to required files.
2. Remove unused fonts from vendored package.
3. Add cache-friendly immutable headers guidance in docs/config.
4. Validate no glyph rendering regressions in equations.

### Review
1. Compare before/after transfer size for initial load.
2. Verify all equation variants render correctly.
3. Test across Chromium/WebKit/Firefox.

---

## Definition of Done (Global)
1. All modified code paths covered by unit/smoke/a11y tests where applicable.
2. `bun run lint` and `bun run test` pass.
3. CI workflow reflects new gates.
4. README/deployment docs updated for any behavior or workflow changes.
