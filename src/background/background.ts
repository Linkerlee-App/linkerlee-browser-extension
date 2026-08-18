import { findLink } from '../lib/api';
import { getConfig } from '../lib/storage';
import { ApiError } from '../lib/types';

const BADGE_TEXT = '✓';
const BADGE_COLOR = '#fba115';

function isSaveable(url: string | undefined): url is string {
  if (!url) return false;
  return /^https?:\/\//.test(url);
}

async function refreshBadge(tabId: number, url: string | undefined): Promise<void> {
  await chrome.action.setBadgeText({ tabId, text: '' });

  if (!isSaveable(url)) return;

  const cfg = await getConfig();
  if (!cfg.token) return;

  try {
    const link = await findLink(url);
    if (link) {
      await chrome.action.setBadgeText({ tabId, text: BADGE_TEXT });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status >= 500) {
      console.warn('[linkerlee] badge refresh failed', err);
    }
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await refreshBadge(tabId, tab.url);
  } catch {
    // tab might have been closed mid-check
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    await refreshBadge(tabId, tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'refresh-badge' && typeof message.tabId === 'number') {
    void refreshBadge(message.tabId, message.url).then(() => sendResponse(true));
    return true;
  }
  return false;
});
