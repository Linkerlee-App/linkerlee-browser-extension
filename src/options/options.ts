import { fetchUser } from '../lib/api';
import { getConfig, setConfig } from '../lib/storage';
import { ApiError } from '../lib/types';

const form = document.getElementById('form') as HTMLFormElement;
const baseUrlInput = document.getElementById('baseUrl') as HTMLInputElement;
const tokenInput = document.getElementById('token') as HTMLInputElement;
const testButton = document.getElementById('test') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;

function showStatus(message: string, kind: 'ok' | 'error' = 'ok'): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', kind === 'error');
  statusEl.hidden = false;
}

async function load(): Promise<void> {
  const cfg = await getConfig();
  baseUrlInput.value = cfg.baseUrl;
  tokenInput.value = cfg.token ?? '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await setConfig({
    baseUrl: baseUrlInput.value,
    token: tokenInput.value.trim() || null,
  });
  showStatus('Saved.');
});

testButton.addEventListener('click', async () => {
  await setConfig({
    baseUrl: baseUrlInput.value,
    token: tokenInput.value.trim() || null,
  });

  try {
    const user = await fetchUser();
    showStatus(`Connected as ${user.name} <${user.email}>.`);
  } catch (err) {
    const msg = err instanceof ApiError
      ? `${err.message} (HTTP ${err.status || 'network'})`
      : (err as Error).message;
    showStatus(`Connection failed: ${msg}`, 'error');
  }
});

void load();
