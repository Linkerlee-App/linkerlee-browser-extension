# Contributing to the LinkerLee extension

Thanks for considering it. This is the browser extension client for
[LinkerLee](https://github.com/linkerlee-app/linkerlee) — bugs in the web app or the API
belong in that repository, not here.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
For security problems, see [SECURITY.md](SECURITY.md) — do not open an issue.

## Getting set up

```bash
npm install
npm run build
```

Then load `dist/` as an unpacked extension: `chrome://extensions` → **Developer mode** →
**Load unpacked**.

You need somewhere to point it. Either an account on linkerlee.com or a local instance of
the [platform](https://github.com/linkerlee-app/linkerlee) — its README covers `composer
setup`. Create a token at **Settings → API tokens** and paste it, along with the base URL,
into the extension's Options page.

For a local instance the base URL is `http://localhost:8000`. The browser will ask you to
allow access to that host; the default `https://linkerlee.com` needs no prompt.

## Before opening a PR

CI runs all of these, so run them first:

```bash
npm run typecheck
npm test
npm run build
npx web-ext lint --source-dir=dist --self-hosted
```

`web-ext lint` should report **0 errors**. Two warnings are the known Firefox baseline and
are documented in [AMO-SUBMISSION.md](AMO-SUBMISSION.md); anything beyond those two needs
explaining in the PR.

Commits follow [Conventional Commits](https://www.conventionalcommits.org), matching the
existing history (`feat:`, `fix:`, `chore:`, `docs:`). Branch off `main` as
`<type>/<short-name>`.

## What to be careful about

- **The API token is a bearer credential** with write and delete access to the user's
  links. Never log it, never put it in a URL, never expose it to page context. Changes
  touching `src/lib/storage.ts` or `src/lib/api.ts` deserve a second look.
- **Tag handling loses data quietly when wrong.** `PUT /api/links/{id}` on the platform
  replaces the tag set wholesale rather than merging, so the extension must always send the
  complete desired set. The tests in `src/lib/drafts.test.ts` exist because this is exactly
  the kind of mistake that silently deletes someone's tags. Keep them passing, and add to
  them when you touch the merge or prune logic.
- **Host permissions** are requested at runtime for non-default base URLs. Do not widen the
  static permissions in `manifest.json` to avoid a prompt — store review will notice, and
  it is worse for the user.
- **The manifest is patched after build.** `scripts/patch-manifest.mjs` adds the Firefox
  `background.scripts` fallback. If you change the background entry point, check the patch
  still applies.

## Tests

Vitest, covering the pure logic in `src/lib` — the draft merge, the prune, stored-record
validation. UI wiring in `popup.ts` is not covered and still needs the extension loaded in
a browser to verify; say what you tested manually in the PR.

## Releasing

Maintainers only. Bump the version in `package.json` and `manifest.json`, update
[CHANGELOG.md](CHANGELOG.md), then follow [AMO-SUBMISSION.md](AMO-SUBMISSION.md) for the
Firefox listing.
