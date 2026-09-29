# Settings and library improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local settings, move reader appearance controls into settings, and improve the library with icon actions, created-date metadata, and client-side search.

**Architecture:** Add a versioned local settings store consumed through the existing app provider/router boundaries. Implement settings as a desktop-first route, then make the reader consume shared defaults while preserving existing document-local preferences. Keep library filtering client-side and isolate card actions from search state.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-29-settings-library-improvements-design.md`

## Global Constraints

- No SQLite or API contract changes.
- No mobile-specific redesign.
- Preserve document-local reader selections and manual reading overrides.
- Keep local-storage payloads versioned and recoverable through defaults.
- The line-break normalization experiment is enabled by default and remains reversible with `VITE_ENABLE_LINE_BREAK_NORMALIZATION=false`.

## Review Focus

- Invalid or unavailable localStorage must fall back to safe defaults without blocking the app. (Task 1)
- Existing reader-local preferences must not be overwritten by new global defaults. (Task 2)
- Explicit feature-flag opt-out must hide the normalization action while the default remains enabled. (Task 2)
- Library search must distinguish an empty library from zero matching results and preserve action behavior. (Task 4)
- Icon-only library actions must retain accessible names, keyboard focus, and confirmation focus restoration. (Task 3)

### Task 1: Shared settings model and persistence

**Files:**
- Create: `frontend/src/app/settings.ts`
- Test: `frontend/src/app/settings.test.ts`

**Interfaces:**
- Produces `AppSettings`, `DEFAULT_APP_SETTINGS`, `loadAppSettings()`, and `saveAppSettings(settings: AppSettings): void`.
- `AppSettings` contains `theme: Theme`, `defaultReaderFontSizePx: number`, and `lineBreakNormalizationEnabled: boolean`.

- [ ] Write failing tests for defaults, versioned round-trip persistence, invalid payload fallback, and explicit feature-flag opt-out precedence.
- [ ] Run `npm test -- --run src/app/settings.test.ts` and confirm the new tests fail before implementation.
- [ ] Implement the versioned localStorage codec with the existing reader font-size bounds and `VITE_ENABLE_LINE_BREAK_NORMALIZATION` defaulting to enabled unless explicitly `false`.
- [ ] Run the focused tests and `npx tsc --noEmit`.
- [ ] Commit `feat(settings): add versioned local preferences`.

### Task 2: Settings route and reader integration

**Files:**
- Modify: `frontend/src/app/providers.tsx`, `frontend/src/app/router.tsx`, `frontend/src/app/App.tsx`
- Create: `frontend/src/features/settings/SettingsPage.tsx`, `frontend/src/features/settings/SettingsPage.test.tsx`
- Modify: `frontend/src/features/documents/DocumentEditorPage.tsx`, `frontend/src/features/reader/ReaderPage.tsx`, related tests

**Interfaces:**
- Consumes `AppSettings` persistence from Task 1.
- Produces `/settings` navigation, accessible controls, and shared defaults for newly initialized reader preferences.

- [ ] Add route and interaction tests for theme, default font size, normalization toggle, persistence, and settings navigation.
- [ ] Run focused tests and observe failures for the missing route/settings controls.
- [ ] Implement the settings page and provider state, remove the reader appearance menu, and apply the configured font default only when no document-local reader preference exists.
- [ ] Keep the normalization action explicit in the editor; settings controls its availability without automatically transforming content.
- [ ] Run focused tests, build, and `git diff --check`.
- [ ] Commit `feat(settings): add preferences page and shared defaults`.

### Task 3: Library card visual actions and metadata

**Files:**
- Modify: `frontend/src/features/documents/DocumentLibraryPage.tsx`, `frontend/src/styles/global.css`
- Modify: `frontend/src/features/documents/DocumentLibraryPage.test.tsx`

**Interfaces:**
- Consumes existing document fields and mutations.
- Produces icon-led actions with stable accessible labels and `Adicionado em` metadata derived from `createdAt`.

- [ ] Add failing tests for action labels/tooltips, title navigation, created-date formatting, and confirmation focus behavior.
- [ ] Run the focused library tests and confirm the expected failures.
- [ ] Replace visible action text with consistent icon buttons while retaining accessible names and existing mutation flows.
- [ ] Change metadata rendering to `Adicionado em` without changing list sorting.
- [ ] Run focused tests, build, and `git diff --check`.
- [ ] Commit `style(library): align cards with reader actions`.

### Task 4: Client-side library search

**Files:**
- Modify: `frontend/src/features/documents/DocumentLibraryPage.tsx`, `frontend/src/styles/global.css`
- Modify: `frontend/src/features/documents/DocumentLibraryPage.test.tsx`, `frontend/src/app/App.test.tsx`

**Interfaces:**
- Consumes the existing document list query.
- Produces immediate case-insensitive title filtering, a clear action, and distinct no-match messaging without API changes.

- [ ] Add failing tests for title filtering, clear behavior, empty-library messaging, and no-match messaging.
- [ ] Run focused tests and confirm failures.
- [ ] Implement controlled search state and filtered rendering while preserving document actions and keyboard behavior.
- [ ] Run focused tests, full frontend tests where permissions allow, build, and `git diff --check`.
- [ ] Commit `feat(library): add client-side document search`.

### Task 9: Final test-suite alignment

**Files:**
- Modify: tests identified by the full frontend suite, especially `frontend/src/features/reader/ReaderLayout.test.ts`

**Interfaces:**
- Consumes the final UI contracts produced by Tasks 1–4 and 6–8.
- Produces a clean, current frontend test suite without weakening behavioral assertions.

Run this task only after Tasks 6–8 as the final cleanup checkpoint.

- [ ] Run the full frontend suite and inventory every failure after Tasks 1–4.
- [ ] Update stale expectations to the approved contracts and add missing regression coverage where the failure exposes a real behavior gap.
- [ ] Run the full suite, build, and `git diff --check`.
- [ ] Commit `test(frontend): align suite with final interfaces`.

### Task 6: Library ordering controls

**Files:**
- Modify: `frontend/src/features/documents/DocumentLibraryPage.tsx`, `frontend/src/styles/global.css`
- Test: `frontend/src/features/documents/DocumentLibraryPage.test.tsx`

**Interfaces:**
- Consumes the existing document list and search/filter state.
- Produces deterministic client-side ordering by title, creation date, update date, or last-read date with direction controls.

- [ ] Add failing tests for each ordering field, direction, null last-read values, and stable tie-breaking.
- [ ] Implement controlled ordering state without changing API calls.
- [ ] Run focused tests, build, and `git diff --check`.
- [ ] Commit `feat(library): add document ordering controls`.

### Task 7: Local favorites

**Files:**
- Create: `frontend/src/features/documents/favorites.ts`, `frontend/src/features/documents/favorites.test.ts`
- Modify: `frontend/src/features/documents/DocumentLibraryPage.tsx`, related styles/tests

**Interfaces:**
- Produces versioned local favorites keyed by document id, with load/save/toggle helpers and accessible card actions.

- [ ] Add failing tests for defaults, persistence, invalid storage, toggle behavior, and active/inactive accessible labels.
- [ ] Implement the local favorite store and card button without API changes.
- [ ] Run focused tests, build, and `git diff --check`.
- [ ] Commit `feat(library): add local document favorites`.

### Task 8: Library date and favorite filters

**Files:**
- Modify: `frontend/src/features/documents/DocumentLibraryPage.tsx`, `frontend/src/styles/global.css`
- Test: `frontend/src/features/documents/DocumentLibraryPage.test.tsx`, `frontend/src/app/App.test.tsx`

**Interfaces:**
- Consumes search, ordering, and favorites state from Tasks 4, 6, and 7.
- Produces composable favorite and creation-date filters with distinct empty/no-match states.

- [ ] Add failing tests for favorites-only, date range, combined filters, clear filters, and no-match messaging.
- [ ] Implement filters as client-side derived state with accessible controls.
- [ ] Run focused tests, build, and `git diff --check`.
- [ ] Commit `feat(library): add favorite and date filters`.
