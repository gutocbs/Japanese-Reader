# Library tag click search report

## Delivered

- Library document tag chips are native buttons with the accessible label `Pesquisar por etiqueta <tag name>`.
- Activating a chip copies its tag name to the existing search field, reusing the title/tag filter without changing the document route.
- Chip colours and layout remain based on `metadata-tag`; the button reset and a visible keyboard focus outline are scoped to library chips.
- The existing clear-search control restores the full library after a tag search.

## Regression coverage

- Added focused click coverage for search population, filtered results, unchanged route, and clearing the search.
- Added keyboard-activation coverage for the native tag button.
- Updated the existing tag-management library assertion to expect the new accessible button label.

## Verification

- `npm --prefix frontend test -- --run src/features/documents/DocumentLibraryPage.test.tsx`: passed, 34 tests.
- `npm --prefix frontend test -- --run src/features/documents/TagManagementPage.test.tsx`: passed, 12 tests.
- `npm run build`: passed (`tsc -b` and Vite production build).
- `git diff --check`: passed.
- Full frontend suite remains blocked by a pre-existing `ReaderLayout.test.ts` expectation: it expects a `3rem` reader side column, while the current stylesheet defines `3.5rem`. The tag-management suite passed in that same run.
- Root `npm test` completed all backend collection work (252 passed, 1 skipped) but exited during pytest temporary-directory cleanup with `PermissionError` for `C:\Users\gutoc\AppData\Local\Temp\pytest-of-gutocbs\pytest-current`, before it could launch the frontend phase.
