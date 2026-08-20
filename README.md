# Linkerlee Bookmarker

A Chrome (MV3) extension that bookmarks the current tab into Linkerlee with tag suggestions.

## Setup

1. `npm install`
2. `npm run build` — produces `dist/`
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.
4. Open Linkerlee → **Settings → API tokens**, create a token, copy the value.
5. In the extension, open **Options** (right-click the icon → Options) and paste:
   - **Base URL** — your Linkerlee URL (default `https://linkerlee.com`)
   - **API token** — the token you just generated
6. Click **Test connection** to confirm.

## Usage

Click the extension icon on any page. The popup pre-fills the URL and title, shows tags that look relevant to the page, and lets you pick more from your tag list. Hit **Save**.

> Tags must already exist in Linkerlee (create them on the web). The extension does not create new tags.

## Development

```
npm run dev      # Vite dev server with HMR (load dist/ as unpacked extension)
npm run build    # one-shot production build
npm run typecheck
npm test         # Vitest, once
npm run test:watch
```

There is no CI, so these are the only checks a change gets — run them before
opening a PR, along with `npx web-ext lint --source-dir=dist --self-hosted`
(0 errors; 2 warnings are the known Firefox baseline).

Tests cover the pure logic in `src/lib` — the draft merge, the prune, the
stored-record validation — the parts where a mistake quietly loses or deletes
a user's tags. UI wiring in `popup.ts` is not covered; that still needs the
extension loaded from `dist/` in a browser.
