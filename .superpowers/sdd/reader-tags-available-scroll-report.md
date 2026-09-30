# Reader tags available-list scroll fix

## Change

- Bounded `.reader-tags-popup__panel .tag-selection__options` to `12rem`.
- Added internal vertical scrolling and `min-width: 0` to keep long available-tag catalogs inside the popup.
- Creation controls remain outside the scroll container and reachable.
- Added a focused stylesheet regression assertion in `ReaderTagsPopup.test.tsx`.

## Verification

- Focused frontend test: passed, 8/8.
- Frontend production build: passed (`tsc -b && vite build`).
- `git diff --check`: passed.
- Repository `npm test`: backend executed 253 tests successfully, but pytest exited with a Windows `PermissionError` while cleaning its temporary directory (`pytest-current`); the frontend phase was not reached by the chained command.
