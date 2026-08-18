---
name: ship-it
description: Finalize a Linkerlee Bookmarker change end-to-end — adversarial review of the whole feature, typecheck, build, web-ext lint, a browser smoke test, a conventional commit, and open a PR. Auto-invoke when the user says "ship it", "wrap this up", "finalize", "ready to commit/PR", "open a PR for this", or otherwise signals a feature/fix is done and should go out. Orchestrates the project's definition-of-done; do not skip steps.
---

# Ship it — Linkerlee Bookmarker definition of done

Take the current change from "code written" to "PR opened" for this MV3 browser
extension (TypeScript + Vite + `@crxjs/vite-plugin`, Chrome and Firefox). Work top
to bottom. If a step surfaces a real problem, **stop and report it** rather than
pushing broken work.

There is **no test runner and no CI** in this repo. Nothing catches a regression
after the fact, so steps 1–5 are the only safety net — do not skip them on the
grounds that "it's a small change".

## 0. Scope the feature
- Make sure you're on a feature branch, not `main`. If on `main`, branch first
  (`git switch -c <type>/<short-name>`).
- `git fetch origin` and check `git log HEAD..origin/main`; rebase if you're behind.
- Determine the **full feature diff**, not just the last edit:
  `git diff origin/main...HEAD` plus staged/unstaged/untracked changes.

## 1. Adversarial review of the entire feature (do this first)
Review the complete diff with an **adversarial mindset — try to break it**, not to
praise it. Prefer launching review subagents in parallel
(`pr-review-toolkit:code-reviewer`, `pr-review-toolkit:silent-failure-hunter`) and
consolidating findings. Note `/code-review` is user-triggered and billed — you
cannot launch it; suggest it if the change warrants that depth.

Hunt for the failure modes this codebase actually produces:

- **Host permissions vs. the configurable base URL.** `manifest.json` grants
  `https://linkerlee.com/*` only, but `src/lib/storage.ts` lets the user set any
  `baseUrl`. Any new `fetch` inherits that mismatch: a self-hosted instance fails
  with an opaque network error, not a 4xx. Any new origin you talk to needs a
  matching `host_permissions` entry (or an `optional_host_permissions` +
  `chrome.permissions.request` flow) — check this whenever a diff adds a fetch.
- **The MV3 service worker is ephemeral.** `src/background/background.ts` gets torn
  down and restarted at will. Module-scope variables do **not** survive; anything
  that must persist belongs in `chrome.storage`. Timers (`setTimeout`/`setInterval`)
  and unawaited promises die with the worker — use `chrome.alarms` and keep event
  handlers `await`-complete.
- **Firefox parity.** The build is dual-target: `scripts/patch-manifest.mjs`
  back-fills `background.scripts` because Firefox ignores `service_worker`, and
  `browser_specific_settings.gecko` pins `strict_min_version: 140`. A Chrome-only
  API (`chrome.offscreen`, `chrome.sidePanel`, `declarativeNetRequest` niceties, MV3
  `chrome.scripting` extras) silently breaks Firefox. Feature-detect, or say
  explicitly in the PR that the feature is Chrome-only.
- **Token handling.** The API token lives in `chrome.storage.local`. It must never
  be logged (`console.*`), never put in a URL or query string, and never sent to any
  origin other than the configured `baseUrl`. `apiFetch` in `src/lib/api.ts` is the
  only place that should attach `Authorization` — a new bare `fetch` that
  hand-rolls the header is a review finding.
- **Non-http(s) and dead tabs.** Background listeners run for `chrome://`,
  `about:`, `file://` and extension pages too. Keep the `isSaveable()` guard, and
  keep `chrome.tabs.get()` calls in a `try` — the tab may have closed mid-check.
- **Popup lifecycle.** The popup document is destroyed the moment it loses focus.
  In-flight promises in `src/popup/popup.ts` are dropped with no rejection handler,
  so a "save" that only resolves in the popup can be lost. Long or must-complete
  work belongs in the background worker via `chrome.runtime.sendMessage`.
- **Silent failures.** `ApiError` carries `status` and `fieldErrors` — check that
  new code surfaces them to the user rather than swallowing them into a generic
  message, and that empty `catch {}` blocks have a comment justifying the swallow
  (the two existing ones do).
- **API contract drift.** `src/lib/types.ts` is hand-written against the Linkerlee
  REST API; nothing validates the response at runtime. A field renamed server-side
  shows up as `undefined` in the UI. Guard optional fields rather than trusting the
  cast, and flag any new endpoint whose shape you could not verify.
- **TS strictness.** `strict` + `noUncheckedIndexedAccess` are on. A non-null
  assertion (`!`) or an `as` cast added to silence the compiler is a finding —
  narrow properly instead.
- **Version sync.** `manifest.json` `version` and `package.json` `version` must
  match. Bumping only one ships a mislabelled build.
- **Build artifacts.** `dist/` is gitignored; `web-ext-artifacts/` is **not** yet.
  Never commit either.

Fix blocking issues (or surface them clearly if they need a decision). Re-review if
you changed anything substantive. Keep the consolidated findings — they go in the
PR body.

If the change adds non-trivial pure logic (URL normalisation, tag matching and the
like) and you feel the absence of a regression test, **say so and propose adding
Vitest** as a follow-up. Do not silently invent a test setup as part of the ship.

## 2. Typecheck
```bash
npm run typecheck
```
The baseline is **clean** — zero errors. Any error is yours; fix it, don't count it.

## 3. Build
```bash
npm run build
```
Must succeed, and the `postbuild` step must print
`patched dist/manifest.json: added background.scripts fallback for Firefox`.
If that line is missing, the Firefox background fallback did not apply — check
`scripts/patch-manifest.mjs` against your manifest change.

## 4. Lint the packaged extension
```bash
npx --yes web-ext lint --source-dir=dist --self-hosted
```
The bar is **0 errors**. There is a known **2-warning baseline**, both expected:
`BACKGROUND_SERVICE_WORKER_IGNORED` (Firefox uses the patched `background.scripts`)
and `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` (`strict_min_version` 140 vs
the 142 that Android needs for `data_collection_permissions`). A **third** warning
is a regression — report it. Re-run after any `manifest.json` edit.

## 5. Smoke test in the browser
A green build proves nothing about extension behaviour — the Chrome APIs only exist
when it's loaded. Ask the user to reload the unpacked extension at
`chrome://extensions` (pointing at `dist/`) and confirm; you cannot do the file-picker
step yourself. Then exercise, using the `claude-in-chrome` tools where they help:

- **Popup** (any surface under `src/popup/`): open it on a normal page — URL and
  title pre-fill, tag suggestions load, save succeeds, an already-saved link shows
  its existing tags.
- **Options** (`src/options/`): save a base URL + token, then **Test connection**.
- **Background** (`src/background/`): switch tabs — the `✓` badge appears on a saved
  link and clears on an unsaved one and on a `chrome://` tab.
- Check the service-worker console at `chrome://extensions` → **service worker** for
  uncaught errors; `read_console_messages` with pattern `\[linkerlee\]` filters the
  extension's own logs.

Report what you actually exercised. If the user declines the reload, say the change
went out **unverified in-browser** rather than implying it was tested.

## 6. Commit
Invoke the **`git-commit`** skill (Conventional Commits). Repo style:
- End the message with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Explain *why*, not just what — name the wrong assumption that was fixed and any
  behaviour change that is not a no-op.
- Only commit already-staged files; don't `git add` for the user unless asked.
- Never stage `dist/`, `node_modules/`, or `web-ext-artifacts/`.

## 7. Open the PR
- Push: `git push -u origin <branch>`.
- `gh pr create --base main` on `andreifiroiu/linkerlee-browser-extension`.
- **PR body**: short summary, then an **"Adversarial review"** section with the
  consolidated findings from step 1 — what was checked, what was fixed, residual
  risks and deliberate out-of-scope items — then a **"Verified"** section listing
  typecheck / build / web-ext lint results and exactly which browser surfaces you
  smoke-tested (and in which browser). End with the
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer.
- Return the PR URL.

**There are no CI checks on this repo** (no `.github/workflows`). Do not wait on
`gh pr checks` — say plainly that verification was local.

## Releasing (only when the user asks)
Bump `version` in **both** `manifest.json` and `package.json`, rebuild, then
`npx --yes web-ext build --source-dir=dist --overwrite-dest` — the zip lands in
`web-ext-artifacts/`. Uploading to the Chrome Web Store or AMO is the user's call.

## Merging
**Do not merge unless the user asks.** If `gh pr merge` is permission-denied, stop
and hand the decision back rather than routing around it (e.g. by merging locally
and pushing to `main`).

## Output
A short report: review verdict (what you tried to break, what actually broke, what
you fixed), typecheck result, build result, web-ext lint errors/warnings against the
2-warning baseline, what you smoke-tested in the browser, commit subject, and the PR
URL. State anything you deliberately left out of scope, and any behaviour change
that is not a no-op.
