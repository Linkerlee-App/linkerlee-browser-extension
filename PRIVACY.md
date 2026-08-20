# Privacy Policy — Linkerlee Bookmarker

Last updated: 20 August 2026 · Applies to version 0.9.2 and later

This extension is a client for a Linkerlee account. It does not have its own
backend, does not contact any third party, and does not include analytics,
telemetry, or tracking of any kind. The only server it ever talks to is the
Linkerlee instance you configure in its options page — https://linkerlee.com by
default, or your own instance if you self-host.

## Choosing an instance

Out of the box the extension can reach only https://linkerlee.com, and asks for
nothing further. If you enter a different address, your browser asks you to
allow access to that one host, and the extension can reach it only if you agree.
Change the address later and access to the previous host is given up. Declining
leaves your existing setup untouched.

Only https addresses are accepted: over http your API token would cross the
network in plain text. Addresses containing credentials are refused, as is
anything that does not name a single ordinary host.

## What data is sent, and when

All requests carry the API token you generated in Linkerlee, sent as a Bearer
token in the Authorization header. No request is ever made before you have
entered a token, and none is made to a host you have not allowed.

- **When you click "Test connection" in Options:** the extension calls
  `/api/user` to confirm your token works.
- **When you switch to a tab, or a tab finishes loading an http(s) page:** the
  tab's URL is sent to `/api/links/find` so the toolbar icon can show a ✓ badge
  if the page is already bookmarked.
- **When you open the extension popup:** the extension loads your tag list from
  `/api/all-tags`, sends the current tab's URL to `/api/links/find` to see
  whether you have already saved it, and sends the same URL to
  `/api/suggest-tags` to fetch tag suggestions relevant to the page.
- **When you click "Save":** the page URL, the page title, the tags you selected
  and the names of any new tags you typed are sent to `/api/links`, or to
  `/api/links/{id}` if you are updating an existing bookmark.
- **When you remove a bookmark from the popup:** `/api/links/{id}` is called to
  delete it. Removal is reversible from your Linkerlee trash.

The extension never reads the body, DOM, cookies, form fields, passwords, or any
other content of the pages you visit. It only uses the tab's URL and title,
which it gets from the browser's tabs API. Tag suggestions are computed
server-side by Linkerlee based solely on the URL you send it.

URLs on internal schemes (`chrome://`, `about:`, `file://`, `moz-extension://`,
`view-source:`, `data:`, and so on) are ignored — nothing about those tabs is
sent anywhere.

## What is stored locally

The extension stores the following on your own machine, and nowhere else:

- **Your settings**, kept until you change them or uninstall: the Base URL of
  your Linkerlee instance, and your Linkerlee API token.
- **Unsaved drafts**, kept only for the current browser session: if you pick
  tags or edit the title and close the popup without saving, that work is kept
  so it can be offered back the next time you open the popup on the same page. A
  draft holds the page title, the tags chosen and any new tag names, stored
  against the page's URL. At most 20 are kept, the oldest being discarded first.
  A draft is deleted as soon as you save or remove that bookmark, and all of
  them are discarded when you close your browser.

Nothing else is stored, and none of it is transmitted anywhere except in
requests to your configured Linkerlee instance. Uninstalling the extension
removes it.

## What Linkerlee does with the data

Once a request reaches your Linkerlee instance, it is governed by that service's
own privacy policy and terms. This extension is only the transport.

## Data sharing

None. The extension has no third-party SDKs, no advertising, no analytics, and
no error-reporting services. The `tabs` and `activeTab` permissions are used
only to read the current tab's URL and title for the purposes above. Host
permissions are used only to reach the Linkerlee instance you configured.

## Contact

Questions about the extension: open an issue on the project's repository, or
contact the developer at the address listed on the Linkerlee site.
