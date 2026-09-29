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

Improve the visual treatment of library filters with a subtle popup menu that follows the current icon-led design language. The popup should expose active state clearly, provide accessible labels and keyboard behavior, and avoid adding persistent visual noise to the library toolbar.

## Document metadata and tags

Add a metadata view for each document. It exposes server-provided creation and last-modified dates as read-only information and allows the user to edit a persisted description and source. Documents created manually in the UI use `Local` as their source; imported documents retain the source supplied by the import API.

Documents may have persisted tags. Tags belong to the document, appear below its title in the library, and are included in library search. Search is limited to title and tag names; document content is never searched. The metadata screen lets the user select existing tags from a list or create a new tag inline.

Each tag receives a distinct color from a controlled palette when first created. The assigned color is persisted and reused consistently. A tag-management view provides creation, rename, and removal operations with confirmation where removal affects existing documents.

Tag management must allow changing both a tag name and its color. Color selection uses the predefined palette and may additionally offer a color picker. Deleting a tag removes only that tag association from every document that contains it; other tags and document metadata remain unchanged.

## Frontend design pass

Use the `frontend-design` skill for a focused visual redesign of the tag-management and document-metadata screens. Preserve the existing desktop-first information architecture and dark/light tokens while improving hierarchy, spacing, control grouping, inline tag selection, color previews, focus states, and empty/error states. The result should remain restrained and consistent with the reader rail rather than introducing a new visual language.

## Public text import API

Expose a public API endpoint for importing documents from external plugins. The request body includes the document text, title, tags, description, and source metadata. Imported documents use the source value received from the API; manually created documents use `Local`. The endpoint must reuse the same document creation and tag persistence contracts as the UI, validate the payload, preserve content exactly, and return the created document contract including server-owned timestamps and identifiers.

## Boundaries and compatibility

- No content-analysis contract changes. The document metadata API may be extended for persisted description, source, and tags, remaining backward-compatible with older documents.
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
