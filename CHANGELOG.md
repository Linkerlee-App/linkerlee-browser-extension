# Changelog

All notable user-facing changes to the Linkerlee Bookmarker extension.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version
here must match `version` in both `package.json` and `manifest.json` — bump all three
together, or the built extension ships mislabelled.

Issue keys refer to the `COW` project in Linear.

## [0.9.0] — 2026-08-20

### Added

- Unsaved tag and title work is no longer lost when the popup closes. Clicking
  outside an extension popup destroys it instantly, and MV3 offers no cancellable
  close event, so a warning *at* close time is not possible. Instead the popup
  warns while it is open — a banner and a ring on Save as soon as the form differs
  from what was loaded — and keeps the draft, per URL, restoring it the next time
  you open the popup on that page. The draft is folded back in as a delta rather
  than replayed, because saving replaces the whole tag set and a stale replay would
  delete tags added on the platform in the meantime. (COW-50)
- A **Remove** button for a page that is already bookmarked, with an inline
  "Remove this bookmark?" confirmation rather than a native dialog, which an
  extension popup cannot show reliably. Removal is a soft delete and the status
  says so — the link is recoverable from your Linkerlee trash. Needs the platform
  running the matching `DELETE /api/links/{id}` endpoint. (COW-54)
- The extension version in the popup footer, on both the form and the
  not-yet-configured screen, read from the manifest so it cannot drift from what
  the browser installed. (COW-55)

### Fixed

- The popup no longer paints its form before the script runs, and the
  not-yet-configured screen no longer shows the whole form underneath its "this
  extension isn't configured yet" message. `form { display: grid }` outranked the
  browser's own `[hidden]` rule, so hiding the form did nothing. The same cascade
  bug had silently removed the entire confirmation step from the new Remove
  button. Hidden now means hidden. (COW-54)
- `npm run typecheck` passes again. A merge resolved an import conflict by keeping
  both sides, leaving `getConfig` imported twice; the build tolerated it, so
  nothing went red on the way in.

### Internal

- Vitest, with the draft merge, the draft prune and the stored-record validation
  under test — the logic where a mistake silently loses or deletes a user's tags.
  There is still no CI, so `npm test`, `npm run typecheck`, `npm run build` and
  `web-ext lint` remain a local discipline. (COW-53)

## [0.2.0] — 2026-08-18

### Added

- A link back to the Linkerlee platform in the popup, in a footer row below the save
  button. The popup was a dead end: after saving there was no route to your account.
  The same link appears on the not-yet-configured screen, which asked for an API
  token without saying the token is generated on the platform. Both follow the base
  URL configured in Options rather than a hardcoded host. (COW-48)

### Fixed

- The tag suggestion list no longer covers the save button. It was absolutely
  positioned, so it overlaid the save row as soon as it had more than a couple of
  entries; and because an absolutely positioned element adds no height, the popup
  never grew for it and a long list was clipped at the popup's bottom edge. It is now
  laid out in flow, reserving its own space while open and collapsing when closed, so
  the closed layout is unchanged. Note the save button now shifts down while the list
  is open. (COW-47)

## [0.1.0] — 2026-08-11

### Added

- Initial release. Save the current tab to Linkerlee from the toolbar popup, with the
  URL and page title pre-filled.
- Tag suggestions for the current page, plus search over your existing tags and
  creating new ones inline.
- Re-opening the popup on an already-bookmarked page loads its existing tags and
  switches the action to an update.
- Options page for the base URL and API token, with a **Test connection** check.
- A badge on the toolbar icon marking tabs whose link is already saved.
- Chrome (MV3) and Firefox builds from one source, with the Firefox background
  fallback applied at build time.
