# Global Reading Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the reader to apply or remove a reading correction locally or across all occurrences sharing the selected token's `VocabularyKey`.

**Architecture:** Extend the existing reading-override request with an explicit scope while retaining per-occurrence persistence. The backend expands vocabulary-scoped operations against the current analysis revision; the reader checkbox controls the scope and refreshes the displayed analysis after the operation. A separate visual pass refines the dialog with `frontend-design` after behavior is stable.

**Tech Stack:** FastAPI, Pydantic, SQLite/in-memory repositories, React 19, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-01-global-reading-overrides-design.md`

## Global Constraints

- Use `VocabularyKey` as the identity of an equivalent analyzed word.
- Preserve the existing local occurrence behavior and API compatibility for omitted/local scope.
- Persist overrides per occurrence; do not add cross-document state.
- Keep revision guards and content-change invalidation intact.
- Do not alter the analyzer or `VocabularyKey` calculation.
- The visual redesign is a later task and must use `frontend-design` without changing behavior.

## Review Focus

- Same surface with different lexical identity: `私` must not affect `私流`.
- Multiple occurrences with a mixture of local overrides: global save must replace only matching vocabulary occurrences.
- Global removal must leave unrelated overrides untouched.
- Stale document revisions must fail without partial writes.
- Checkbox state and confirmation must not submit duplicate requests or accidentally widen a local correction.

### Task 1: Vocabulary-scoped backend override operations

**Files:**
- Modify: `backend/app/readings/models.py`, `backend/app/readings/service.py`, `backend/app/readings/api.py`
- Modify: reading repositories and migrations only if the existing per-occurrence contract requires a helper
- Test: `backend/tests/unit/readings/test_service.py`, `backend/tests/integration/test_reading_overrides_api.py`, repository contract tests

**Interfaces:**
- Extend `ReadingOverrideKey` request handling with `scope: Literal["local", "vocabulary"]` and the selected token `vocabularyKey` when scope is vocabulary.
- Produce an operation response containing affected occurrence count and the resulting overrides while preserving the existing single-override response for local calls where practical.

- [ ] Write failing unit/API tests for local compatibility, global `私`, exclusion of `私流`, replacement of matching existing overrides, global removal, stale revisions, and no partial writes.
- [ ] Run focused backend tests and confirm the new scope tests fail.
- [ ] Implement vocabulary matching against the current `DocumentAnalysis` and apply repository writes/deletes inside the existing document revision guard.
- [ ] Run focused reading tests, integration tests, repository contracts, and OpenAPI assertions.
- [ ] Commit `feat(readings): support vocabulary-scoped overrides`.

### Task 2: Reader checkbox and global operation integration

**Files:**
- Modify: `frontend/src/shared/api/client.ts`, generated API contract files if schemas change
- Modify: `frontend/src/features/reader/ReadingOverrideDialog.tsx`, `Token.tsx`, `ReaderPage.tsx`
- Test: `frontend/src/features/reader/ReadingOverrideDialog.test.tsx`, `Token.test.tsx`, `DocumentText.test.tsx`, `App.test.tsx` as needed

**Interfaces:**
- Consumes the backend scope request/response from Task 1.
- The dialog submits local scope when the checkbox is unchecked and vocabulary scope with the token's `vocabularyKey` when checked.

- [ ] Add failing tests for checkbox default-off behavior, checked payload, local payload, multi-occurrence confirmation, affected-count feedback, and global removal.
- [ ] Run focused frontend tests and confirm failures.
- [ ] Implement controlled checkbox state, confirmation before multi-occurrence writes, and reader refresh/state reconciliation after a global operation.
- [ ] Preserve focus restoration, kana validation, error handling, and the current local correction flow.
- [ ] Run focused tests, TypeScript build, and `git diff --check`.
- [ ] Commit `feat(reader): add global reading correction scope`.

### Task 3: Behavioral regression and compatibility validation

**Files:**
- Modify: affected backend/frontend tests only
- Test: full reading, analysis, document-edit invalidation, SQLite persistence, and frontend reader suites

**Interfaces:**
- Verifies that global overrides remain document-local, survive SQLite reload, and are invalidated or preserved according to the existing revision contract.

- [ ] Add regression coverage for `私`/`私流`, same `VocabularyKey` across separated blocks, and content edits after global correction.
- [ ] Run backend reading/document/analysis suites and frontend reader suites.
- [ ] Run OpenAPI generation if the HTTP schema changed and verify generated files are synchronized.
- [ ] Run the full project checks available in the environment and record pre-existing/environment failures separately.
- [ ] Commit `test(readings): cover global override compatibility`.

### Task 4: Visual refinement of the correction dialog

**Skill:** `frontend-design` is required for this task.

**Files:**
- Modify: `frontend/src/features/reader/ReadingOverrideDialog.tsx`, `frontend/src/styles/global.css`
- Test: `frontend/src/features/reader/ReadingOverrideDialog.test.tsx`

**Interfaces:**
- Preserves the checkbox semantics and all contracts from Tasks 1–3.
- Produces a readable checkbox label, clear local/global scope explanation, visible confirmation/affected-count state, and accessible focus/keyboard behavior.

- [ ] Define the visual direction and compact layout tokens before editing; keep the existing desktop-first reader language.
- [ ] Add or update tests for accessible labels, focus order, checked/unchecked copy, error feedback, and disabled saving state.
- [ ] Apply the visual refinement with `frontend-design`; avoid gradients, glassmorphism, excessive shadows, or unrelated reader redesign.
- [ ] Run focused tests, frontend build, and `git diff --check`.
- [ ] Commit `style(reader): refine reading override scope dialog`.

### Task 5: Final verification and review

**Files:**
- No product files unless verification reveals a concrete regression.

- [ ] Run the full backend and frontend suites, build, OpenAPI synchronization check, and focused global-override tests.
- [ ] Manually validate a document containing `私`, repeated `私`, and `私流`: local correction, global correction, global removal, and content edit.
- [ ] Review the final diff for scope creep and document any unverified browser/runtime checks.
- [ ] Commit only if a verification fix is required; otherwise record the clean review.
