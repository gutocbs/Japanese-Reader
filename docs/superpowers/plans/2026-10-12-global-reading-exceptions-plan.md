# Exceções globais de leitura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir exceções globais de leitura e aplicá-las à análise, começando por `私 → わたし`, sem criar API de manutenção nem frontend.

**Architecture:** Um módulo dedicado carrega e valida um snapshot imutável das exceções ativas, calcula sua versão por hash e corrige `RawToken` por correspondência exata de lemma. `AnalysisService` usa o snapshot antes de calcular `VocabularyKey`; a versão do snapshot entra em `AnalysisOptions` para impedir cache incompatível, enquanto overrides por ocorrência continuam sendo a última camada de leitura.

**Tech Stack:** Python 3.12, FastAPI, SQLite, SudachiPy, pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-global-reading-exceptions-design.md`

## Global Constraints

- A primeira exceção ativa é exatamente `私 → わたし`.
- A exceção substitui `reading` e `dictionary_reading`, mas não altera superfície, offsets, lemma, classe gramatical ou estado OOV.
- A correspondência usa o lemma completo; `私` não pode alterar `私流`.
- Overrides por ocorrência têm precedência sobre a leitura efetiva, sem alterar o `dictionary_reading` corrigido ou a `VocabularyKey`.
- `has_reading_override` permanece `false` quando somente uma exceção global foi aplicada.
- `deleted_at IS NOT NULL` representa exclusão lógica e remove a linha do snapshot ativo.
- Não migrar seleções ou preferências existentes de `["私","わたくし"]` para `["私","わたし"]`.
- Não adicionar endpoint, contrato OpenAPI, código frontend ou operação de escrita pública nesta entrega.

## Review Focus

- Lemmas que compartilham caracteres, como `私` e `私流`: somente a correspondência exata deve ser corrigida; Task 1 fixa isso no resolver e Task 4 no fluxo completo.
- Linha excluída com leitura inválida: deve ser ignorada antes da validação; Task 2 cobre a consulta ativa e Task 1 cobre validação apenas do snapshot recebido.
- Linha ativa vazia, com romaji ou caracteres não kana: deve falhar explicitamente, nunca produzir análise parcial; Task 1 cobre esses valores.
- Alteração, exclusão e restauração do conjunto ativo: cada snapshot distinto deve selecionar seu próprio cache, e um snapshot idêntico anterior pode reutilizá-lo; Tasks 3 e 4 cobrem a identidade completa.
- Payload SQLite antigo sem `readingExceptionsVersion`: deve continuar decodificável, mas não corresponder à nova chave de produção; Task 3 cobre compatibilidade de leitura e incompatibilidade de chave.

---

### Task 1: Domínio, normalização e snapshot de exceções

**Files:**
- Create: `backend/app/readings/normalization.py`
- Create: `backend/app/reading_exceptions/__init__.py`
- Create: `backend/app/reading_exceptions/models.py`
- Create: `backend/app/reading_exceptions/repository.py`
- Create: `backend/app/reading_exceptions/service.py`
- Modify: `backend/app/readings/service.py`
- Test: `backend/tests/unit/reading_exceptions/test_service.py`
- Test: `backend/tests/unit/readings/test_service.py`

**Interfaces:**
- Produces: `ReadingException(lemma: str, reading: str)`.
- Produces: `ReadingExceptionRepository.list_active() -> tuple[ReadingException, ...]`.
- Produces: `ReadingExceptionResolver(repository: ReadingExceptionRepository)` and `snapshot() -> ReadingExceptionSnapshot`.
- Produces: `ReadingExceptionSnapshot.version: str` and `resolve(token: RawToken) -> RawToken`.
- Preserves: `backend.app.readings.service.InvalidReadingError` and `normalize_kana_reading` as importable names while moving their implementation to `backend.app.readings.normalization`.

- [ ] **Step 1: Write failing normalization and resolver tests**

Add tests named:

```python
def test_snapshot_normalizes_readings_and_has_deterministic_version(): ...
def test_snapshot_rejects_empty_romaji_and_mixed_active_readings(): ...
def test_resolver_replaces_both_readings_and_preserves_token_identity_fields(): ...
def test_resolver_matches_the_complete_lemma_only(): ...
```

Assert that `ワタシ` becomes `わたし`; the same active pairs in different repository order yield the same SHA-256 version; invalid values raise a dedicated `InvalidReadingExceptionError` naming the lemma; `私` changes both readings; and `私流` is unchanged.

- [ ] **Step 2: Run the focused tests and verify the new module is missing**

Run: `uv run pytest backend/tests/unit/reading_exceptions/test_service.py -v`

Expected: FAIL during collection because `backend.app.reading_exceptions` does not exist.

- [ ] **Step 3: Extract shared kana normalization without changing override behavior**

Move these exact public definitions to `backend/app/readings/normalization.py`:

```python
class InvalidReadingError(ValueError): ...
def normalize_kana_reading(reading: str) -> str: ...
```

Import both names from `backend/app/readings/service.py` so current callers and error-handler imports remain compatible.

- [ ] **Step 4: Implement the exception domain and immutable snapshot**

Create the interfaces above. `ReadingExceptionResolver.snapshot()` must normalize every active reading, reject invalid active entries with `InvalidReadingExceptionError(lemma: str)`, sort normalized `(lemma, reading)` pairs by lemma, and hash an unambiguous UTF-8 JSON encoding with SHA-256. `ReadingExceptionSnapshot.resolve()` must use `dataclasses.replace` only on exact lemma matches.

- [ ] **Step 5: Run focused domain and existing reading tests**

Run: `uv run pytest backend/tests/unit/reading_exceptions/test_service.py backend/tests/unit/readings/test_service.py -v`

Expected: PASS.

- [ ] **Step 6: Commit the domain boundary**

```bash
git add backend/app/readings/normalization.py backend/app/readings/service.py backend/app/reading_exceptions backend/tests/unit/reading_exceptions backend/tests/unit/readings/test_service.py
git commit -m "feat(readings): resolve global reading exceptions"
```

### Task 2: Migração e repositórios de exceções ativas

**Files:**
- Create: `backend/app/persistence/sqlite/migrations/004_reading_exceptions.sql`
- Create: `backend/app/persistence/memory/reading_exceptions.py`
- Modify: `backend/app/persistence/sqlite/repositories.py`
- Create: `backend/tests/contracts/reading_exception_repository.py`
- Create: `backend/tests/contracts/test_memory_reading_exception_repository.py`
- Create: `backend/tests/contracts/test_sqlite_reading_exception_repository.py`
- Modify: `backend/tests/integration/test_sqlite_persistence.py`

**Interfaces:**
- Consumes: `ReadingException` and `ReadingExceptionRepository.list_active()` from Task 1.
- Produces: `SqliteReadingExceptionRepository(database: SqliteDatabase)`.
- Produces: `InMemoryReadingExceptionRepository(exceptions: Iterable[ReadingException] = ())` with `list_active()` plus a test-support `replace(exceptions: Iterable[ReadingException]) -> None` used to model a changed snapshot before the write API exists.

- [ ] **Step 1: Write failing migration and repository contract tests**

Add assertions that migration version `4` exists, `reading_exceptions` contains exactly active `私 → わたし`, reopening does not duplicate it, SQLite returns active rows ordered by lemma, and a row with non-null `deleted_at` is absent even when its stored reading is invalid. Add `reading_exceptions` to the expected table set and update every explicit migration-version expectation from `[1, 2, 3]` to `[1, 2, 3, 4]`.

Extend the concurrent migration expectation from `[1, 2, 3]` to `[1, 2, 3, 4]` and assert all workers observe that exact sequence.

- [ ] **Step 2: Run persistence and repository tests to verify failure**

Run: `uv run pytest backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py backend/tests/integration/test_sqlite_persistence.py -v`

Expected: FAIL because migration `004` and both adapters do not exist.

- [ ] **Step 3: Add migration `004_reading_exceptions.sql`**

Create `reading_exceptions(lemma TEXT PRIMARY KEY, reading TEXT NOT NULL, deleted_at TEXT)` and insert exactly `('私', 'わたし', NULL)`. Do not modify vocabulary selections, display preferences or reading overrides.

- [ ] **Step 4: Implement memory and SQLite read adapters**

Implement `list_active()` with deterministic lemma ordering. The SQLite query must filter `deleted_at IS NULL` in SQL so excluded invalid rows never reach snapshot validation.

- [ ] **Step 5: Run focused persistence and repository tests**

Run: `uv run pytest backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py backend/tests/integration/test_sqlite_persistence.py -v`

Expected: PASS, including migration versions `[1, 2, 3, 4]` under concurrent initialization.

- [ ] **Step 6: Commit persistence support**

```bash
git add backend/app/persistence/sqlite/migrations/004_reading_exceptions.sql backend/app/persistence/sqlite/repositories.py backend/app/persistence/memory/reading_exceptions.py backend/tests/contracts/reading_exception_repository.py backend/tests/contracts/test_memory_reading_exception_repository.py backend/tests/contracts/test_sqlite_reading_exception_repository.py backend/tests/integration/test_sqlite_persistence.py
git commit -m "feat(readings): persist global reading exceptions"
```

### Task 3: Versão das exceções na identidade do cache

**Files:**
- Modify: `backend/app/analysis/models.py`
- Modify: `backend/app/persistence/sqlite/repositories.py`
- Modify: `backend/tests/contracts/analysis_repository.py`
- Modify: `backend/tests/contracts/test_sqlite_analysis_repository.py`
- Modify: `backend/tests/unit/analysis/test_service.py`
- Modify: `backend/tests/unit/documents/test_service.py`

**Interfaces:**
- Consumes: `ReadingExceptionSnapshot.version` from Task 1.
- Produces: `AnalysisOptions(split_mode: str, furigana_algorithm_version: int = FURIGANA_ALGORITHM_VERSION, reading_exceptions_version: str = "")`.
- Persists: `readingExceptionsVersion` inside both `analysis_options_json` and the analysis payload.
- Decodes: missing `readingExceptionsVersion` as `""` for stored payload compatibility.

- [ ] **Step 1: Write failing cache identity and persistence tests**

Extend the analysis repository contract to assert that changing only `reading_exceptions_version` yields a cache miss. Add a SQLite round-trip assertion for a non-empty version and a legacy-payload assertion that missing `readingExceptionsVersion` decodes as `""`.

- [ ] **Step 2: Run cache-focused tests to verify failure**

Run: `uv run pytest backend/tests/contracts/test_sqlite_analysis_repository.py backend/tests/unit/analysis/test_service.py backend/tests/unit/documents/test_service.py -v`

Expected: FAIL because `AnalysisOptions` has no `reading_exceptions_version` and SQLite does not persist it.

- [ ] **Step 3: Extend `AnalysisOptions` and SQLite serialization**

Add the exact field and default above. Include `readingExceptionsVersion` in `_analysis_options_json()` and `_analysis_payload()`. In `_decode_analysis()`, use `options.get("readingExceptionsVersion", "")` so pre-feature payloads remain readable.

Do not add this internal version to `AnalysisOptionsResponse`; the existing HTTP `analysisOptions` payload remains `{"splitMode":"B"}`.

- [ ] **Step 4: Update cache-key construction fixtures**

Update explicit `AnalysisOptions(...)` expectations only where the tests need a non-empty exception version. Preserve the empty-string default for unrelated unit and repository fixtures.

- [ ] **Step 5: Run cache and compatibility tests**

Run: `uv run pytest backend/tests/contracts/test_sqlite_analysis_repository.py backend/tests/unit/analysis/test_service.py backend/tests/unit/documents/test_service.py -v`

Expected: PASS; a different exception version misses the cache while legacy payload decoding remains supported.

- [ ] **Step 6: Commit cache versioning**

```bash
git add backend/app/analysis/models.py backend/app/persistence/sqlite/repositories.py backend/tests/contracts/analysis_repository.py backend/tests/contracts/test_sqlite_analysis_repository.py backend/tests/unit/analysis/test_service.py backend/tests/unit/documents/test_service.py
git commit -m "feat(analysis): version cache by reading exceptions"
```

### Task 4: Integrar exceções ao fluxo de análise e à aplicação

**Files:**
- Modify: `backend/app/analysis/service.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/unit/analysis/test_service.py`
- Modify: `backend/tests/integration/test_analysis_api.py`
- Modify: `backend/tests/unit/analysis/test_morphology.py`

**Interfaces:**
- Consumes: `ReadingExceptionResolver.snapshot()` and `ReadingExceptionSnapshot.resolve()` from Task 1.
- Consumes: `SqliteReadingExceptionRepository` from Task 2.
- Consumes: `AnalysisOptions.reading_exceptions_version` from Task 3.
- Changes: `AnalysisService.__init__(..., reading_overrides: ReadingOverrideResolver | None = None, reading_exceptions: ReadingExceptionResolver | None = None)`.
- Produces: application state `reading_exception_repository`; the lifespan wires its resolver into the shared `AnalysisService`.

- [ ] **Step 1: Write failing service tests for corrected identity and precedence**

Add tests named:

```python
def test_global_exception_changes_reading_dictionary_identity_and_furigana(): ...
def test_global_exception_does_not_mark_or_widen_a_local_override(): ...
def test_changed_deleted_and_restored_snapshots_select_compatible_cache(): ...
```

Use a deterministic analyzer containing `私`, `私流` and another token. Assert exact `reading`, `dictionary_reading`, `vocabulary_key`, furigana and `has_reading_override`. In the override test, persist `あたし` for the `私` occurrence and assert `dictionary_reading == "わたし"` with effective `reading == "あたし"`.

For cache behavior, mutate the in-memory exception repository from `私 → わたし` to another active reading, then to no active entry, then back to `私 → わたし`; count analyzer calls and assert only an identical previously cached snapshot is reused.

- [ ] **Step 2: Write the failing real-application integration test**

Add `test_seeded_global_exception_is_returned_by_existing_analysis_endpoint()` using `create_app(":memory:")`. Analyze content containing `私` and assert its token has:

```python
{
    "lemma": "私",
    "reading": "わたし",
    "dictionaryReading": "わたし",
    "vocabularyKey": '["私","わたし"]',
    "hasReadingOverride": False,
}
```

Assert the furigana segments concatenate to the original surface with reading `わたし`. Keep the synthetic `RawToken` unit test from Task 1 as the exact-lemma proof: the pinned Sudachi dictionary segments the text `私流` into separate `私` and `流` tokens, so it cannot provide a real integration token whose lemma is `私流`.

- [ ] **Step 3: Run focused analysis tests and verify failure**

Run: `uv run pytest backend/tests/unit/analysis/test_service.py backend/tests/integration/test_analysis_api.py backend/tests/unit/analysis/test_morphology.py -v`

Expected: FAIL because `AnalysisService` does not consume the exception resolver and application composition does not provide one.

- [ ] **Step 4: Integrate the snapshot before cache lookup and token identity calculation**

After the existing missing-document and empty-content checks in `AnalysisService.analyze()`, obtain one snapshot for the request. Build `AnalysisOptions` with its version before `find_compatible()`. Resolve each analyzer token before calling `VocabularyKey.from_token()`, resolving occurrence overrides and deriving diagnostics/furigana.

When no resolver is supplied, use an empty snapshot with stable version `""` so existing isolated service tests preserve their cache keys.

- [ ] **Step 5: Wire the SQLite repository in `create_app()` and lifespan**

Construct `SqliteReadingExceptionRepository(database)`, store it as `application.state.reading_exception_repository`, and pass `ReadingExceptionResolver(...)` to `AnalysisService`. Keep the shared Sudachi analyzer lifecycle unchanged.

- [ ] **Step 6: Preserve morphology ownership tests**

Update lifespan expectations only to account for the new dependency. Keep assertions proving the Sudachi analyzer remains shared, closes once and has no database knowledge.

- [ ] **Step 7: Run focused analysis and integration tests**

Run: `uv run pytest backend/tests/unit/reading_exceptions/test_service.py backend/tests/unit/analysis/test_service.py backend/tests/unit/analysis/test_morphology.py backend/tests/integration/test_analysis_api.py -v`

Expected: PASS with `私 → わたし`, exact-lemma isolation, local override precedence and cache snapshot behavior proven.

- [ ] **Step 8: Commit analysis integration**

```bash
git add backend/app/analysis/service.py backend/app/main.py backend/tests/unit/analysis/test_service.py backend/tests/unit/analysis/test_morphology.py backend/tests/integration/test_analysis_api.py
git commit -m "feat(analysis): apply global reading exceptions"
```

### Task 5: Validação completa e revisão de escopo

**Files:**
- Modify: only files above if verification reveals a defect attributable to this feature.

**Interfaces:**
- Verifies the complete contract from the spec; produces no new public interface.

- [ ] **Step 1: Run all backend tests**

Run: `uv run pytest`

Expected: all backend tests PASS.

- [ ] **Step 2: Run the repository-level test command**

Run: `npm test`

Expected: backend and frontend suites PASS; the untouched frontend remains compatible with the unchanged HTTP response schema.

- [ ] **Step 3: Verify formatting and scope**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only task-related changes plus the user's pre-existing `frontend/src/features/reader/ReaderMenu.tsx`, `frontend/public/` and `icon128.png` changes; do not stage or modify those pre-existing files.

- [ ] **Step 4: Review the final diff against explicit exclusions**

Confirm there are no new maintenance endpoints, OpenAPI schema changes, frontend changes, physical deletes of exceptions, or migration of existing vocabulary state.

- [ ] **Step 5: Commit verification fixes only if required**

If no fix was needed, do not create an empty commit. If verification exposed a feature regression, stage only the affected feature/test files and commit:

```bash
git commit -m "fix(readings): complete global exception validation"
```
