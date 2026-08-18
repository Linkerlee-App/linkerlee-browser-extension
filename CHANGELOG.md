# Changelog

All notable user-facing changes to the Linkerlee Bookmarker extension.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version
here must match `version` in both `package.json` and `manifest.json` — bump all three
together, or the built extension ships mislabelled.

Issue keys refer to the `COW` project in Linear.

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
