# Japanese Reader MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um leitor local de japonês que preserve o texto original, gere furigana com Sudachi, mantenha vocabulário por documento, aceite correções manuais, persista a biblioteca em SQLite e seja distribuído como um único serviço Docker.

**Architecture:** Monólito modular com frontend React/TypeScript/Vite e backend FastAPI. Casos de uso dependem de repository ports; o primeiro adaptador é em memória e o SQLite o substitui sem alterar contratos. O texto original é canônico; tokens, furigana e cache são derivados.

**Tech Stack:** Python 3.12, uv, FastAPI, Pydantic, SudachiPy, SudachiDict Core, pytest, React, TypeScript, Vite, React Router, TanStack Query, Vitest, Testing Library, openapi-typescript, SQLite e Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-26-japanese-reader-design.md`

## Global Constraints

- A primeira versão é desktop-first; não implementar experiência específica para celular ou tablet.
- Desenvolvimento e testes devem funcionar sem Docker; o empacotamento entra somente após o serviço local estar concluído.
- Não adicionar autenticação, cloud, tradução, OCR, IA, spaced repetition, AnkiConnect ou TTS ao MVP.
- `Document.content` é a representação canônica; HTML, tokens e cache nunca o substituem.
- Offsets HTTP são pontos de código Unicode calculados pelo backend; o frontend não recalcula offsets UTF-16.
- Renderizar texto HTML real com `ruby` e `rt`; canvas, SVG e imagens são proibidos para o conteúdo.
- `VocabularyKey` combina lemma e `dictionaryReading`, usando a leitura da ocorrência apenas como fallback; seleções e preferências por chave pertencem ao documento.
- Editar conteúdo preserva seleções/preferências, remove overrides e invalida análises.
- Token com kanji e leitura sempre recebe furigana; alinhamento incerto usa ruby sobre a unidade lexical inteira.
- Não impor limite arbitrário pequeno nem implementar chunking/virtualização antes das medições.
- Fixar dependências em `uv.lock` e `package-lock.json`; registrar versões de Sudachi e do dicionário.
- Usar nomes de código em inglês e textos de interface em português.
- Cada task termina com testes relevantes, `git diff --check` e commit próprio.

## Review Focus

- Emoji ou kanji suplementar deve manter offsets e reconstrução exatos; Tasks 2, 4, 6 e 7.
- Kanji com leitura e alinhamento ambíguo deve receber ruby sobre a palavra inteira; Tasks 5, 7 e 8.
- Análise de revisão antiga nunca pode substituir a revisão atual; Tasks 6 e 12.
- Falha SQLite nunca pode ser apresentada como sucesso nem apagar o formulário; Task 13.
- Otimização de documentos grandes não pode quebrar seleção de texto ou Yomitan; Task 14.

---

## File Map

### Backend

- `backend/app/main.py`: composição FastAPI e frontend estático em produção.
- `backend/app/api/{router,errors}.py`: routers e Problem Details.
- `backend/app/documents/{models,repository,service,api}.py`: domínio e CRUD.
- `backend/app/analysis/{models,morphology,furigana,repository,service,api}.py`: pipeline linguístico.
- `backend/app/vocabulary/{models,repository,service,api}.py`: chaves, seleção e visibilidade.
- `backend/app/readings/{models,repository,service,api}.py`: overrides por ocorrência.
- `backend/app/persistence/memory/*.py`: primeiros adaptadores.
- `backend/app/persistence/sqlite/{connection,migrations,repositories}.py`: persistência final.
- `backend/app/persistence/sqlite/migrations/*.sql`: schema versionado.

### Frontend

- `frontend/src/app/{router,providers}.tsx`: rotas e providers.
- `frontend/src/shared/api/{client,generated}.ts`: transporte e tipos OpenAPI.
- `frontend/src/features/documents/*`: biblioteca e editor.
- `frontend/src/features/reader/*`: leitor, token, menus, preferências e overrides.
- `frontend/src/features/vocabulary/*`: lista vertical e exportação.
- `frontend/src/styles/{tokens,global}.css`: tema Verde silencioso e layout.

### Root, tests and evidence

- `pyproject.toml`, `uv.lock`, `frontend/package*.json`: dependências bloqueadas.
- `scripts/dev.ps1`: desenvolvimento sem Docker.
- `Dockerfile`, `docker-compose.yml`: distribuição, criados somente na Task 15.
- `backend/tests/{unit,integration,contracts}` e `frontend/src/**/*.test.tsx`: testes.
- `tests/fixtures/japanese_cases.json`: corpus linguístico.
- `tests/performance/*` e `docs/performance/large-documents.md`: evidência de escala.

---

### Task 1: Bootstrap local development and quality gates

**Files:**
- Create: `pyproject.toml`, `backend/app/main.py`, `backend/tests/test_health.py`
- Create: `frontend/package.json`, configs Vite/TypeScript/Vitest, `frontend/src/app/App.tsx`
- Create: root `package.json`, `scripts/dev.ps1`, `README.md`

**Interfaces:**
- Consumes: none.
- Produces: `GET /api/health -> {"status":"ok"}`; `uv run pytest`; frontend test/build; execução local conjunta.

- [ ] **Step 1: Write failing backend health test** — `test_health_returns_ok` exige status 200 e JSON exato.
- [ ] **Step 2: Run it** — `uv run pytest backend/tests/test_health.py -v`; expected FAIL por módulo inexistente.
- [ ] **Step 3: Bootstrap Python** — Python `>=3.12,<3.13`; FastAPI, Uvicorn, Pydantic, SudachiPy, SudachiDict Core; pytest/httpx em dev; implementar health endpoint.
- [ ] **Step 4: Verify backend** — mesmo comando; expected PASS.
- [ ] **Step 5: Write failing frontend smoke test** — `renders_application_name` exige heading “Japanese Reader”.
- [ ] **Step 6: Run it** — `npm --prefix frontend test -- --run`; expected FAIL.
- [ ] **Step 7: Bootstrap Vite/React/TypeScript** — configurar jsdom/Testing Library, proxy `/api -> localhost:8000`, build e root scripts.
- [ ] **Step 8: Add local runner/docs** — `scripts/dev.ps1` inicia Uvicorn reload e Vite; README documenta install/test/run sem Docker.
- [ ] **Step 9: Verify and commit** — executar pytest, Vitest e Vite build; `git diff --check`; commit `chore: bootstrap local development`.

---

### Task 2: Define document domain and in-memory repository

**Files:**
- Create: `backend/app/documents/{models,repository,service}.py`
- Create: `backend/app/persistence/memory/documents.py`
- Create: `backend/tests/contracts/document_repository.py`
- Create: `backend/tests/{contracts/test_memory_document_repository,unit/documents/test_service}.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: `Document`, `CreateDocument`, `UpdateDocument`, `DocumentRepository`, `DocumentService`.

- [ ] **Step 1: Write failing repository contract** — create/get/list/update/delete; UUID; UTC; revision 1; revision increment somente ao mudar conteúdo; preservação exata de `𠮷野家\n日本語  text`.
- [ ] **Step 2: Run contract** — expected FAIL por tipos inexistentes.
- [ ] **Step 3: Define protocol** — métodos `create`, `get`, `list`, `update`, `delete`; `UpdateDocument` exige pelo menos um campo.
- [ ] **Step 4: Implement memory adapter** — clock/UUID factory injetáveis; não expor estado interno mutável.
- [ ] **Step 5: Verify repository contract** — expected PASS.
- [ ] **Step 6: Write service tests** — `DocumentUpdateResult(document, content_changed)` diferencia título de conteúdo.
- [ ] **Step 7: Implement service and verify** — rodar unit tests e suíte backend.
- [ ] **Step 8: Commit** — `git diff --check`; commit `feat: add document domain contracts`.

---

### Task 3: Expose document HTTP contracts and generated frontend types

**Files:**
- Create: `backend/app/documents/api.py`, `backend/app/api/{router,errors}.py`
- Create: `backend/tests/integration/test_documents_api.py`
- Create: `frontend/src/shared/api/{generated,client}.ts`
- Modify: `backend/app/main.py`, root scripts

**Interfaces:**
- Consumes: `DocumentService`.
- Produces: CRUD `/api/documents`, OpenAPI e cliente TypeScript.

- [ ] **Step 1: Write failing API tests** — CRUD, camelCase, 404 Problem Details, Unicode exato, lista por `lastReadAt` descendente.
- [ ] **Step 2: Run tests** — expected FAIL por rotas ausentes.
- [ ] **Step 3: Implement schemas/routes** — conversão explícita HTTP↔domínio; `application/problem+json` com type/title/status/detail.
- [ ] **Step 4: Verify API** — integration test PASS.
- [ ] **Step 5: Generate TypeScript** — exportar OpenAPI e gerar `generated.ts`; nunca editar manualmente.
- [ ] **Step 6: Test client** — mock `fetch`; conferir métodos CRUD tipados e preservação de erros.
- [ ] **Step 7: Verify and commit** — backend/frontend tests, `git diff --check`; commit `feat: expose document API contracts`.

---

### Task 4: Implement Sudachi morphology adapter

**Files:**
- Create: `backend/app/analysis/{models,morphology}.py`
- Create: `backend/tests/unit/analysis/test_morphology.py`
- Create: `tests/fixtures/japanese_cases.json`

**Interfaces:**
- Consumes: Python `str`.
- Produces: `MorphologicalAnalyzer.analyze(text: str, base_offset: int = 0) -> tuple[RawToken, ...]` e `AnalyzerMetadata`.

- [ ] **Step 1: Create corpus** — kana, kanji, okurigana, conjugação, katakana, pontuação, números, latim, parágrafos, espaços, OOV provável e `𠮷野家`.
- [ ] **Step 2: Write failing tests** — surface, lemma, reading da ocorrência, `dictionary_reading`, POS de seis partes, OOV, offsets absolutos e reconstrução exata; `食べた` relaciona-se a `食べる` e expõe leitura de dicionário `たべる`.
- [ ] **Step 3: Run tests** — expected FAIL por adapter ausente.
- [ ] **Step 4: Implement `SudachiMorphologicalAnalyzer`** — Split Mode B, `raw_surface`, dictionary/reading/POS/OOV/begin/end e `dictionary_form_morpheme().reading_form()` quando disponível; tokenizer singleton no lifespan.
- [ ] **Step 5: Normalize reading** — katakana→hiragana apenas no valor derivado; superfície permanece intacta.
- [ ] **Step 6: Record metadata** — nome/versão do analyzer e dicionário, split mode; não persistir `word_id` como identidade.
- [ ] **Step 7: Verify and commit** — suíte unitária/backend; commit `feat: add Sudachi morphology adapter`.

---

### Task 5: Implement VocabularyKey and mandatory furigana fallback

**Files:**
- Create: `backend/app/vocabulary/models.py`
- Create: `backend/app/analysis/furigana.py`
- Create: `backend/tests/unit/{vocabulary/test_vocabulary_key,analysis/test_furigana}.py`

**Interfaces:**
- Consumes: `RawToken`.
- Produces: `VocabularyKey.from_token(token)` e `FuriganaAligner.align(surface, reading)`.

- [ ] **Step 1: Write key tests** — `食べる`, `食べた` e `食べます` convergem por lemma+dictionaryReading; leituras de dicionário diferentes divergem; ausência de dictionaryReading usa reading da ocorrência como fallback; pontuação não recebe chave; encoding não usa concatenação ambígua por delimitador.
- [ ] **Step 2: Implement key and verify** — teste específico PASS.
- [ ] **Step 3: Write furigana tests** — kana, katakana, kanji, `食べた`, spans mistos, leitura irregular/ambígua; segmentos sempre recompõem surface.
- [ ] **Step 4: Pin fallback** — `昨日/きのう` e caso misto ambíguo devem retornar um segmento com surface inteira e reading inteira, nunca ausência de ruby quando há kanji+reading.
- [ ] **Step 5: Implement aligner** — âncoras kana apenas quando inequívocas; fallback obrigatório sobre unidade lexical; sem kanji ou sem reading retorna texto simples.
- [ ] **Step 6: Verify and commit** — unit/backend suite; commit `feat: align furigana with whole-token fallback`.

---

### Task 6: Build revision-safe analysis service and API

**Files:**
- Create: `backend/app/analysis/{repository,service,api}.py`
- Create: `backend/app/persistence/memory/analyses.py`
- Create: `backend/tests/{unit/analysis/test_service,integration/test_analysis_api}.py`
- Modify: `backend/app/api/router.py`

**Interfaces:**
- Consumes: document repository, morphology, aligner e VocabularyKey.
- Produces: `AnalysisService.analyze(document_id: UUID) -> DocumentAnalysis`; `POST /api/documents/{id}/analysis`.

- [ ] **Step 1: Write failing service tests** — resposta inclui document/revision/hash/metadata/blocos/tokens/offsets; gaps e surfaces recompõem `A𠮷野家\n昨日、食べた。`.
- [ ] **Step 2: Add stale-revision test** — documento muda enquanto analyzer executa; exigir `StaleDocumentRevisionError` e nenhum cache antigo salvo.
- [ ] **Step 3: Run tests** — expected FAIL.
- [ ] **Step 4: Define cache protocol** — `find_compatible(AnalysisCacheKey)`, `save(DocumentAnalysis)`, `invalidate_document(UUID)`.
- [ ] **Step 5: Implement service** — blocos em fronteiras de parágrafo, offsets absolutos, releitura da revisão imediatamente antes de publicar/salvar.
- [ ] **Step 6: Verify service tests** — expected PASS.
- [ ] **Step 7: Write/implement API tests** — camelCase, segmentos, metadata, 404 e documento vazio 422 sem chamar analyzer.
- [ ] **Step 8: Regenerate types and commit** — full tests; commit `feat: add revision-safe document analysis`.

---

### Task 7: Deliver the first end-to-end reader slice

**Files:**
- Create: `frontend/src/app/{router,providers}.tsx`
- Create: `frontend/src/features/documents/DocumentEditorPage.tsx`
- Create: `frontend/src/features/reader/{ReaderPage,DocumentText,Token}.tsx`
- Create: matching component tests
- Create: `frontend/src/styles/{tokens,global}.css`
- Modify: `frontend/src/app/App.tsx`

**Interfaces:**
- Consumes: document e analysis API types.
- Produces: `/documents/new`, `/documents/:id/edit`, `/documents/:id/read` e DOM semântico.

- [ ] **Step 1: Write failing semantic tests** — texto-base selecionável, `ruby > rt`, pontuação simples, base sem `rt` igual ao original; fallback envolve token inteiro.
- [ ] **Step 2: Run component tests** — expected FAIL.
- [ ] **Step 3: Implement `DocumentText` and `Token`** — renderizar blocos/gaps; nenhum cálculo de offsets ou canvas no browser.
- [ ] **Step 4: Verify semantic tests** — expected PASS.
- [ ] **Step 5: Write editor-to-reader test** — criar documento, analisar, navegar; falha preserva conteúdo e oferece retry.
- [ ] **Step 6: Implement routes/editor/queries** — desabilitar ação pendente; estados vazio/loading/error; nenhum estado por caractere.
- [ ] **Step 7: Add base visual tokens** — Verde silencioso, contraste AA, foco visível e line-height confortável para ruby.
- [ ] **Step 8: Verify and commit** — Vitest, Vite build, pytest, diff check; commit `feat: deliver semantic Japanese reader slice`.

---

### Task 8: Expand linguistic regression coverage

**Files:**
- Modify: `tests/fixtures/japanese_cases.json`
- Modify: morphology/furigana unit tests
- Create: `backend/tests/integration/test_linguistic_regressions.py`
- Create: `docs/linguistic-regressions.md`

**Interfaces:**
- Consumes: pipeline completo de análise.
- Produces: corpus nomeado, versionado e expectativas de fallback.

- [ ] **Step 1: Add failing regression cases** — todas as categorias da spec, CRLF policy, iteration marks, full-width numerals e jukujikun ambíguo.
- [ ] **Step 2: Run and record genuine failures** — não alterar expectativas apenas para espelhar saída do Sudachi.
- [ ] **Step 3: Apply minimal fixes** — manter Sudachi atrás do adapter; documentar expectativas dependentes da versão.
- [ ] **Step 4: Assert mandatory fallback** — todo kanji+reading continua com ruby, mesmo sem alinhamento parcial.
- [ ] **Step 5: Verify and commit** — linguistic suite; commit `test: expand Japanese analysis regressions`.

---

### Task 9: Add document-scoped vocabulary selection and review list

**Files:**
- Create: `backend/app/vocabulary/{repository,service,api}.py`
- Create: `backend/app/persistence/memory/vocabulary.py`
- Create: vocabulary repository contracts/API tests
- Create: `frontend/src/features/vocabulary/{ReviewList,ReviewList.test}.tsx`
- Modify: reader page/token

**Interfaces:**
- Consumes: VocabularyKey, document ID e analyzed tokens.
- Produces: GET/PUT selections e lista vertical.

- [ ] **Step 1: Write failing repository/API tests** — set semantics, isolamento por documento, idempotência, ordem pela primeira ocorrência e preservação após nova revisão.
- [ ] **Step 2: Define protocol** — `list_selections(document_id) -> frozenset[VocabularyKey]`; `replace_selections(document_id, keys) -> None`.
- [ ] **Step 3: Implement endpoints** — `/api/documents/{id}/vocabulary-selections`; verify backend tests.
- [ ] **Step 4: Write failing UI tests** — clique marca/desmarca todas as ocorrências da mesma chave; leitura diferente não marca; remoção da lista atualiza tokens.
- [ ] **Step 5: Implement UI** — um `Set<string>` no reader; lista vertical lemma/reading/remove.
- [ ] **Step 6: Implement deterministic copy** — `lemma<TAB>reading`, uma chave por linha, ordem visual.
- [ ] **Step 7: Verify and commit** — full suites; commit `feat: add document vocabulary review queue`.

---

### Task 10: Add reader preferences and per-key furigana visibility

**Files:**
- Extend: vocabulary models/repository/service/api
- Create: `frontend/src/features/reader/{preferences,ReaderMenu,TokenContextMenu}` plus tests
- Modify: `frontend/src/features/reader/Token.tsx`

**Interfaces:**
- Consumes: VocabularyKey e token focus.
- Produces: `FuriganaVisibility = inherit|show|hide`, browser `ReaderPreferences` e API de visibilidade.

- [ ] **Step 1: Write failing backend tests** — isolamento por documento, default inherit, upsert e preservação após revisão.
- [ ] **Step 2: Add repository/API** — listar e definir preferência em `/vocabulary-display-preferences`; verify.
- [ ] **Step 3: Write precedence tests** — chave > global > default; global off+show, global on+hide e inherit; ocultar `rt` nunca remove base.
- [ ] **Step 4: Implement reader menu** — `fontSizePx` e `showFurigana` em localStorage versionado; range desktop centralizado; não reanalisar.
- [ ] **Step 5: Implement context menu** — contextmenu, Shift+F10/Menu, Escape/outside click, retorno de foco; não interceptar fora de tokens lexicais.
- [ ] **Step 6: Verify and commit** — accessibility interactions/full suites; commit `feat: add reader furigana preferences`.

---

### Task 11: Add occurrence-specific reading overrides

**Files:**
- Create: `backend/app/readings/{models,repository,service,api}.py`
- Create: `backend/app/persistence/memory/readings.py`
- Create: override contracts/unit/API tests
- Create: `frontend/src/features/reader/{ReadingOverrideDialog,ReadingOverrideDialog.test}.tsx`

**Interfaces:**
- Consumes: document revision, code-point offsets, analyzer reading e aligner.
- Produces: override API e editor contextual.

- [ ] **Step 1: Write failing backend tests** — kana não vazio; offsets identificam um token da revisão atual; somente ocorrência alvo muda; delete restaura analyzer; revisão velha dá conflict.
- [ ] **Step 2: Implement key/repository/resolver** — chave `(document_id, revision, start, end)`; resolver antes do aligner; fallback inteiro permanece obrigatório.
- [ ] **Step 3: Implement API** — create/update/delete em `/reading-overrides`; stale revision retorna 409 Problem Details; verify.
- [ ] **Step 4: Write dialog tests** — leitura atual, erro próximo ao campo, refresh só da ocorrência, remove condicional e Escape restaura foco.
- [ ] **Step 5: Implement dialog/menu integration** — controles fora do `ruby`; manter texto-base selecionável.
- [ ] **Step 6: Test edit invalidation** — conteúdo novo remove analysis/overrides, preserva selections/display preferences; validar service e API.
- [ ] **Step 7: Verify and commit** — full suites; commit `feat: add manual reading overrides`.

---

### Task 12: Complete in-memory document library UI

**Files:**
- Create: `frontend/src/features/documents/{DocumentLibraryPage,DeleteDocumentDialog}.tsx` and tests
- Modify: editor, router, document service/API

**Interfaces:**
- Consumes: document CRUD e reader route.
- Produces: biblioteca completa ainda volátil.

- [ ] **Step 1: Write failing flow tests** — empty, create, open, rename, edit, delete confirmation, errors, `lastReadAt` order e back preservando input.
- [ ] **Step 2: Implement library/editor** — TanStack Query keys por recurso; não remover linha definitivamente antes de sucesso; aviso de persistência em memória.
- [ ] **Step 3: Add stale-response UI test** — analysis revision 1 chega após update revision 2 e deve ser descartada.
- [ ] **Step 4: Update `lastReadAt` in backend service** — timestamp vem do domínio, não do browser.
- [ ] **Step 5: Verify and commit** — tests/build/diff; commit `feat: complete in-memory document library`.

---

### Task 13: Replace memory persistence with SQLite and durable cache

**Files:**
- Create: `backend/app/persistence/sqlite/{connection,migrations,repositories}.py`
- Create: `backend/app/persistence/sqlite/migrations/001_initial.sql`
- Create: shared SQLite contract and restart integration tests
- Modify: composition root, document service and README

**Interfaces:**
- Consumes: todos os repository protocols.
- Produces: adaptadores SQLite selecionados por `DATABASE_PATH` e cache por AnalysisCacheKey.

- [ ] **Step 1: Run shared contracts against temp SQLite** — CRUD, rollback, reopen e Unicode exato; expected FAIL antes do adapter.
- [ ] **Step 2: Define migration** — `schema_migrations`, documents, analyses, selections, display preferences e overrides; análise como JSON versionado; FKs/índices.
- [ ] **Step 3: Implement connection/migrations** — conexão por unit of work, foreign_keys, busy_timeout; WAL somente após teste Windows/Linux local.
- [ ] **Step 4: Implement repositories** — passar a mesma suíte de contratos dos adapters memory.
- [ ] **Step 5: Test transaction failure** — gravação forçada falha, API não responde sucesso, dados anteriores permanecem, editor não perde conteúdo.
- [ ] **Step 6: Test restart/cache** — reabrir mesmo arquivo preserva dados; metadata idêntica reutiliza cache; versão diferente força miss.
- [ ] **Step 7: Wire composition root** — default `./data/japanese-reader.db`; `:memory:` apenas explícito/testes; remover aviso volátil.
- [ ] **Step 8: Verify and commit** — full suites; commit `feat: persist library with SQLite`.

---

### Task 14: Measure large documents and optimize only proven bottlenecks

**Files:**
- Create: `tests/performance/{generate_documents,benchmark_analysis}.py`
- Create: `frontend/src/features/reader/reader.performance.test.tsx`
- Create: `docs/performance/large-documents.md`
- Conditional Modify: files implicated by measurements

**Interfaces:**
- Consumes: aplicação local completa com SQLite.
- Produces: métricas reproduzíveis, limites documentados e no máximo uma rodada de otimização justificada.

- [ ] **Step 1: Generate deterministic corpora** — ~10k, 50k, 100k e 250k pontos de código; registrar SHA-256 e tamanhos.
- [ ] **Step 2: Benchmark backend/transport** — cold analysis, cache read, memória de pico e JSON; mínimo 3 execuções, mediana e ambiente.
- [ ] **Step 3: Benchmark frontend** — duração de render e toggle; confirmar blocos+set de keys, não estado por caractere.
- [ ] **Step 4: Manual compatibility gate** — Chrome/Edge/Firefox: seleção, copy e Yomitan no início/meio/fim; registrar resultados.
- [ ] **Step 5: Decide** — orçamento atendido: documentar “no optimization required”; caso contrário escolher só o primeiro gargalo medido.
- [ ] **Step 6: If needed, write failing regression/performance test** — preservar reconstrução, seleção, texto nativo e fallback de furigana.
- [ ] **Step 7: Implement minimum and remeasure** — mesmas fixtures e ambiente, antes/depois.
- [ ] **Step 8: Commit evidence** — commit `perf: validate large document behavior`.

---

### Task 15: Package the completed service with Docker

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- Create: `backend/tests/integration/test_static_frontend.py`
- Modify: `backend/app/main.py`, `README.md`

**Interfaces:**
- Consumes: frontend production build e FastAPI concluído.
- Produces: um container, uma origem HTTP, volume SQLite e healthcheck.

- [ ] **Step 1: Write static-serving test** — API permanece JSON; rotas browser caem em `index.html` somente quando static dir existe.
- [ ] **Step 2: Implement production static mount** — configurável; Vite preview nunca é servidor de produção.
- [ ] **Step 3: Create multi-stage Dockerfile** — Node instala lock/build; Python instala runtime lock e copia app+assets; um Uvicorn worker.
- [ ] **Step 4: Create Compose** — um serviço, uma porta local, volume do banco, DATABASE_PATH e healthcheck; sem Nginx/Redis.
- [ ] **Step 5: Verify persistence** — build/up, criar documento, restart, recriar container sem apagar volume e confirmar documento.
- [ ] **Step 6: Document lifecycle/backup** — start/stop/log/update/localização/backup/restore e alerta sobre apagar volume.
- [ ] **Step 7: Verify and commit** — tests/build/`docker compose config`; commit `feat: package Japanese reader with Docker`.

---

### Task 16: Finish export, accessibility, visual polish and release evidence

**Files:**
- Create: `frontend/src/features/vocabulary/{export,export.test}.ts`
- Modify: styles and all primary screen/dialog tests
- Create: `docs/acceptance-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: todos os fluxos do MVP.
- Produces: exportação determinística, tema final e evidência de aceite.

- [ ] **Step 1: Write export tests** — UTF-8 TSV, `lemma<TAB>reading`, ordem estável, sem duplicatas e newline final.
- [ ] **Step 2: Implement clipboard/download** — mesmo serializer puro; filename seguro baseado em título/data; separado de futuro mapeamento Anki.
- [ ] **Step 3: Add accessibility tests** — labels, headings, foco, dialog Escape, context-menu keyboard, estado não apenas por cor e anúncios loading/error.
- [ ] **Step 4: Finish Verde silencioso** — uma coluna de leitura e lista vertical; contraste AA; Chrome/Edge/Firefox desktop e zoom.
- [ ] **Step 5: Execute acceptance checklist** — create/analyze/read/select/furigana/font/override/edit/reopen/delete/export/restarts; texto selecionável e Yomitan.
- [ ] **Step 6: Final verification** — pytest, Vitest, build, Docker build/up/healthy e diff check; nenhum blocker manual.
- [ ] **Step 7: Complete docs and commit** — setup local/Docker, uso, backup, limites, versões e troubleshooting; commit `feat: finish Japanese reader MVP`.

---

## Completion Sequence

1. **Foundation:** Tasks 1–3 estabelecem execução local, ports e contratos tipados.
2. **First vertical slice:** Tasks 4–7 entregam texto → Sudachi → JSON → leitor semântico.
3. **Linguistic confidence:** Task 8 transforma casos difíceis em regressões explícitas.
4. **Study workflow:** Tasks 9–11 adicionam seleção, visibilidade e overrides.
5. **Library:** Task 12 conclui o fluxo ainda em memória.
6. **Durability:** Task 13 troca adapters por SQLite sem mudar contratos.
7. **Measured scale:** Task 14 mede e otimiza somente se necessário.
8. **Distribution:** Task 15 empacota o serviço já funcional.
9. **Release:** Task 16 conclui exportação, acessibilidade, visual e aceite.

O MVP só está concluído após a Task 16. Tasks anteriores são incrementos utilizáveis, não autorização para declarar o produto completo.
