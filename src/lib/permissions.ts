import { DEFAULT_BASE_URL } from './storage';

/**
 * Host access for a self-hosted Linkerlee.
 *
 * `optional_host_permissions` in the manifest declares `https://*\/*` as
 * *requestable*, never granted. What is actually asked for is the single origin
 * the user typed, so install-time permissions stay as narrow as they were and a
 * grant covers one host at a time.
 *
 * Why the care: until this existed, CORS blocked calls to any host but the
 * default, which meant a mistyped or hostile base URL failed harmlessly. A
 * granted origin removes that accidental protection, and what would leak is not
 * only the bearer token — suggestTags() sends the current tab's URL, and the
 * badge calls findLink() on every tab switch, so a hostile host would see a
 * running feed of browsing activity.
 */

export class HostAccessError extends Error {
  constructor(
    message: string,
    readonly origin: string | null,
  ) {
    super(message);
    this.name = 'HostAccessError';
  }
}

/**
 * The match pattern covering an origin.
 *
 * Built from the hostname alone: match patterns cannot carry a port, and one
 * without a port matches every port on that host — which is what a self-hoster
 * on :8443 needs. A path in the base URL is ignored here for the same reason,
 * though it will break API calls elsewhere.
 *
 * Returns null when the URL is unusable or not https. http is refused rather
 * than downgraded: the bearer token would cross the wire in plaintext, and the
 * whole point of asking for a permission is that it stops being CORS-limited.
 */
export function originPattern(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;

  // "https://linkerlee.com@evil.example.com" reads as the real host to anyone
  // skimming it and resolves to the attacker's. Refuse credentials outright
  // rather than quietly dropping them: they would otherwise sit in storage and
  // be sent on every request, and a base URL has no business carrying any.
  if (url.username !== '' || url.password !== '') return null;

  // The URL parser is far more permissive than a match pattern. It accepts '*'
  // in a host (so "https://*.example.com" would become a wildcard-subdomain
  // grant — much broader than the single origin this may ask for), and it
  // accepts empty labels, trailing dots and bracketed IPv6, none of which form a
  // usable pattern. Allow only plain DNS labels, which covers punycode (xn--)
  // and IPv4 while excluding all of the above.
  const labels = url.hostname.split('.');
  if (labels.some((label) => !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label))) return null;

  return `https://${url.hostname}/*`;
}

/**
 * The host to show a person, or null when the base URL is not usable.
 *
 * Every display site goes through this rather than calling `new URL()` itself:
 * a stored base URL is not guaranteed to parse (Options wrote the raw field for
 * a long time, bypassing the form's type="url"), and a throw in the popup leaves
 * it showing neither the form nor the setup screen — with the button that opens
 * Options inside the section that never appeared.
 */
export function hostLabel(baseUrl: string): string | null {
  if (originPattern(baseUrl) === null) return null;
  return new URL(baseUrl.trim()).host;
}

/** The default host ships as a required permission, so it is never requested. */
export function isDefaultHost(baseUrl: string): boolean {
  return originPattern(baseUrl) === originPattern(DEFAULT_BASE_URL);
}

export async function hasHostAccess(baseUrl: string): Promise<boolean> {
  const origins = originPattern(baseUrl);
  if (origins === null) return false;
  if (isDefaultHost(baseUrl)) return true;
  return chrome.permissions.contains({ origins: [origins] });
}

/**
 * Ask for access to one origin.
 *
 * MUST be called from a user gesture with no `await` before it, or Firefox
 * rejects the request outright. That is why the caller validates and requests
 * first, and only then persists anything.
 */
export function requestHostAccess(baseUrl: string): Promise<boolean> {
  const origins = originPattern(baseUrl);
  if (origins === null) {
    return Promise.reject(
      new HostAccessError(
        'The base URL must start with https:// — over http your API token would cross the network in plain text.',
        null,
      ),
    );
  }
  if (isDefaultHost(baseUrl)) return Promise.resolve(true);
  return chrome.permissions.request({ origins: [origins] });
}

/**
 * Drop every granted origin except the one now in use, so a user who moves
 * between instances does not leave the extension able to reach each of them.
 *
 * The default host cannot be released — it is a required permission, and
 * `permissions.remove` on one is a no-op — so it is filtered out rather than
 * attempted.
 */
export async function releaseUnusedHosts(keepBaseUrl: string): Promise<void> {
  const keep = originPattern(keepBaseUrl);
  const required = originPattern(DEFAULT_BASE_URL);

  const granted = await chrome.permissions.getAll();
  const stale = (granted.origins ?? []).filter(
    (origin) => origin !== keep && origin !== required,
  );
  if (stale.length === 0) return;

  await chrome.permissions.remove({ origins: stale });
}
