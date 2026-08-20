import { getConfig } from './storage';
import {
  ApiError,
  type CreateLinkPayload,
  type ExistingLink,
  type Tag,
  type UpdateLinkPayload,
  type User,
} from './types';

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = await getConfig();
  if (!cfg.token) {
    throw new ApiError('No API token configured.', 0);
  }

  const url = `${cfg.baseUrl}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${cfg.token}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let fieldErrors: Record<string, string[]> = {};
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
      if (body?.data && typeof body.data === 'object') fieldErrors = body.data;
    } catch {
      // Non-JSON response (e.g. plain text error). Stick with the default message.
    }
    throw new ApiError(message, res.status, fieldErrors);
  }

  return res;
}

export async function fetchUser(): Promise<User> {
  const res = await apiFetch('/api/user');
  return (await res.json()) as User;
}

export async function getAllTags(): Promise<Tag[]> {
  const res = await apiFetch('/api/all-tags');
  return (await res.json()) as Tag[];
}

export async function suggestTags(link: string): Promise<Tag[]> {
  const res = await apiFetch('/api/suggest-tags', {
    method: 'POST',
    body: JSON.stringify({ link }),
  });
  return (await res.json()) as Tag[];
}

export async function createLink(payload: CreateLinkPayload): Promise<void> {
  await apiFetch('/api/links', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function findLink(link: string): Promise<ExistingLink | null> {
  try {
    const res = await apiFetch(`/api/links/find?link=${encodeURIComponent(link)}`);
    return (await res.json()) as ExistingLink;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function updateLink(id: number, payload: UpdateLinkPayload): Promise<void> {
  await apiFetch(`/api/links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteLink(id: number): Promise<void> {
  await apiFetch(`/api/links/${id}`, { method: 'DELETE' });
}
