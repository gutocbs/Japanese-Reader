# Large-document measurements

Measured on 2026-09-28. These are observations, not character limits. The
application still accepts larger documents; the table documents where the
current synchronous full-response design stops feeling comfortable on the
measured machine.

## Environment and method

- Windows 11 `10.0.22631`, Intel Core i5-9600K (6 logical CPUs), 31.9 GiB RAM.
- Python 3.12.10, Node 26.5.0, npm 11.17.0.
- SudachiPy 0.6.11, SudachiDict-core 20250825, split mode B.
- Backend: FastAPI `TestClient` through the real HTTP routes, a fresh SQLite
  file and application lifespan per sample, three independent samples per
  size, median reported. Cold analysis includes analysis, SQLite cache write,
  response-model conversion, and JSON transport. Cache read repeats the same
  request. Process RSS is sampled every 5 ms. On Windows the ctypes structure
  and opaque-pointer function signatures are initialized once at module import;
  a focused probe performs 1,000 reads across eight threads.
- Frontend: Vitest 5.0.2 + jsdom 30.1.1, three samples per size with the median
  reported. The fixture uses
  real paragraph blocks, about one token component per two code points, native
  text/ruby, and one shared vocabulary key per block. It measures synchronous
  render and a `Set<VocabularyKey>` toggle. jsdom timings are a reproducible
  comparison tool, not browser-frame timings.

Reproduce from the repository root on Windows:

```powershell
.\.venv\Scripts\python.exe tests/performance/generate_documents.py
.\.venv\Scripts\python.exe tests/performance/benchmark_analysis.py --runs 3 --output .dev/performance/backend-results.json
npm --prefix frontend test -- --run src/features/reader/reader.performance.test.tsx
```

The generated corpora and raw JSON result are written below `.dev/performance`
and are intentionally ignored. The scripts reject fewer than three backend
runs. The frontend test prints a single `READER_PERFORMANCE` JSON line with
every sample and its median. Timings have no pass/fail threshold; deterministic
DOM, hash, reconstruction, and selection assertions are the regression gate.

## Deterministic corpora

The generator repeats one fixed Japanese paragraph containing ordinary kanji,
supplementary kanji (`𠮷`), emoji (`🍵`), punctuation, and a newline, then cuts
at the requested Unicode code-point count.

The frontend independently calculates UTF-8 SHA-256 with Node's crypto API for
every generated size and compares it with this same manifest before rendering.
Changing its seed or truncation behavior therefore fails with an explicit
`Corpus SHA-256 mismatch` instead of silently benchmarking a different corpus.

| Code points | UTF-8 bytes | SHA-256 |
|---:|---:|---|
| 10,000 | 30,000 | `ec761d9726a707bb282e42a9fe26c87c2a2932b86aef60afeb58952e58cf70a5` |
| 50,000 | 150,000 | `461f24f414ebdad896d96694a5830fa36c89193e6419fab4fabb25b853f2b8a7` |
| 100,000 | 300,000 | `cc78befca7c605dc3aeecb106357dfa9dc63d61631e06185db940f86cf600568` |
| 250,000 | 750,001 | `e655081d0c72d6cdeab498f784a540d0e9db4230daff0266e5023ba4451039c3` |

## Backend and transport

The first run exposed an N+1 query: every analyzed token queried SQLite for an
occurrence reading override even when the document had no overrides. A 10k
cProfile recorded 20,763 `ReadingOverrideResolver.resolve` calls across three
cold analyses. The one permitted optimization round added one document-level
existence check and bypasses per-token reads only when no override exists.
Documents with overrides keep the existing exact-occurrence resolution path.

| Code points | Blocks | Tokens | JSON MiB | Cold before | Cold after | Cache after | Peak RSS before | Peak RSS after |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10,000 | 193 | 6,921 | 2.29 | 3.422 s | 0.541 s | 0.258 s | 141.98 MiB | 136.63 MiB |
| 50,000 | 962 | 34,613 | 11.52 | 18.242 s | 2.324 s | 1.534 s | 287.03 MiB | 261.88 MiB |
| 100,000 | 1,924 | 69,231 | 23.05 | 37.101 s | 4.965 s | 3.153 s | 487.48 MiB | 359.91 MiB |
| 250,000 | 4,808 | 173,076 | 57.84 | 103.209 s | 12.836 s | 7.959 s | 1,074.01 MiB | 884.37 MiB |

Cold-analysis median improved by 84.2% at 10k and 87.6% at 250k. Response
shape, response byte count, blocks, tokens, SHA-256, and offset/surface
validation remained identical. Cold and cached payloads are both checked for
block bounds and contiguous coverage, ordered non-overlapping token bounds,
exact surfaces, preserved gaps, and full canonical-text reconstruction. Cache
time did not improve because it was not the chosen first bottleneck.

## Frontend

| Code points | Blocks | Token components | Render | Shared-key toggle |
|---:|---:|---:|---:|---:|
| 10,000 | 193 | 5,000 | 388 ms | 402 ms |
| 50,000 | 962 | 25,000 | 1,743 ms | 973 ms |
| 100,000 | 1,924 | 50,000 | 3,205 ms | 1,634 ms |
| 250,000 | 4,808 | 125,000 | 7,612 ms | 4,739 ms |

Raw frontend samples in milliseconds:

| Code points | Render samples | Toggle samples |
|---:|---|---|
| 10,000 | 877.725, 387.952, 295.188 | 476.735, 402.272, 149.174 |
| 50,000 | 1,743.473, 1,621.836, 1,791.155 | 1,031.485, 969.639, 973.069 |
| 100,000 | 3,374.133, 2,851.445, 3,204.556 | 1,663.539, 1,634.497, 1,602.285 |
| 250,000 | 7,611.625, 7,552.669, 8,215.538 | 3,644.586, 4,739.244, 5,209.978 |

For every size the test removes all `rt` nodes and proves the remaining native
text equals the canonical content exactly. It also proves there is no
`canvas`, `svg`, or image content; every selectable occurrence is represented
by semantic `ruby`/`rt`; and toggling one vocabulary key updates all matching
occurrences from one key set rather than per-character state.

## Compatibility gate

Automated semantic checks passed for 10k through 250k, including Unicode
reconstruction, native text, ruby/rt fallback, and shared-key selection.

The required manual Chrome, Edge, Firefox, copy, and Yomitan matrix is **not
approved** in this run. The automation inventory exposed only the Codex
in-app browser, with no Yomitan. A 250k navigation remained in `Preparando
leitura…` until the browser-control session timed out; a later attempt reported
that in-app-browser visibility is unavailable from the executing subagent.
Consequently no claim is made for manual selection/copy/Yomitan at the
beginning, middle, or end in any of the three target browsers.

Use this checklist on a workstation with all three browsers and Yomitan before
release:

| Browser | Start selection/copy/Yomitan | Middle | End | Status |
|---|---|---|---|---|
| Chrome | pending | pending | pending | blocked in this environment |
| Edge | pending | pending | pending | blocked in this environment |
| Firefox | pending | pending | pending | blocked in this environment |

## Decision and measured envelope

Optimization was required: the 250k cold path took 103 seconds and performed
one SQLite lookup per token. The single minimal optimization reduced that path
to 12.8 seconds without changing rendering or data contracts. No chunking,
virtualization, asynchronous-analysis contract, or arbitrary content limit was
introduced.

On this machine 10k is comfortable and 50k is usable with a visible initial
wait. At 100k, cache transport and dense DOM interactions are already
multi-second. At 250k, the 57.84 MiB response, roughly 0.9 GiB backend RSS,
8-second cache read, 7.6-second dense jsdom render, 4.7-second toggle, and failed
manual-browser attempt mean comfortable support is **not demonstrated**.

Per the Task 14 one-round limit, the remaining first candidates are documented
rather than changed: full-payload cache decode/JSON transport and dense DOM
rendering. Any future work must begin with a new measurement and revalidate
native selection, copy, ruby/rt, offsets, fallback furigana, and Yomitan before
considering block transport or virtualization.
