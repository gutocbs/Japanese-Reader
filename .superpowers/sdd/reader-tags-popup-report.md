# Reader tags popup report

## Delivered

- Added the reader rail Tags control and an accessible popup for document tags.
- Preserved assigned tag colors, selects catalog tags, creates a tag through the shared deterministic palette, and persists assignments through the existing document update contract.
- Added removal, loading/persistence feedback, active trigger state, Escape/outside-click closure, trigger-focus restoration, and viewport-bounded internal popup scrolling.
- Reader text, vocabulary selection, and the application header remain outside the popup flow.

## Validation

- `npm test -- --run src/features/reader/ReaderTagsPopup.test.tsx` — 6 passed.
- `npm run build` — passed.
- `git diff --check` — passed (Git emitted existing LF-to-CRLF conversion warnings only).
- Full frontend suite is blocked by a pre-existing contradictory assertion in `src/features/reader/ReaderLayout.test.ts`: one test expects a `3rem` rail while a later test in the same file expects the current `3.5rem` rail.
