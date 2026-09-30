# Reader tags popup fix report

## Changes

- Removed the internal `Fechar etiquetas` button; the rail Tags trigger remains the popup toggle and close affordance.
- Bounded the popup with `box-sizing: border-box`, `max-width`, and `overflow-x: hidden` while preserving `max-height` and `overflow-y: auto`.
- Constrained tag rows/options and long tag labels so content wraps within the popup.
- Added focused regression coverage for the single close affordance and horizontal-overflow layout rules.

## Verification

- Focused popup tests: **8 passed** (`ReaderTagsPopup.test.tsx`).
- Production build: **passed** (`tsc -b && vite build`).
- Full frontend test suite: **1 pre-existing failure**, `ReaderLayout.test.ts` expects `3rem` rail columns while the current stylesheet uses `3.5rem`; the popup tests and all other tests passed.
- `git diff --check`: passed.
