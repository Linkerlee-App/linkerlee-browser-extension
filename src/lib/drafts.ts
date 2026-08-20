/**
 * Unsaved popup state, kept per URL.
 *
 * The popup is dismissed the moment the user clicks outside it, with no
 * cancellable close event to hook — so a draft is written as it changes and
 * restored the next time the popup opens on the same URL.
 *
 * `chrome.storage.session` rather than `local`: a draft belongs to the current
 * browser session, so it disappears on browser close and there is nothing stale
 * to garbage-collect.
 */
export interface FormState {
  title: string;
  tagIds: number[];
  newTags: string[];
}

export interface PopupDraft {
  /** What the form held when the popup was dismissed. */
  state: FormState;
  /**
   * What the form had been *loaded* with at that moment. Kept so a restore can
   * apply the draft as a delta: the link may have gained tags or a new title
   * elsewhere since, and saving sends the whole tag set — replaying the draft
   * wholesale would delete them.
   */
  base: FormState;
  savedAt: number;
}

const KEY = 'drafts';
const MAX_DRAFTS = 20;

/**
 * The map is read once and then kept here, so a write is a bare `set` with no
 * `await` in front of it. That matters: the popup document is destroyed the
 * instant it loses focus, and a write still waiting on a read never reaches
 * storage — losing exactly the keystroke the user closed the popup after.
 */
let cache: Record<string, PopupDraft> | null = null;

/** Orders the initial read against writes that arrive before it resolves. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

function isFormState(value: unknown): value is FormState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.tagIds) &&
    candidate.tagIds.every((id) => typeof id === 'number') &&
    Array.isArray(candidate.newTags) &&
    candidate.newTags.every((name) => typeof name === 'string')
  );
}

function isPopupDraft(value: unknown): value is PopupDraft {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.savedAt === 'number' &&
    isFormState(candidate.state) &&
    isFormState(candidate.base)
  );
}

/**
 * Nothing validates what is already in storage — an extension update can change
 * the shape mid-session. Records that no longer parse are dropped on read rather
 * than left to throw on every open, which would kill the feature for that URL
 * for the rest of the session.
 */
async function load(): Promise<Record<string, PopupDraft>> {
  if (cache !== null) return cache;

  const stored = await chrome.storage.session.get(KEY);
  const raw: unknown = stored[KEY];
  const valid: Record<string, PopupDraft> = {};
  if (typeof raw === 'object' && raw !== null) {
    for (const [url, draft] of Object.entries(raw as Record<string, unknown>)) {
      if (isPopupDraft(draft)) valid[url] = draft;
    }
  }

  cache = valid;
  return valid;
}

/**
 * Keep the map bounded — a long browsing session would otherwise accumulate a
 * draft for every page the user half-tagged. The draft being written is held out
 * of the prune, so it survives even if its `savedAt` is not the newest (a clock
 * that jumped backwards would otherwise let a write drop the very work it was
 * called to save).
 */
function prune(drafts: Record<string, PopupDraft>, keep: string): void {
  const others = Object.entries(drafts).filter(([url]) => url !== keep);
  if (others.length < MAX_DRAFTS) return;
  others.sort(([, a], [, b]) => b.savedAt - a.savedAt);
  for (const [url] of others.slice(MAX_DRAFTS - 1)) delete drafts[url];
}

function persist(drafts: Record<string, PopupDraft>): Promise<void> {
  return chrome.storage.session.set({ [KEY]: { ...drafts } });
}

export function getDraft(url: string): Promise<PopupDraft | null> {
  return enqueue(async () => {
    const drafts = await load();
    return drafts[url] ?? null;
  });
}

export function saveDraft(url: string, draft: PopupDraft): Promise<void> {
  const drafts = cache;
  if (drafts === null) {
    return enqueue(async () => {
      const loaded = await load();
      loaded[url] = draft;
      prune(loaded, url);
      await persist(loaded);
    });
  }

  drafts[url] = draft;
  prune(drafts, url);
  return persist(drafts);
}

export function clearDraft(url: string): Promise<void> {
  const drafts = cache;
  if (drafts === null) {
    return enqueue(async () => {
      const loaded = await load();
      delete loaded[url];
      await persist(loaded);
    });
  }

  delete drafts[url];
  return persist(drafts);
}

export interface DraftMerge {
  state: FormState;
  /** Tags in the draft that no longer exist, so could not be brought back. */
  dropped: number;
}

/**
 * Fold a draft into the state the popup has just loaded.
 *
 * The draft is applied as a *delta* against the state it was taken from, never
 * as a wholesale replacement. Saving replaces the link's entire tag set, so
 * replaying an absolute draft would delete a tag added on the platform after the
 * draft was made — the popup would be quietly destroying work while telling the
 * user it was restoring theirs.
 */
export function mergeDraft(
  draft: PopupDraft,
  loaded: FormState,
  isKnownTag: (id: number) => boolean,
): DraftMerge {
  const added = draft.state.tagIds.filter((id) => !draft.base.tagIds.includes(id));
  const removed = draft.base.tagIds.filter((id) => !draft.state.tagIds.includes(id));
  const merged = [
    ...loaded.tagIds.filter((id) => !removed.includes(id)),
    ...added.filter((id) => !loaded.tagIds.includes(id)),
  ];

  // A tag deleted on the platform since can be neither rendered as a chip nor
  // saved; the count is reported so the user is told rather than shown a
  // plausible-looking set with one silently missing.
  const tagIds = merged.filter(isKnownTag);
  const editedTitle = draft.state.title !== draft.base.title;

  return {
    state: {
      title: editedTitle ? draft.state.title : loaded.title,
      tagIds,
      // A delta here too: after a save the baseline carries the names that were
      // just created, and replaying those would ask the server to create them a
      // second time.
      newTags: draft.state.newTags.filter((name) => !draft.base.newTags.includes(name)),
    },
    dropped: merged.length - tagIds.length,
  };
}
