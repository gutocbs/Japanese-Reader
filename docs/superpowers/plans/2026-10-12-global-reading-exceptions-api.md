# Global Reading Exceptions API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a backend API to list, create, update, reactivate, soft-delete, and restore global reading exceptions without adding frontend UI.

**Architecture:** Extend the existing reading-exception domain boundary so repositories manage lifecycle state and a new service owns validation and state transitions. A dedicated FastAPI router adapts that service to the `/api/reading-exceptions` contract; the existing snapshot versioning makes later analysis requests see the active catalog without imperative cache clearing.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, SQLite, pytest, openapi-typescript.

**Spec:** `docs/superpowers/specs/2026-10-12-global-reading-exceptions-api-design.md`

## Global Constraints

- Keep `reading_exceptions` rows soft-deleted only; no endpoint physically deletes a row.
- `PUT /api/reading-exceptions/{lemma}` creates (`201`), updates (`200`), or reactivates (`200`) in one request; do not add a `POST` or return `409` for an excluded lemma.
- `GET /api/reading-exceptions` lists only active entries by default; `includeDeleted=true` includes excluded entries.
- Reuse the existing kana normalization rule; readings must normalize to hiragana and contain only valid kana.
- Preserve the existing analysis contract and rely on its reading-exception snapshot version rather than manually clearing analysis cache rows.
- Return expected errors as `application/problem+json`: `404`, `422`, and SQLite `503`.
- Do not add frontend route, UI, or client-side requests in this phase.
- Regenerate and commit `frontend/openapi.json` and `frontend/src/shared/api/generated.ts`; do not edit generated types manually.

## Review Focus

- A soft-deleted lemma submitted to `PUT` must be active immediately with the newly requested reading, not require a restore call; test in Task 4.
- `includeDeleted` must default to false when omitted and include the same inactive row with a non-null UTC `deletedAt` only when true; test in Task 4.
- Explicit restore of an already active lemma must remain idempotent and preserve its reading; test in Task 4.
- Invalid request readings (empty, romaji, mixed content) must not write an invalid catalog row; test normalization and API errors in Tasks 2 and 4.
- A write after a cached analysis must make the next analysis observe the new active snapshot; test in Task 4.

---

## File Structure

- `backend/app/reading_exceptions/models.py` — immutable lifecycle-aware domain record.
- `backend/app/reading_exceptions/repository.py` — repository protocol for listing and state transitions.
- `backend/app/reading_exceptions/service.py` — validation, normalization, state-transition service, and resolver retained for analysis.
- `backend/app/persistence/sqlite/repositories.py` — durable lifecycle operations and UTC timestamp conversion.
- `backend/app/persistence/memory/reading_exceptions.py` — contract-equivalent in-memory repository for unit tests.
- `backend/app/reading_exceptions/api.py` — FastAPI input/output models, dependency, routes, and OpenAPI metadata.
- `backend/app/api/router.py`, `backend/app/main.py`, `backend/app/api/errors.py` — router registration, one shared service instance, and problem-details error mapping.
- `backend/tests/contracts/reading_exception_repository.py` — reusable lifecycle contract.
- `backend/tests/contracts/test_memory_reading_exception_repository.py`, `backend/tests/contracts/test_sqlite_reading_exception_repository.py` — contract implementations.
- `backend/tests/unit/reading_exceptions/test_service.py` — service validation and transition tests.
- `backend/tests/integration/test_reading_exceptions_api.py` — public HTTP/OpenAPI contract and analysis visibility tests.
- `frontend/openapi.json`, `frontend/src/shared/api/generated.ts` — generated API artifacts.

### Task 1: Expand the reading-exception repository contract and implementations

**Files:**
- Modify: `backend/app/reading_exceptions/models.py`
- Modify: `backend/app/reading_exceptions/repository.py`
- Modify: `backend/app/persistence/memory/reading_exceptions.py`
- Modify: `backend/app/persistence/sqlite/repositories.py:637-651`
- Modify: `backend/tests/contracts/reading_exception_repository.py`
- Modify: `backend/tests/contracts/test_memory_reading_exception_repository.py`
- Modify: `backend/tests/contracts/test_sqlite_reading_exception_repository.py`

**Interfaces:**
- Produces: `ReadingException(lemma: str, reading: str, deleted_at: datetime | None = None)`.
- Produces: `ReadingExceptionRepository.list(*, include_deleted: bool = False) -> tuple[ReadingException, ...]` and lifecycle methods `put(lemma: str, reading: str) -> tuple[ReadingException, bool]`, `soft_delete(lemma: str) -> ReadingException | None`, `restore(lemma: str) -> ReadingException | None`.
- Preserves: `list_active() -> tuple[ReadingException, ...]` as the active-only API used by `ReadingExceptionResolver`.

- [ ] **Step 1: Write failing shared repository-contract tests**

Add contract cases asserting lemma ordering; default filtering of `deleted_at`; `include_deleted=True`; `put` creation/update/reactivation semantics and its creation boolean; soft-delete UTC timestamp; restore preserving reading; inactive delete and missing restore return `None`.

- [ ] **Step 2: Run the contract tests to verify they fail**

Run: `uv run pytest backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py -v`

Expected: FAIL because the repository protocol and implementations do not expose the lifecycle methods or `deleted_at`.

- [ ] **Step 3: Extend the domain record and protocol**

Add `deleted_at` with a `None` default to `ReadingException`. Extend the protocol while retaining `list_active` for existing analysis callers. Define timestamps as timezone-aware UTC `datetime` values in the domain layer.

- [ ] **Step 4: Implement the in-memory lifecycle behavior**

Keep a lemma-keyed internal state or equivalent immutable replacement. `put` creates an active record when missing; otherwise updates reading and clears `deleted_at`; `soft_delete` only affects an active record; `restore` only changes an excluded record and returns active records unchanged. Keep `replace` usable by existing analysis tests.

- [ ] **Step 5: Implement SQLite lifecycle behavior**

Use the repository helpers already in `backend/app/persistence/sqlite/repositories.py` to serialize and parse UTC timestamps. Query deterministic lemma order; make `put` determine whether the row existed, then insert or update `reading` and `deleted_at = NULL` within a write unit of work. `soft_delete` writes the injected/default UTC clock timestamp only for active rows; `restore` clears `deleted_at` for an existing row and returns the current active row unchanged.

- [ ] **Step 6: Run repository contract tests to verify they pass**

Run: `uv run pytest backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py -v`

Expected: PASS.

- [ ] **Step 7: Commit the repository lifecycle slice**

```bash
git add backend/app/reading_exceptions/models.py backend/app/reading_exceptions/repository.py backend/app/persistence/memory/reading_exceptions.py backend/app/persistence/sqlite/repositories.py backend/tests/contracts/reading_exception_repository.py backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py
git commit -m "feat(readings): manage exception lifecycle"
```

### Task 2: Add a validated reading-exception management service

**Files:**
- Modify: `backend/app/reading_exceptions/service.py`
- Modify: `backend/app/reading_exceptions/__init__.py`
- Modify: `backend/tests/unit/reading_exceptions/test_service.py`

**Interfaces:**
- Consumes: lifecycle methods from Task 1 and `normalize_kana_reading(reading: str) -> str`.
- Produces: `ReadingExceptionService.list(*, include_deleted: bool = False) -> tuple[ReadingException, ...]`, `put(lemma: str, reading: str) -> tuple[ReadingException, bool]`, `soft_delete(lemma: str) -> ReadingException`, and `restore(lemma: str) -> ReadingException`.
- Produces: a dedicated not-found domain error for absent/inactive lifecycle targets; invalid lemma/reading remains a `ValueError` subclass handled as `422`.

- [ ] **Step 1: Write failing service tests**

Add tests using the in-memory repository for katakana-to-hiragana normalization on `put`, rejection of empty lemma and invalid readings, propagation of created/update/reactivated state, and not-found behavior for deleting a missing/inactive exception or restoring a missing exception.

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `uv run pytest backend/tests/unit/reading_exceptions/test_service.py -v`

Expected: FAIL because `ReadingExceptionService` and its domain errors do not exist.

- [ ] **Step 3: Implement `ReadingExceptionService` in `backend/app/reading_exceptions/service.py`**

Validate that lemma is non-empty before repository calls. Normalize `reading` with the existing `normalize_kana_reading`; wrap invalid normalization in the existing reading-exception validation error type or a specific equivalent. Delegate lifecycle changes to the repository and raise the new not-found error only where its `None` result means the requested state transition cannot occur.

- [ ] **Step 4: Export the public service and errors**

Update `backend/app/reading_exceptions/__init__.py` so composition and API code import one stable public surface without reaching into implementation details.

- [ ] **Step 5: Run the service tests to verify they pass**

Run: `uv run pytest backend/tests/unit/reading_exceptions/test_service.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the service slice**

```bash
git add backend/app/reading_exceptions/service.py backend/app/reading_exceptions/__init__.py backend/tests/unit/reading_exceptions/test_service.py
git commit -m "feat(readings): validate exception updates"
```

### Task 3: Expose the management API and compose it with the application

**Files:**
- Create: `backend/app/reading_exceptions/api.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/errors.py`
- Create: `backend/tests/integration/test_reading_exceptions_api.py`

**Interfaces:**
- Consumes: `ReadingExceptionService` from Task 2.
- Produces: `GET /api/reading-exceptions`, `PUT /api/reading-exceptions/{lemma}`, `DELETE /api/reading-exceptions/{lemma}`, and `PUT /api/reading-exceptions/{lemma}/restore`.
- Produces: `ReadingExceptionResponse` serialized as `lemma`, `reading`, `deletedAt`; `SetReadingExceptionRequest` with only `reading`.

- [ ] **Step 1: Write failing API contract tests**

In a fresh `TestClient(create_app(":memory:"))`, cover: default active list; `includeDeleted=true`; new `PUT` returning `201`; update returning `200`; soft-deleted `PUT` reactivating with the replacement reading and no extra restore request; delete response with a UTC `deletedAt`; explicit restore; idempotent active restore; `404` for missing/inactive lifecycle targets; `422` problem-details for empty lemma or invalid reading; and `503` mapping by replacing the app's service/repository with a SQLite-error-raising test double.

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `uv run pytest backend/tests/integration/test_reading_exceptions_api.py -v`

Expected: FAIL because the router is not registered.

- [ ] **Step 3: Implement the dedicated API router**

Create `backend/app/reading_exceptions/api.py` following `backend/app/readings/api.py`: use a Pydantic base model with `to_camel`, an app-state dependency for `ReadingExceptionService`, explicit `operation_id` values, and `PROBLEM_RESPONSES`. Map the service result to the response model. Set `PUT` status dynamically: `201` only when its service result reports a physical creation, otherwise `200`.

- [ ] **Step 4: Wire the single shared service and errors**

In `create_app`, construct one `ReadingExceptionService` around `application.state.reading_exception_repository`; expose it on app state before request handling and remove it during lifespan cleanup. Register the new router under the existing `/api` aggregator. Add the new not-found and invalid-management error types to `install_error_handlers` with `404` and `422` problem-details mappings; retain the existing SQLite `503` handler.

- [ ] **Step 5: Run the API tests to verify they pass**

Run: `uv run pytest backend/tests/integration/test_reading_exceptions_api.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the API slice**

```bash
git add backend/app/reading_exceptions/api.py backend/app/api/router.py backend/app/main.py backend/app/api/errors.py backend/tests/integration/test_reading_exceptions_api.py
git commit -m "feat(api): manage reading exceptions"
```

### Task 4: Prove API changes are visible to analysis and document the schema

**Files:**
- Modify: `backend/tests/integration/test_reading_exceptions_api.py`
- Modify: `frontend/openapi.json`
- Modify: `frontend/src/shared/api/generated.ts`

**Interfaces:**
- Consumes: API contract from Task 3 and existing `POST /api/documents/{document_id}/analysis`.
- Produces: generated OpenAPI path and TypeScript definitions for all four operations, including `includeDeleted` and `deletedAt`.

- [ ] **Step 1: Write a failing API-to-analysis integration test**

Create a document containing `私`, obtain an analysis, then mutate the exception through the API and assert the next analysis returns the newly active `reading`, `dictionaryReading`, vocabulary key, and furigana behavior. Soft-delete and restore through the API and assert each following analysis observes the appropriate active catalog state. Preserve the existing local override precedence assertions rather than duplicating them.

- [ ] **Step 2: Run the integration test to verify cache-visible behavior**

Run: `uv run pytest backend/tests/integration/test_reading_exceptions_api.py -v`

Expected: PASS. If it fails, keep the cache-transition assertion and correct the responsible implementation in the next step.

- [ ] **Step 3: Make the minimal integration correction if needed**

Only if Task 1–3 behavior does not make the test pass, correct the responsible lifecycle, service composition, or snapshot path. Do not add cache-deletion endpoints or manual cache invalidation.

- [ ] **Step 4: Regenerate the OpenAPI artifacts**

Run: `npm run api:generate`

Expected: `frontend/openapi.json` contains the reading-exception paths and `frontend/src/shared/api/generated.ts` contains the derived types and operation IDs. Inspect the diff; never hand-edit either generated file.

- [ ] **Step 5: Run focused backend verification**

Run: `uv run pytest backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py backend/tests/unit/reading_exceptions/test_service.py backend/tests/integration/test_reading_exceptions_api.py backend/tests/integration/test_analysis_api.py -v`

Expected: PASS.

- [ ] **Step 6: Commit integration proof and generated contract**

```bash
git add backend/tests/integration/test_reading_exceptions_api.py frontend/openapi.json frontend/src/shared/api/generated.ts
git commit -m "test(api): cover reading exception lifecycle"
```

### Task 5: Run regression verification and review the final diff

**Files:**
- Modify only if a preceding regression exposes a task-owned defect.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence separating focused API tests, backend suite, frontend tests, generated-contract cleanliness, and any pre-existing limitations.

- [ ] **Step 1: Run the full backend test suite**

Run: `uv run pytest`

Expected: PASS, or document the exact pre-existing collection/runtime limitation separately from feature failures.

- [ ] **Step 2: Run frontend regression tests without adding UI work**

Run: `npm --prefix frontend test -- --run`

Expected: PASS.

- [ ] **Step 3: Check generated and whitespace diffs**

Run: `git diff --check HEAD~4..HEAD` and `git status --short`

Expected: no whitespace errors; only task-owned committed files plus the pre-existing unrelated working-tree changes (`frontend/src/features/reader/ReaderMenu.tsx`, `frontend/public/`, `icon128.png`) remain visible.

- [ ] **Step 4: Request a whole-branch review**

Use a fresh reviewer to inspect the final diff against the API spec, emphasizing soft-delete/reactivation semantics, UTC timestamps, error envelopes, snapshot visibility, and generated artifacts. Fix only task-owned findings, then rerun the affected verification.

## Self-Review

- Spec coverage: Task 1 implements durable lifecycle and timestamp semantics; Task 2 centralizes validation; Task 3 implements all HTTP operations, composition, and problem-details errors; Task 4 proves analysis visibility and updates OpenAPI; Task 5 captures regression and review evidence.
- Type consistency: all tasks use `ReadingException`, `ReadingExceptionRepository`, and `ReadingExceptionService` with the signatures established in Tasks 1–2.
- Review focus: each listed risk is assigned to Tasks 2, 3, or 4 with an explicit test step.
- Scope: the plan deliberately excludes frontend UI and does not introduce physical deletion or manual analysis-cache clearing.
