import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { FormState, PopupDraft } from './drafts';

/**
 * drafts.ts keeps the map in module scope, so every test starts from a fresh
 * import. `load` is imported dynamically for the same reason.
 */
async function freshModule(): Promise<typeof import('./drafts')> {
  vi.resetModules();
  return import('./drafts');
}

/** In-memory stand-in for chrome.storage.session, with the reads controllable. */
function stubStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = structuredClone(initial);
  const pendingReads: Array<() => void> = [];
  let holdReads = false;
  let writes = 0;

  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: (key: string) => {
          const result = key in store ? { [key]: structuredClone(store[key]) } : {};
          if (!holdReads) return Promise.resolve(result);
          return new Promise((resolve) => pendingReads.push(() => resolve(result)));
        },
        set: (obj: Record<string, unknown>) => {
          writes += 1;
          for (const [key, value] of Object.entries(obj)) store[key] = structuredClone(value);
          return Promise.resolve();
        },
      },
    },
  });

  return {
    store,
    writeCount: () => writes,
    holdReads: (hold: boolean) => {
      holdReads = hold;
    },
    releaseReads: () => {
      pendingReads.splice(0).forEach((resolve) => resolve());
    },
  };
}

const state = (title: string, tagIds: number[] = [], newTags: string[] = []): FormState => ({
  title,
  tagIds,
  newTags,
});

const draft = (base: FormState, current: FormState, savedAt = 1): PopupDraft => ({
  base,
  state: current,
  savedAt,
});

const anyTag = (): boolean => true;

describe('mergeDraft', () => {
  // The reason this is a delta and not a replay: saving sends the whole tag set,
  // so replaying a stale draft would delete whatever arrived in the meantime.
  test('keeps a tag added on the platform after the draft was taken', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(
      draft(state('T', [1, 2]), state('T', [1, 2, 3])),
      state('T', [1, 2, 4]),
      anyTag,
    );

    expect(merged.state.tagIds).toEqual([1, 2, 4, 3]);
  });

  test('still honours a tag the draft removed', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(
      draft(state('T', [1, 2]), state('T', [1])),
      state('T', [1, 2, 4]),
      anyTag,
    );

    expect(merged.state.tagIds).toEqual([1, 4]);
  });

  test('a draft taken before the link existed does not wipe tags saved elsewhere', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(
      draft(state('T', [9, 8]), state('T', [9, 8], ['foo'])),
      state('Saved elsewhere', [1, 2]),
      anyTag,
    );

    expect(merged.state).toEqual(state('Saved elsewhere', [1, 2], ['foo']));
  });

  test('an untouched title yields to the newer one from the server', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(draft(state('Old'), state('Old')), state('Newer'), anyTag);

    expect(merged.state.title).toBe('Newer');
  });

  test('a title the user edited wins', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(draft(state('Old'), state('My edit')), state('Newer'), anyTag);

    expect(merged.state.title).toBe('My edit');
  });

  test('drops tags that no longer exist and counts them, so the user can be told', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(
      draft(state('T', []), state('T', [7, 8])),
      state('T', [1]),
      (id) => id !== 8,
    );

    expect(merged.state.tagIds).toEqual([1, 7]);
    expect(merged.dropped).toBe(1);
  });

  test('does not replay new tags the last save already created', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(
      draft(state('T', [3], ['rust']), state('T', [3], ['rust', 'wasm'])),
      state('T', [3]),
      anyTag,
    );

    expect(merged.state.newTags).toEqual(['wasm']);
  });

  test('a draft equal to its base changes nothing', async () => {
    const { mergeDraft } = await freshModule();

    const merged = mergeDraft(
      draft(state('T', [1, 2]), state('T', [1, 2])),
      state('T', [1, 2, 5]),
      anyTag,
    );

    expect(merged.state).toEqual(state('T', [1, 2, 5], []));
  });
});

describe('storage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test('round-trips a draft and keeps drafts for other URLs separate', async () => {
    stubStorage();
    const { getDraft, saveDraft } = await freshModule();

    const a = draft(state(''), state('A', [2, 1], ['x']), 100);
    await saveDraft('https://a.test', a);
    await saveDraft('https://b.test', draft(state(''), state('B'), 101));

    expect(await getDraft('https://a.test')).toEqual(a);
    expect((await getDraft('https://b.test'))?.state.title).toBe('B');
    expect(await getDraft('https://never-seen.test')).toBeNull();
  });

  test('clearing removes one draft and leaves the rest', async () => {
    stubStorage();
    const { clearDraft, getDraft, saveDraft } = await freshModule();

    await saveDraft('https://a.test', draft(state(''), state('A'), 1));
    await saveDraft('https://b.test', draft(state(''), state('B'), 2));
    await clearDraft('https://a.test');

    expect(await getDraft('https://a.test')).toBeNull();
    expect((await getDraft('https://b.test'))?.state.title).toBe('B');
    await expect(clearDraft('https://not-there.test')).resolves.toBeUndefined();
  });

  test('writes without waiting on a read, because the popup dies mid-keystroke', async () => {
    const storage = stubStorage();
    const { getDraft, saveDraft } = await freshModule();

    await getDraft('https://hot.test');
    storage.holdReads(true);

    // Not awaited: the popup can be destroyed on the very next tick, and a write
    // still queued behind a read would never reach storage.
    void saveDraft('https://hot.test', draft(state(''), state('last keystroke'), 200));
    await Promise.resolve();

    expect(storage.writeCount()).toBe(1);
    const drafts = storage.store.drafts as Record<string, PopupDraft>;
    expect(drafts['https://hot.test']?.state.title).toBe('last keystroke');

    storage.holdReads(false);
    storage.releaseReads();
  });

  test('a clear is not undone by a save issued just before it', async () => {
    const storage = stubStorage();
    const { clearDraft, getDraft, saveDraft } = await freshModule();

    await getDraft('https://race.test');
    void saveDraft('https://race.test', draft(state(''), state('typed'), 300));
    await clearDraft('https://race.test');

    const drafts = storage.store.drafts as Record<string, PopupDraft>;
    expect(drafts['https://race.test']).toBeUndefined();
  });

  test('drops malformed records instead of failing every read', async () => {
    stubStorage({
      drafts: {
        'https://bad.test': { tagIds: 'not an array' },
        'https://also-bad.test': { state: { title: 'x' }, base: null, savedAt: 1 },
        'https://good.test': draft(state(''), state('fine', [1]), 400),
      },
    });
    const { getDraft } = await freshModule();

    expect(await getDraft('https://bad.test')).toBeNull();
    expect(await getDraft('https://also-bad.test')).toBeNull();
    expect((await getDraft('https://good.test'))?.state.title).toBe('fine');
  });

  test('keeps the map to 20 drafts, discarding the oldest', async () => {
    const storage = stubStorage();
    const { getDraft, saveDraft } = await freshModule();

    await getDraft('https://prime.test');
    for (let i = 0; i < 25; i += 1) {
      await saveDraft(`https://p${i}.test`, draft(state(''), state(`t${i}`), 1000 + i));
    }

    const drafts = storage.store.drafts as Record<string, PopupDraft>;
    expect(Object.keys(drafts)).toHaveLength(20);
    expect(drafts['https://p24.test']?.state.title).toBe('t24');
    expect(drafts['https://p0.test']).toBeUndefined();
  });

  test('never prunes away the draft it was just asked to write', async () => {
    const storage = stubStorage();
    const { getDraft, saveDraft } = await freshModule();

    await getDraft('https://prime.test');
    for (let i = 0; i < 25; i += 1) {
      await saveDraft(`https://p${i}.test`, draft(state(''), state(`t${i}`), 1000 + i));
    }

    // Oldest possible timestamp: a clock that jumped backwards must not make a
    // save silently discard the work it was called to persist.
    await saveDraft('https://ancient.test', draft(state(''), state('ancient'), 1));

    const drafts = storage.store.drafts as Record<string, PopupDraft>;
    expect(drafts['https://ancient.test']?.state.title).toBe('ancient');
  });
});
