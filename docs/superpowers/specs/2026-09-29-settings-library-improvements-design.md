# Settings and library improvements

## Objective

Add a dedicated settings page for shared local preferences and refine the document library so its actions use the same icon-led visual language as the reader rail. The changes remain desktop-first and local to the current application profile.

## Settings page

Add a `/settings` route linked from the application shell. Persist settings in versioned `localStorage` with safe defaults and graceful fallback when storage is unavailable.

Settings in the first version:

- theme: light or dark;
- default reader font size for newly opened documents;
- line-break normalization experiment: enabled by default, with an explicit opt-out.

The existing appearance control is removed from the reader page after the settings page is available. Existing per-reader preferences remain intact; the configured default only supplies initial preferences for new reader sessions and does not overwrite document-local choices already stored.

The settings page uses real form controls, visible labels, keyboard focus states, and the same typography and restrained visual tokens as the reader rail. The feature flag remains reversible through `VITE_ENABLE_LINE_BREAK_NORMALIZATION=false` until the settings migration is complete; the persisted setting takes precedence when present.

## Library improvements

Keep the library information architecture and title navigation. Update each document row so actions use compact icon buttons with accessible names and tooltips for opening, editing, renaming, and deleting. Preserve a text fallback for rename/delete confirmation flows and focus restoration.

Replace the metadata label `Última leitura em` with `Adicionado em`, using the document `createdAt` value. Sorting behavior remains unchanged unless explicitly revisited later.

Add a client-side search field above the document list. It filters by title, is case-insensitive, updates immediately, exposes an accessible label, and has a clear action. Empty-state messaging distinguishes an empty library from no search matches. No backend contract changes are required for this first version.

## Library organization extensions

Add client-side ordering controls for title, creation date, update date, and last-read date, with explicit ascending/descending direction where applicable. Preserve a stable tie-breaker so the list does not jump unpredictably.

Add a document-local favorites preference keyed by document id and persisted in versioned localStorage until SQLite-backed persistence is introduced. The favorite action must be available from each card with an accessible label and visible state. Add filters for favorites and creation date; filters compose with search and ordering and do not change API contracts.

## Document metadata and tags

Add a metadata view for each document. It exposes server-provided creation and last-modified dates as read-only information and allows the user to edit a persisted description.

Documents may have persisted tags. Tags belong to the document, appear below its title in the library, and are included in library search. Search is limited to title and tag names; document content is never searched. Assigning an unknown tag name creates it automatically.

Each tag receives a distinct color from a controlled palette when first created. The assigned color is persisted and reused consistently. A tag-management view provides creation, rename, and removal operations with confirmation where removal affects existing documents.

## Boundaries and compatibility

- No content-analysis contract changes. The document metadata API may be extended for persisted description and tags, remaining backward-compatible with older documents.
- Description, document tags, tag names, and tag colors are persisted in the document store; favorites remain a separate local preference until SQLite-backed favorites are introduced.
- No mobile-specific redesign.
- Preserve document-local reader selections and manual reading overrides.
- Keep the line-break normalizer opt-in at the action level; settings only controls its availability/default behavior.
- Keep all local-storage payloads versioned and recoverable through defaults.

## Verification

- Unit tests for settings load/save/migration and feature-flag precedence.
- Route tests for settings navigation and removing the reader appearance control.
- Library tests for icon action labels, created-date rendering, search filtering, clear action, and no-match state.
- Build, focused frontend tests, full frontend suite where environment permits, and `git diff --check`.
