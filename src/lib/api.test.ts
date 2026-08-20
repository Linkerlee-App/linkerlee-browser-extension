import { afterEach, expect, test, vi } from 'vitest';

import type { ApiError } from './types';

/**
 * The host permission has to gate the request, not explain it afterwards.
 *
 * Missing access does not stop the browser dispatching anything — it only stops
 * the extension reading the reply. A request issued without the grant still puts
 * the page URL on the wire (in the preflight, since Authorization makes it
 * non-simple), and delivers the token too if the far end answers with permissive
 * CORS headers. So "no grant" must mean "no fetch".
 */
function stubEnvironment(options: { baseUrl: string; granted: boolean }) {
  const fetchSpy = vi.fn().mockResolvedValue(
    new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );

  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async () => ({ config: { baseUrl: options.baseUrl, token: 'secret-token' } }),
      },
    },
    permissions: {
      contains: async () => options.granted,
    },
  });

  return fetchSpy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('does not dispatch a request to a host without access', async () => {
  const fetchSpy = stubEnvironment({ baseUrl: 'https://self.hosted.example', granted: false });
  const { getAllTags } = await import('./api');

  await expect(getAllTags()).rejects.toThrow(/isn't allowed to reach self\.hosted\.example/);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('does dispatch once the host has been granted', async () => {
  const fetchSpy = stubEnvironment({ baseUrl: 'https://self.hosted.example', granted: true });
  const { getAllTags } = await import('./api');

  await expect(getAllTags()).resolves.toEqual([]);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://self.hosted.example/api/all-tags');
});

test('never dispatches to a base URL it cannot parse', async () => {
  const fetchSpy = stubEnvironment({ baseUrl: 'notaurl', granted: true });
  const { getAllTags } = await import('./api');

  await expect(getAllTags()).rejects.toThrow(/must be an https:\/\/ address/);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('reaches the default host without a permission check standing in the way', async () => {
  const fetchSpy = stubEnvironment({ baseUrl: 'https://linkerlee.com', granted: false });
  const { getAllTags } = await import('./api');

  // Granted at install as a required permission, so `contains` returning false
  // must not lock the shipped configuration out of its own API.
  await expect(getAllTags()).resolves.toEqual([]);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test('surfaces a refusal as ApiError with status 0, which the badge logs', async () => {
  stubEnvironment({ baseUrl: 'https://self.hosted.example', granted: false });
  // Both from the same module registry: resetModules() between tests means a
  // statically imported ApiError would be a different class than the one api.ts
  // throws, and instanceof would fail for reasons having nothing to do with the
  // code under test.
  const [{ getAllTags }, { ApiError }] = await Promise.all([import('./api'), import('./types')]);

  const err = await getAllTags().catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(0);
  // Whatever else it says, it must not carry the token.
  expect((err as ApiError).message).not.toContain('secret-token');
});
