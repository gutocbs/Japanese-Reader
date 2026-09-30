# Docker Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task.

**Goal:** Package the Japanese Reader as a single Docker service that serves the compiled React SPA, FastAPI API, and persistent SQLite database.

**Architecture:** Build the Vite frontend in a Node stage, copy its `dist` output and the Python application into a Python 3.12 runtime image, and serve the SPA from FastAPI. Compose publishes port 8000, mounts `./data` at `/app/data`, and checks `/api/health`.

**Tech Stack:** Docker multi-stage build, Docker Compose, Python 3.12, FastAPI/Uvicorn, React/Vite, SQLite.

**Spec:** `docs/superpowers/specs/2026-09-30-docker-packaging-design.md`

## Global Constraints

- Keep the local Vite/Uvicorn development workflow unchanged.
- Use `DATABASE_PATH=/app/data/japanese-reader.db` inside the container.
- Publish one application origin on port `8000`.
- Do not add production TLS, external reverse proxy, registry publishing, or orchestration.
- Do not add runtime dependencies beyond the locked Python and frontend dependencies.

## Review Focus

- SPA deep links must return `index.html` while `/api/*` remains handled by FastAPI.
- A missing or empty `data` directory must be created by the application before SQLite migrations run.
- Container recreation must retain the SQLite file through the Compose bind mount.
- The image build must not copy `node_modules`, local Vite output, `.venv`, `.dev`, or local databases.
- Healthcheck failures must be visible and must not silently report a healthy container.

### Task 1: Serve the compiled SPA from FastAPI

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_health.py` or a new `backend/tests/test_static_app.py`

**Interfaces:**
- Produces static asset and SPA fallback routes for the runtime image.

- [ ] **Step 1: Write the failing tests**

Add tests that create the app with a temporary static directory, verify an existing asset is returned, verify a non-API deep link returns `index.html`, and verify `/api/health` remains JSON.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `uv run pytest backend/tests/test_static_app.py -v`

Expected: FAIL because the current app does not mount the compiled frontend.

- [ ] **Step 3: Implement static serving**

Add an optional static-directory configuration to `create_app`, mount assets when the directory exists, and add a non-API fallback that serves `index.html`. Keep API routes registered before the fallback and preserve the current default behavior when no build directory exists.

- [ ] **Step 4: Run focused tests and the backend suite**

Run: `uv run pytest backend/tests/test_static_app.py backend/tests/test_health.py -v` and then `uv run pytest`.

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/main.py backend/tests/test_static_app.py backend/tests/test_health.py
git commit -m "feat: serve compiled frontend from FastAPI"
```

### Task 2: Add the Docker image and Compose runtime

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: `frontend/dist` from the Node build stage and the FastAPI app entrypoint `backend.app.main:app`.
- Produces: one service on container port 8000 with `/app/data` as the SQLite data directory.

- [ ] **Step 1: Add build/runtime configuration**

Use a Node stage based on a supported Node release to run `npm ci` and `npm run build`, then a Python 3.12 runtime that installs the locked project dependencies with `uv sync --frozen --no-dev` and copies the backend plus compiled frontend. Set `DATABASE_PATH`, expose 8000, and run Uvicorn on `0.0.0.0:8000`.

- [ ] **Step 2: Add Compose persistence and healthcheck**

Define service `japanese-reader`, publish `8000:8000`, mount `./data:/app/data`, and check `http://localhost:8000/api/health` using a Python standard-library request so no extra runtime utility is required.

- [ ] **Step 3: Add the build context exclusions**

Exclude Git metadata, `node_modules`, `frontend/dist`, Python environments, local logs, test caches, and `data` from the image context.

- [ ] **Step 4: Validate Compose configuration**

Run: `docker compose config`

Expected: exit code 0 with the resolved service, volume, environment, and healthcheck.

- [ ] **Step 5: Build and run when Docker is available**

Run: `docker compose build` followed by `docker compose up -d`, then `curl http://localhost:8000/api/health` and `docker compose ps`.

Expected: image build succeeds, health returns `{"status":"ok"}`, and the service reports healthy.

- [ ] **Step 6: Commit**

```powershell
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "build: add Docker packaging"
```

### Task 3: Document Docker usage and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents the commands and persistence contract produced by Task 2.

- [ ] **Step 1: Document build, start, stop, logs, and data location**

Add a Docker section that explains `docker compose build`, `docker compose up -d`, the URL, `docker compose logs -f`, `docker compose down`, and that `./data/japanese-reader.db` is persistent and should be backed up before removal.

- [ ] **Step 2: Document local versus Docker workflows**

Make clear that Docker is an optional packaged runtime and that `npm run dev` remains the recommended development loop.

- [ ] **Step 3: Run final verification**

Run: `uv run pytest`, `npm --prefix frontend test -- --run`, `npm run build`, `docker compose config`, and, when the daemon is available, the Compose healthcheck and a browser/API smoke check.

- [ ] **Step 4: Commit**

```powershell
git add README.md
git commit -m "docs: document Docker runtime"
```
