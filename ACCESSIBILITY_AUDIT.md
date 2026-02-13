# Accessibility Audit (2026-02-13)

## Scope
- Keyboard navigation and landmark semantics
- Focus visibility on interactive controls
- Core color contrast for primary text tokens

## Changes Applied
- Updated skip-link target to the main landmark (`#main-content`) and made main focusable.
- Added semantic status region attributes (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`).
- Added accessible labels to all plot canvases (`role="img"` + `aria-label`).
- Added automated accessibility checks in `tests/a11y/accessibility.audit.test.js`.

## Automated Checks
- Skip link and main-content landmark presence
- Status region screen-reader semantics
- Focus-visible CSS coverage for `button`, `input`, `select`, and top navigation links
- Contrast thresholds:
  - `--ink` vs `--bg` >= 4.5
  - `--accent` vs `--bg` >= 4.5
  - `--muted` vs `--bg` >= 3.0

## Result
- All automated accessibility audit checks pass.
