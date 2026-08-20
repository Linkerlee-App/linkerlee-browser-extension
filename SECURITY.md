# Security policy

## Supported versions

The latest release is the supported one. Extension versions are listed in
[CHANGELOG.md](CHANGELOG.md); `main` is where fixes land first.

## Reporting a vulnerability

**Please do not open a public issue.**

Email **linkerlee@neti.ro** with what the issue is, how to reproduce it, the extension
version (visible in `chrome://extensions`), and the browser you saw it in.

You can expect an acknowledgement within **5 working days**. If a fix is needed we will
agree a disclosure timeline with you and credit you in the changelog unless you would
rather stay anonymous.

There is no bug bounty.

## Scope

This extension: the popup, the options page, the background service worker, and how it
stores and transmits the user's API token.

Vulnerabilities in the LinkerLee platform or its API belong to
[the main repository](https://github.com/linkerlee-app/linkerlee) — same address, just say
which component is affected.

## What the extension holds

Worth knowing before you report, and worth checking if you are auditing:

- **An API token**, stored in extension storage. It is a bearer credential granting write
  access to the user's links — including deletion, since LinkerLee issues every token with
  the `create` ability and the delete endpoint accepts it. Anything that could leak this
  token to a page, another extension, or a third party is in scope and serious.
- **A base URL**, which the user may point at a self-hosted instance. Host permissions are
  requested at runtime for non-default hosts.
- **Draft state** for pages being saved, held locally.

The extension sends the current tab's URL to the configured instance to look up an existing
bookmark and to request tag suggestions. See [PRIVACY.md](PRIVACY.md).

## Out of scope

- Scanner output with no demonstrated impact.
- Attacks requiring a compromised browser profile or physical device access.
- The user voluntarily pasting their token somewhere it does not belong.
- Third-party dependency advisories that are already public — tell us if we are behind,
  but those are handled through updates.
