# Submitting to addons.mozilla.org

Working notes for uploading a new version. Keep in step with the code — the
reviewer notes below describe behaviour, and a reviewer will check.

## 1. Package

```
npm ci
npm run build                                        # postbuild patches the Firefox background fallback
npx web-ext lint --source-dir=dist                   # must be 0 errors
npx web-ext build --source-dir=dist --overwrite-dest  # zip lands in web-ext-artifacts/
```

Upload the zip matching the version in `manifest.json`. Delete stale zips from
`web-ext-artifacts/` first — nothing but the filename distinguishes a current
build from one with a known bug in it.

## 2. Reviewer notes — paste this into the private notes box

> Linkerlee is self-hostable, so the extension must be able to reach whichever
> instance the user runs. `optional_host_permissions` is **never granted at
> install**: the extension calls `permissions.request()` for the single origin
> the user enters on the options page, and releases the previous one when that
> address changes. A runtime request must match a declared pattern, which is why
> the declaration is broad while every grant is one concrete host.
>
> Only https is accepted — over http the API token would cross the network in
> plain text. URLs carrying credentials are refused, since
> `https://linkerlee.com@example.invalid` reads as the trusted host and resolves
> elsewhere, and so are hostnames that are not plain DNS labels, which is what
> prevents a request for one host from widening into a wildcard.
>
> The default configuration talks only to `https://linkerlee.com` and prompts
> for nothing. The extension has no backend of its own, contacts no third party,
> and contains no analytics, telemetry or remote code. It reads only the URL and
> title of the active tab, via the tabs API — never page content — and only for
> pages on http(s).
>
> Source is attached; see the build instructions below.

## 3. Source code submission — required

The build is bundled and minified by Vite, so reviewers cannot read the shipped
JavaScript. Attach the source archive and these instructions:

- Node **v22.23.1**, npm **10.9.8** (the versions this release was built with —
  update when they change; a different Node can produce a different bundle, and
  a mismatch reads as "the source does not match the upload")
- `npm ci`
- `npm run build`
- Output is `dist/`, which is what the uploaded zip contains

## 4. Permissions — what each is for

| Permission | Why |
|---|---|
| `storage` | Base URL and API token; unsaved drafts for the session |
| `activeTab`, `tabs` | URL and title of the active tab, to save it and to show the ✓ badge |
| `host_permissions: https://linkerlee.com/*` | The default instance |
| `optional_host_permissions: https://*/*` | Declared so a self-hosted instance can be requested at runtime; never granted at install, and only ever requested one concrete origin at a time |

## 5. Data disclosure

`browser_specific_settings.gecko.data_collection_permissions.required` is
`["websiteContent"]`.

The listing and the privacy policy must both say that the URL and title of saved
pages, plus the API token, go to **the Linkerlee instance the user configures**,
which defaults to linkerlee.com — not to linkerlee.com unconditionally. See
`PRIVACY.md`, which is the canonical text; publish it at the URL the listing
points to **before** submitting, since reviewers check it against the manifest.

## 6. Expected lint warnings

`web-ext lint` reports **0 errors and 2 warnings**. Both are expected; a third
is a regression worth investigating before uploading.

- `BACKGROUND_SERVICE_WORKER_IGNORED` — the manifest declares both
  `background.service_worker` (Chrome) and `background.scripts` (Firefox). The
  postbuild step adds the latter; Firefox ignores the former.
- `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` — `strict_min_version` is
  `140.0`, while `data_collection_permissions` needs Firefox for Android 142.
  Deliberate: 140 is a live ESR line, and raising the floor would lock out
  managed fleets that stay on ESR. The trade is Android listing eligibility,
  which this add-on does not currently want.

## 7. Before you submit

- [ ] Version bumped in `manifest.json`, `package.json` and the lockfile together
- [ ] `CHANGELOG.md` entry for the version
- [ ] Updated `PRIVACY.md` published at the listing's privacy policy URL
- [ ] Platform deployed if the release needs an endpoint it does not yet have
- [ ] Smoke-tested in a real browser — the parts no automated check covers
