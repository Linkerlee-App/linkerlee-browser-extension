/**
 * Whether a tab's URL may be sent to Linkerlee at all.
 *
 * The rule is an allowlist, not a list of schemes to skip: everything the
 * extension does with a tab ends in its URL leaving the machine, so anything not
 * recognisably a web page — about:, file://, moz-extension://, view-source:,
 * data:, blob: — must never reach the API. A local file path is not something to
 * hand a server because a scheme was missing from a denylist.
 *
 * Shared so the popup and the badge cannot drift apart on it, which they had:
 * the badge filtered on http(s) while the popup only skipped chrome:// and
 * chrome-extension://, so on Firefox an about: page — or a file:// page in
 * either browser — was sent for tag suggestions and bookmark lookup.
 */
export function isSaveableUrl(url: string | undefined): url is string {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}
