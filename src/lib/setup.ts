import { hasHostAccess, hostLabel } from './permissions';
import type { Config } from './storage';

/**
 * Why the popup cannot save anything yet.
 *
 * The same three refusals apiFetch() makes before it will put a request on the
 * wire, hoisted so the popup can ask them up front. A form whose every call is
 * going to be refused locally should never be on screen: it invites the user to
 * pick tags and type a title, and only answers once they press Save.
 *
 * Kept in the order apiFetch() checks them, so what the popup says matches what
 * the request would have said.
 */
export type SetupProblem = 'no-token' | 'bad-base-url' | 'no-host-access';

/**
 * The pure half — the host grant comes in as an argument, because
 * `chrome.permissions` is not available to a test and the interesting logic is
 * the ordering, not the lookup.
 */
export function setupProblem(cfg: Config, hasAccess: boolean): SetupProblem | null {
  if (!cfg.token) return 'no-token';
  // Before the grant check, which cannot mean anything for a URL that does not
  // resolve to a single origin: hasHostAccess() answers false for both, and
  // "not allowed to reach it" is the wrong thing to tell someone whose address
  // is simply not usable.
  if (hostLabel(cfg.baseUrl) === null) return 'bad-base-url';
  if (!hasAccess) return 'no-host-access';
  return null;
}

/** The chrome-facing wrapper. Null means the extension is ready to save. */
export async function checkSetup(cfg: Config): Promise<SetupProblem | null> {
  // Only worth asking the browser once the cheap checks have passed.
  if (!cfg.token || hostLabel(cfg.baseUrl) === null) return setupProblem(cfg, false);
  return setupProblem(cfg, await hasHostAccess(cfg.baseUrl));
}

/**
 * What to tell the user, in the words of the fix rather than of the failure.
 *
 * `host` is whatever hostLabel() made of the configured base URL, so the
 * unusable-address case has none to name.
 */
export function setupMessage(problem: SetupProblem, host: string | null): string {
  switch (problem) {
    case 'no-token':
      return "This extension isn't configured yet.";
    case 'bad-base-url':
      return 'The saved Linkerlee address is not usable — it must be an https:// address naming a single host.';
    case 'no-host-access':
      // Deliberately the same sentence apiFetch() throws: a grant that was
      // declined or later withdrawn is not something the user can guess at.
      return `The extension isn't allowed to reach ${host ?? 'your Linkerlee'}. Open the options page and save the URL again to grant access.`;
  }
}
