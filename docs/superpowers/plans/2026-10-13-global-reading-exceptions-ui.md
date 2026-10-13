# Global reading exceptions UI — implementation plan

> **For the implementer:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to execute this plan task by task.

**Goal:** Add a dedicated, accessible frontend screen at `/reading-exceptions` that lets users manage active global lemma-reading exceptions through the existing API.

**Architecture:** Keep HTTP details in `DocumentClient`, sourced from the generated OpenAPI types. A route-owned React Query page loads the active catalog, invalidates it after mutations, and owns transient form, inline-edit, status, and deletion-confirmation state. The route and header expose the page outside Settings, while page-prefixed CSS adopts the Tags page’s visual language without changing it.

**Tech Stack:** React 19, TypeScript, TanStack React Query, Vitest, Testing Library, Vite, generated OpenAPI types.

**Scope boundaries:** Do not change the API, analysis/cache behavior, Settings page, lemma editing, inactive/deleted-item listing, restore controls, search, pagination, or sorting. The client must call only the active-list, PUT, and DELETE API operations in this slice.

## Task 1: Expose the existing reading-exceptions API in the typed frontend client

**Files:**
- Modify: `frontend/src/shared/api/client.ts`
- Modify: `frontend/src/shared/api/client.test.ts`

**Step 1: Add the client contract test first**

Add a test covering the three operations with a lemma that needs URL encoding. Assert:

- listing calls `GET /api/reading-exceptions` and returns generated response objects;
- saving calls `PUT /api/reading-exceptions/{encoded lemma}` with only `{ reading }` and returns the response for both create/update status codes;
- removal calls `DELETE` on the same encoded resource and returns its response.

Keep the existing `ApiError` tests as the shared proof that problem-details reach page callers.

**Step 2: Run the focused client test and confirm it fails**

Run: `npm run test -- --run src/shared/api/client.test.ts`

Expected: failure because the reading-exception methods/types do not yet exist.

**Step 3: Add generated-type aliases and request methods**

In `client.ts`:

- derive `ReadingException` and the save request type from `components['schemas']` in `generated.ts`;
- add one encoded resource-path helper to avoid interpolating an unescaped lemma;
- implement `listReadingExceptions`, `setReadingException(lemma, payload)`, and `deleteReadingException(lemma)` with the negotiated endpoint paths and verbs;
- keep these additions optional on `DocumentClient`, matching the existing extensible tags/import contract so unrelated test doubles and legacy consumers remain valid; the page itself must explicitly handle an unavailable method.

Do not add `includeDeleted`, restore, or a locally redefined response shape.

**Step 4: Run the focused test again**

Run: `npm run test -- --run src/shared/api/client.test.ts`

Expected: pass.

**Step 5: Commit**

```bash
git add frontend/src/shared/api/client.ts frontend/src/shared/api/client.test.ts
git commit -m "feat(readings): expose exception client"
```

## Task 2: Build the catalog page with CRUD interactions and accessibility coverage

**Files:**
- Create: `frontend/src/features/reading-exceptions/ReadingExceptionsPage.tsx`
- Create: `frontend/src/features/reading-exceptions/ReadingExceptionsPage.test.tsx`
- Modify: `frontend/src/styles/global.css`

**Step 1: Write the page tests first**

Create focused tests using an injected `DocumentClient` and a React Query provider. Cover these acceptance cases:

- loading, active-list rendering in API order, empty state, list error, and retry;
- disabled add action for either empty field; successful add sends lemma plus reading, invalidates/refetches, clears the fields, and announces “Exceção adicionada.”;
- inline reading-only edit saves through PUT and announces “Exceção atualizada.”; cancel makes no API call and keeps lemma immutable;
- removal first opens an accessible confirmation dialog, then DELETE plus refresh announces “Exceção removida.”; cancel and Escape do not delete and restore focus to the opening remove button;
- a problem-details mutation failure displays its `detail` in a `role="alert"`, while a generic failure uses the neutral operation-specific fallback;
- controls relevant to each pending save/delete state are disabled; statuses use `role="status"` with polite live announcement.

Use deferred promises for at least one pending-operation assertion rather than testing only synchronously resolved mocks.

**Step 2: Run the focused page test and confirm it fails**

Run: `npm run test -- --run src/features/reading-exceptions/ReadingExceptionsPage.test.tsx`

Expected: failure because the page does not exist.

**Step 3: Implement the page around the client contract**

Implement `ReadingExceptionsPage` with:

- `useQuery` keyed by `['reading-exceptions']`, whose query function calls `listReadingExceptions`; if that optional client method is unavailable, fail with an explicit API-unavailable error so the existing error/retry UI has deterministic behavior;
- a top form labeled `Lemma` and `Leitura`, with `Adicionar exceção`; trim only for empty-field eligibility, leaving canonical validation/normalization to the backend;
- one mutation path for creation and inline reading updates through `setReadingException`, followed by query invalidation only after success;
- a row-local edit state whose cancel action changes no remote data;
- a deletion confirmation dialog patterned after `TagManagementPage`, including dialog labelling, initial focus, Escape cancellation, and focus return;
- success and error state handling that extracts `ApiError.problem?.detail` when available and otherwise uses an operation-specific neutral Portuguese message;
- no call to inactive-list or restore endpoints, and no lemma edit control.

Do not optimistically mutate the catalog: refresh it from the server after each successful write so its ordering remains backend-owned.

**Step 4: Add isolated presentation styles**

In `global.css`, add page-prefixed `.reading-exceptions-page...` selectors for the catalog layout, compact add form, rows, inline edit controls, empty/loading/error states, and small-screen stacking. Reuse existing dialog styling only where it already applies; do not broaden Tag Management selectors or alter its appearance.

**Step 5: Run the focused page test again**

Run: `npm run test -- --run src/features/reading-exceptions/ReadingExceptionsPage.test.tsx`

Expected: pass.

**Step 6: Commit**

```bash
git add frontend/src/features/reading-exceptions/ReadingExceptionsPage.tsx frontend/src/features/reading-exceptions/ReadingExceptionsPage.test.tsx frontend/src/styles/global.css
git commit -m "feat(readings): manage exceptions page"
```

## Task 3: Integrate the route and primary navigation

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/app/App.test.tsx`

**Step 1: Write routing/navigation coverage first**

In the app-level test suite, add a test that renders with `initialPath="/reading-exceptions"` and a client that lists one exception. Assert the page heading is present, the new header link points to `/reading-exceptions`, and it exposes `aria-current="page"`. Add a navigation interaction from another route if the established test helpers make that clearer.

**Step 2: Run the focused app test and confirm it fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: failure because the route and header link are not registered.

**Step 3: Register the route and link**

- import and route `ReadingExceptionsPage` for the exact `/reading-exceptions` path;
- add the third header navigation item titled `Exceções de leitura`, using the established accessible-link and active-state pattern; add an inline icon through the existing `HeaderIcon` mechanism rather than a new icon dependency;
- preserve existing Tags and Settings navigation behavior and order them consistently with the approved three-link header design.

**Step 4: Run focused integration tests**

Run:

```bash
npm run test -- --run src/app/App.test.tsx src/features/reading-exceptions/ReadingExceptionsPage.test.tsx src/shared/api/client.test.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/app/App.tsx frontend/src/app/App.test.tsx
git commit -m "feat(readings): add exception navigation"
```

## Task 4: Perform regression and visual verification

**Files:**
- Verify only; do not expand product scope for unrelated failures.

**Step 1: Run automated frontend gates**

Run:

```bash
npm run test -- --run
npm run build
git diff --check
git status --short
```

Record each result separately. If the full suite has an existing environmental or unrelated failure, retain its complete evidence and do not conceal it by treating the focused passes as full-suite proof.

**Step 2: Manually validate the user flow**

Use the local application with a controlled API response and inspect `/reading-exceptions` at desktop and narrow widths. Confirm:

- navigation is visible, focused, and has the intended active state;
- loading, empty, populated, edit/cancel, failed mutation, and confirmation/cancel flows are understandable;
- the dialog focus sequence and keyboard Escape behavior work;
- form and row controls do not overlap or become unreadable on small screens.

Treat this as separate visual evidence; successful tests/build do not prove it.

**Step 3: Final review and commit outcome**

Inspect the complete task diff for accidental API/backend changes, inactive/deleted UI, Settings changes, and unscoped formatting. Confirm only task-owned files are staged before committing the final verification-related change, if any. If no files changed in Task 4, make no empty commit.

## Review focus

The reviewer must trace these scenarios across client, page, route, and tests:

1. **Active-only catalog:** `GET /api/reading-exceptions` has no `includeDeleted`; deleted entries and restoration never surface in UI.
2. **Correct write semantics:** add and inline update both use encoded-lemma PUT with exactly `{ reading }`; delete only runs after confirmation.
3. **Server authority:** kana validation and catalog order remain backend-owned; every successful mutation refreshes instead of applying a speculative local ordering.
4. **Failure/pending safety:** problem-details are visible, generic errors remain neutral, and pending controls prevent duplicate writes without disabling unrelated recovery.
5. **Keyboard/accessibility:** labels, live status/error roles, dialog semantics, Escape behavior, and focus restoration remain intact after adding the new nav route.
