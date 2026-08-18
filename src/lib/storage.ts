export interface Config {
  baseUrl: string;
  token: string | null;
}

export const DEFAULT_BASE_URL = 'https://linkerlee.com';
const KEY = 'config';

export async function getConfig(): Promise<Config> {
  const stored = await chrome.storage.local.get(KEY);
  const cfg = stored[KEY] as Partial<Config> | undefined;
  return {
    baseUrl: cfg?.baseUrl?.trim() || DEFAULT_BASE_URL,
    token: cfg?.token ?? null,
  };
}

export async function setConfig(cfg: Config): Promise<void> {
  await chrome.storage.local.set({
    [KEY]: {
      baseUrl: cfg.baseUrl.trim().replace(/\/+$/, ''),
      token: cfg.token,
    },
  });
}
