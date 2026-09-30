# Task 6 report — CORS, Docker, port, and API validation

## Status

Completed without application-side changes. The configured local transport and
published Docker host port agree with the generated note.com userscript.

## Findings and decisions

### CORS

- `backend/app/main.py` does not import or install `CORSMiddleware`.
- A live `OPTIONS /api/imports` request with `Origin: https://note.com` and
  `Access-Control-Request-Method: POST` returned `405 Method Not Allowed`,
  `allow: POST`, and no CORS response headers. This confirms the runtime has no
  browser-page CORS preflight support.
- The generated userscript instead declares `@grant GM_xmlhttpRequest` and
  `@connect 127.0.0.1`. Its generated configuration uses
  `http://127.0.0.1:8000/api/imports`.
- Tampermonkey documents `@connect` as the allowed-domain control for
  `GM_xmlhttpRequest` requests. Therefore no FastAPI CORS middleware is needed
  for the selected privileged transport, and no `allow_origins=*` change was
  made. Reference: <https://www.tampermonkey.net/documentation.php?ext=d2&q=GM_xmlhttpRequest>;
  <https://www.tampermonkey.net/documentation.php?ext=gcal&locale=de&q=connect&updated=true&version=4.12.6129>.

### Docker and port

- `Dockerfile` exposes and starts Uvicorn on container port `8000`.
- `docker-compose.yml` publishes `8000:8000`; its healthcheck targets the
  container-local `http://localhost:8000/api/health`.
- `docker compose config` resolved the published TCP port as `8000` and the
  container target as `8000`. It emitted warnings that the sandbox could not
  read the user's Docker CLI config, but exited successfully and produced the
  resolved compose configuration.
- Decision: retain the userscript base URL `http://127.0.0.1:8000`. It agrees
  with both direct local development (`npm run dev:backend`) and the host port
  published by Compose. No Docker or userscript configuration change is needed.

## Commands and results

| Check | Result |
| --- | --- |
| `docker compose config` | Passed: resolved host published port `8000` to container target `8000`. |
| `uv run pytest backend/tests/integration/test_public_import_api.py` | Reproduced documented baseline: 12 passed, 1 failed. The only failure expects lowercase `#ffffff` to return `422`, while the current contract accepts it and returns `201`; this task intentionally does not change that pre-existing discrepancy. |
| Temporary `uvicorn` on `127.0.0.1:8000`, disposable `DATABASE_PATH` | Passed: `GET /api/health` returned `200 {"status":"ok"}`; a note.com-shaped `POST /api/imports` returned `201` with source and tag `note.com`. The process and temporary database were removed after the check. |
| Browser-style preflight against the temporary server | Confirmed no CORS handling: `OPTIONS /api/imports` returned `405` with no CORS headers. |
| `node .\\frontend\\node_modules\\vitest\\vitest.mjs run userscript/note-import --reporter=verbose` | Passed: 35 tests across the extractor, client, and UI files. |
| `node --check userscript\\note-import\\note-import.user.js` | Passed: generated userscript bundle parses successfully. |

## Changed files

- `.superpowers/sdd/note-com-userscript-import/task-6-report.md` (this report only).

## Passed, blocked, and unverified

- Passed: port/configuration agreement; Compose port resolution; direct local
  health and public import API path; deterministic userscript tests and bundle
  syntax.
- Blocked: none for the requested configuration and API validation. The
  documented public-import test baseline remains 12 passed / 1 known failure.
- Unverified: an installed Tampermonkey instance executing the generated script
  on a live note.com article; actual Docker image build/container startup and
  its healthcheck. Direct API results do not constitute browser/Tampermonkey
  execution evidence.
