import { afterEach, describe, expect, test, vi } from 'vitest';

import { checkSetup, setupMessage, setupProblem } from './setup';
import type { Config } from './storage';

const config = (over: Partial<Config> = {}): Config => ({
  baseUrl: 'https://linkerlee.com',
  token: 'tok',
  ...over,
});

describe('setupProblem', () => {
  test('is null only when there is a token, a usable host and a grant', () => {
    expect(setupProblem(config(), true)).toBeNull();
  });

  test('reports a missing token first, however broken the rest is', () => {
    expect(setupProblem(config({ token: null }), true)).toBe('no-token');
    // An unconfigured extension has the default base URL and no grant recorded;
    // neither is what the user needs to hear about.
    expect(setupProblem(config({ token: null, baseUrl: 'not a url' }), false)).toBe('no-token');
  });

  test('reports an unusable base URL rather than a missing grant', () => {
    // hasHostAccess() answers false for both, so the ordering is what keeps
    // "not allowed to reach it" off an address that names no host at all.
    expect(setupProblem(config({ baseUrl: 'http://links.example.com' }), false)).toBe(
      'bad-base-url',
    );
    expect(setupProblem(config({ baseUrl: 'nonsense' }), false)).toBe('bad-base-url');
  });

  test('reports a withdrawn or declined grant for an otherwise usable host', () => {
    expect(setupProblem(config({ baseUrl: 'https://links.example.com' }), false)).toBe(
      'no-host-access',
    );
  });
});

describe('checkSetup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPermissions(granted: boolean) {
    const contains = vi.fn().mockResolvedValue(granted);
    vi.stubGlobal('chrome', { permissions: { contains } });
    return contains;
  }

  test('passes a fully configured self-hosted instance', async () => {
    stubPermissions(true);
    expect(await checkSetup(config({ baseUrl: 'https://links.example.com' }))).toBeNull();
  });

  test('catches a self-hosted host whose access was withdrawn', async () => {
    stubPermissions(false);
    expect(await checkSetup(config({ baseUrl: 'https://links.example.com' }))).toBe(
      'no-host-access',
    );
  });

  test('needs no grant for the default host, which ships as a required permission', async () => {
    const contains = stubPermissions(false);
    expect(await checkSetup(config())).toBeNull();
    expect(contains).not.toHaveBeenCalled();
  });

  // The cheap checks answer without chrome, which is what lets the popup ask
  // this before it has decided whether to show anything at all.
  test('does not ask the browser when the token or the URL already settles it', async () => {
    const contains = stubPermissions(true);
    expect(await checkSetup(config({ token: null }))).toBe('no-token');
    expect(await checkSetup(config({ baseUrl: 'http://links.example.com' }))).toBe(
      'bad-base-url',
    );
    expect(contains).not.toHaveBeenCalled();
  });
});

describe('setupMessage', () => {
  test('names the host that cannot be reached, and where to fix it', () => {
    const message = setupMessage('no-host-access', 'links.example.com');
    expect(message).toContain('links.example.com');
    expect(message).toContain('options');
  });

  test('still reads as a sentence when there is no host to name', () => {
    expect(setupMessage('no-host-access', null)).toContain('your Linkerlee');
  });

  test('keeps the plain wording for an extension nobody has configured yet', () => {
    expect(setupMessage('no-token', null)).toBe("This extension isn't configured yet.");
  });
});
