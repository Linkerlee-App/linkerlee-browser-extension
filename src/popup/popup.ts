import { createLink, findLink, getAllTags, suggestTags, updateLink } from '../lib/api';
import { getConfig } from '../lib/storage';
import { ApiError, type ExistingLink, type Tag } from '../lib/types';

const needsSetup = document.getElementById('needs-setup') as HTMLElement;
const openOptionsBtn = document.getElementById('open-options') as HTMLButtonElement;
const form = document.getElementById('form') as HTMLFormElement;
const modeBanner = document.getElementById('mode-banner') as HTMLParagraphElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const selectedTagsEl = document.getElementById('selected-tags') as HTMLElement;
const tagSearchInput = document.getElementById('tag-search') as HTMLInputElement;
const tagSuggestionsList = document.getElementById('tag-suggestions') as HTMLUListElement;
const tagsStatusEl = document.getElementById('tags-status') as HTMLElement;
const noTagsHint = document.getElementById('no-tags-hint') as HTMLElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const formStatusEl = document.getElementById('form-status') as HTMLElement;

const allTags = new Map<number, Tag>();
const selectedIds = new Set<number>();
const newTagNames = new Set<string>();

let existing: ExistingLink | null = null;
let activeTabId: number | null = null;

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function showSetup(): void {
  needsSetup.hidden = false;
  form.hidden = true;
}

function showForm(): void {
  needsSetup.hidden = true;
  form.hidden = false;
}

function renderChips(): void {
  selectedTagsEl.replaceChildren();

  const append = (label: string, onRemove: () => void, isNew: boolean): void => {
    const chip = document.createElement('span');
    chip.className = isNew ? 'chip chip-new' : 'chip';
    chip.textContent = label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${label}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      onRemove();
      renderChips();
    });
    chip.append(remove);
    selectedTagsEl.append(chip);
  };

  for (const id of selectedIds) {
    const tag = allTags.get(id);
    if (!tag) continue;
    append(tag.name, () => selectedIds.delete(id), false);
  }
  for (const name of newTagNames) {
    append(name, () => newTagNames.delete(name), true);
  }
}

function isAlreadySelected(name: string): boolean {
  const norm = normalize(name);
  if (newTagNames.has(norm)) return true;
  for (const id of selectedIds) {
    if (normalize(allTags.get(id)?.name ?? '') === norm) return true;
  }
  return false;
}

function tagExistsByName(name: string): boolean {
  const norm = normalize(name);
  for (const tag of allTags.values()) {
    if (normalize(tag.name) === norm) return true;
  }
  return false;
}

function renderDropdown(): void {
  const query = tagSearchInput.value;
  const normQuery = normalize(query);

  const matches = [...allTags.values()]
    .filter((tag) => !selectedIds.has(tag.id))
    .filter((tag) => (normQuery ? normalize(tag.name).includes(normQuery) : true))
    .slice(0, 8);

  tagSuggestionsList.replaceChildren();

  for (const tag of matches) {
    const li = document.createElement('li');
    li.textContent = tag.name;
    li.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectedIds.add(tag.id);
      tagSearchInput.value = '';
      renderChips();
      renderDropdown();
    });
    tagSuggestionsList.append(li);
  }

  const canCreate =
    normQuery.length > 0 && !tagExistsByName(normQuery) && !isAlreadySelected(normQuery);
  if (canCreate) {
    const li = document.createElement('li');
    li.className = 'create-option';
    li.textContent = `+ Create “${normQuery}”`;
    li.addEventListener('mousedown', (event) => {
      event.preventDefault();
      createNewTag(normQuery);
    });
    tagSuggestionsList.append(li);
  }

  tagSuggestionsList.hidden = tagSuggestionsList.childElementCount === 0;
}

function createNewTag(name: string): void {
  const norm = normalize(name);
  if (norm === '' || isAlreadySelected(norm)) return;
  newTagNames.add(norm);
  tagSearchInput.value = '';
  renderChips();
  renderDropdown();
}

tagSearchInput.addEventListener('focus', renderDropdown);
tagSearchInput.addEventListener('input', renderDropdown);
tagSearchInput.addEventListener('blur', () => {
  setTimeout(() => {
    tagSuggestionsList.hidden = true;
  }, 100);
});
tagSearchInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const value = tagSearchInput.value.trim();
  if (value === '') return;
  if (tagExistsByName(value)) {
    const match = [...allTags.values()].find(
      (tag) => normalize(tag.name) === normalize(value),
    );
    if (match && !selectedIds.has(match.id)) {
      selectedIds.add(match.id);
      tagSearchInput.value = '';
      renderChips();
      renderDropdown();
    }
    return;
  }
  createNewTag(value);
});

function setTagsStatus(text: string, kind: 'muted' | 'error' = 'muted'): void {
  tagsStatusEl.textContent = text;
  tagsStatusEl.className = kind;
}

function setFormStatus(text: string, kind: 'muted' | 'error' | 'ok' = 'muted'): void {
  formStatusEl.textContent = text;
  formStatusEl.className = kind;
}

function applyExistingLink(link: ExistingLink): void {
  existing = link;
  if (link.title) titleInput.value = link.title;
  for (const tag of link.tags) {
    allTags.set(tag.id, tag);
    selectedIds.add(tag.id);
  }
  modeBanner.hidden = false;
  modeBanner.textContent = 'Already bookmarked — saving will update it.';
  saveBtn.textContent = 'Update';
}

async function init(): Promise<void> {
  const cfg = await getConfig();
  if (!cfg.token) {
    showSetup();
    return;
  }
  showForm();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    setFormStatus('No saveable URL in the active tab.', 'error');
    saveBtn.disabled = true;
    return;
  }

  activeTabId = tab.id ?? null;
  urlInput.value = tab.url;
  titleInput.value = tab.title ?? '';
  renderChips();

  setTagsStatus('Loading…');

  const [tagsResult, existingResult, suggestionsResult] = await Promise.allSettled([
    getAllTags(),
    findLink(tab.url),
    suggestTags(tab.url),
  ]);

  if (tagsResult.status === 'fulfilled') {
    for (const tag of tagsResult.value) {
      allTags.set(tag.id, tag);
    }
    if (allTags.size === 0) {
      noTagsHint.hidden = false;
    }
  } else {
    handleApiFailure(tagsResult.reason, 'Failed to load tags');
    return;
  }

  if (existingResult.status === 'fulfilled' && existingResult.value) {
    applyExistingLink(existingResult.value);
  }

  if (suggestionsResult.status === 'fulfilled') {
    if (!existing) {
      for (const tag of suggestionsResult.value) {
        allTags.set(tag.id, tag);
        selectedIds.add(tag.id);
      }
    }
    setTagsStatus(
      existing
        ? `${selectedIds.size} attached`
        : suggestionsResult.value.length > 0
          ? `${suggestionsResult.value.length} suggested`
          : 'No suggestions',
    );
  } else {
    setTagsStatus('Suggestions unavailable', 'error');
  }

  renderChips();
}

function handleApiFailure(err: unknown, prefix: string): void {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
    setFormStatus('Auth failed. Update your token in options.', 'error');
    saveBtn.disabled = true;
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  setFormStatus(`${prefix}: ${message}`, 'error');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveBtn.disabled = true;
  setFormStatus(existing ? 'Updating…' : 'Saving…');

  try {
    if (existing) {
      await updateLink(existing.id, {
        title: titleInput.value.trim() || undefined,
        tags: [...selectedIds],
        newTags: [...newTagNames],
      });
      setFormStatus('Updated.', 'ok');
    } else {
      await createLink({
        link: urlInput.value,
        title: titleInput.value.trim() || undefined,
        tags: [...selectedIds],
        newTags: [...newTagNames],
      });
      setFormStatus('Saved.', 'ok');
    }
    if (activeTabId !== null) {
      chrome.runtime.sendMessage({
        type: 'refresh-badge',
        tabId: activeTabId,
        url: urlInput.value,
      });
    }
    setTimeout(() => window.close(), 800);
  } catch (err) {
    saveBtn.disabled = false;
    if (err instanceof ApiError) {
      const firstFieldError = Object.values(err.fieldErrors)[0]?.[0];
      setFormStatus(firstFieldError ?? err.message, 'error');
      if (err.status === 401 || err.status === 403) {
        saveBtn.disabled = true;
      }
    } else {
      setFormStatus((err as Error).message, 'error');
    }
  }
});

void init();
