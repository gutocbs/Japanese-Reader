# Task 7 report — final validation and handoff

## Scope and repository state

This validation inspected the approved `userscript/note-import` integration
without changing application code. The working tree was clean before this task.
The only final changes are this report and the userscript README handoff update.

## Checklist and fresh command evidence

| Check | Command | Result |
| --- | --- | --- |
| Full repository suite | `npm test` | Exit `1`. Pytest collected 281 backend tests and reached the existing `test_public_import_api.py` failure. The `&&` chain therefore did not start the frontend Vitest suite. Pytest then raised `PermissionError: [WinError 5] Access is denied: C:\\Users\\gutoc\\AppData\\Local\\Temp\\pytest-of-gutocbs\\pytest-current` during numbered-temp cleanup. A first sandboxed attempt also could not initialize `C:\\Users\\gutoc\\AppData\\Local\\uv\\cache` (`WinError 5`). |
| Public-import integration, isolated temp | `uv run pytest backend/tests/integration/test_public_import_api.py --basetemp .task7-pytest-temp` | Exit `1`: **12 passed, 1 failed** in 0.52 s. The only failure is `test_public_import_rejects_malformed_payloads[payload7]`: `#ffffff` returned `201`, while the test expects `422`. No cleanup error occurred in this isolated run. |
| Focused userscript suite | `node .\\frontend\\node_modules\\vitest\\vitest.mjs run userscript/note-import --reporter=verbose` | Exit `0`: **3 files, 35 tests passed** (Vitest 5.0.2). |
| Bundle regeneration | `node userscript/note-import/build-userscript.mjs` | Exit `0`; regenerated `userscript/note-import/note-import.user.js` with no content diff. |
| Bundle syntax | `node --check userscript/note-import/note-import.user.js` | Exit `0`. |
| Whitespace/diff integrity | `git diff --check` | Exit `0`. Git emitted unrelated warnings that the global ignore file could not be read and that the generated userscript would be converted from LF to CRLF if Git rewrites it; neither produced a diff-check error. |

`node --test userscript/note-import/*.test.js` was also tried but is not the
project test runner: all three files failed to resolve the `vitest` package from
the repository root. The focused-suite result above uses the declared frontend
Vitest runtime and is the authoritative userscript test result.

## Contract evidence

The passing userscript tests verify that an extracted article maps to the strict
public-import payload with its article title and text, the current article URL
as `description`, `source: "note.com"`, and exactly
`{ "name": "note.com", "color": "#7C3AED" }` in `tags`. The generated
bundle declares `@match https://note.com/*`, `@grant GM_xmlhttpRequest`,
`@connect 127.0.0.1`, and sends to
`http://127.0.0.1:8000/api/imports` with a 10,000 ms timeout.

The 12 passing public-import integration cases additionally demonstrate the
existing backend behavior: imported text is preserved exactly (including
leading/trailing whitespace, CRLF/LF, and emoji), and title, description,
source, tags, revision, and timestamps are returned and persisted. The failed
case is the known baseline discrepancy only: lowercase `#ffffff` is accepted
with `201`, contrary to that test's expected `422`. This task intentionally
does not change the backend or test to hide it.

## Passed, blocked, and unverified

- **Passed:** focused userscript coverage for supported and unsupported pages,
  meaningful extracted text, API `422`/`503`/network/timeout handling,
  repeated-click protection, navigation updates, bundle generation, syntax, and
  diff whitespace validation.
- **Blocked:** the full `npm test` command is nonzero because of the known
  `#ffffff` baseline failure; its cleanup also encounters the Windows Temp
  permission error. The frontend portion is not run by that command because
  the backend command precedes it with `&&`.
- **Unverified:** an installed Tampermonkey running the bundle on a live normal
  note.com article; live non-article behavior; live meaningful-formatting
  extraction; live stopped/error API behavior; live repeated clicks; Docker
  image build/container startup and healthcheck. Automated tests are not a
  substitute for those browser or Docker checks.

## Handoff

1. Start the local backend with `npm run dev:backend`.
2. Import `userscript/note-import/note-import.user.js` into Tampermonkey.
3. Perform the unverified live checks above on note.com. Keep the current
   backend behavior for `#ffffff` visible as a known baseline discrepancy.
4. When userscript source files change, regenerate the bundle and rerun the
   focused Vitest command before reinstalling it.
