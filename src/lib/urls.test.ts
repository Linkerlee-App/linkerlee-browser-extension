import { expect, test } from 'vitest';

import { isSaveableUrl } from './urls';

test('accepts the web pages the extension exists to save', () => {
  expect(isSaveableUrl('https://example.com/article')).toBe(true);
  expect(isSaveableUrl('http://example.com')).toBe(true);
  expect(isSaveableUrl('HTTPS://Example.com')).toBe(true);
});

// The privacy policy promises that nothing about these tabs is sent anywhere.
// The badge already honoured it; the popup did not, so an about: page on Firefox
// — or a file:// page in either browser — was sent for tag suggestions and
// bookmark lookup. A local file path is not something to hand a server.
test('refuses everything that is not a web page', () => {
  for (const url of [
    'about:config',
    'about:blank',
    'file:///Users/someone/tax-return.pdf',
    'moz-extension://abc/page.html',
    'chrome://extensions',
    'chrome-extension://abc/popup.html',
    'view-source:https://example.com',
    'data:text/html,hi',
    'blob:https://example.com/uuid',
    'javascript:alert(1)',
    'ftp://example.com',
  ]) {
    expect(isSaveableUrl(url)).toBe(false);
  }
});

test('refuses a missing URL, which a restricted tab gives us', () => {
  expect(isSaveableUrl(undefined)).toBe(false);
  expect(isSaveableUrl('')).toBe(false);
});

// A denylist would have let these through; the rule is an allowlist for exactly
// this reason.
test('is not fooled by a scheme that merely contains an allowed one', () => {
  expect(isSaveableUrl('view-source:http://example.com')).toBe(false);
  expect(isSaveableUrl('  https://example.com')).toBe(false);
  expect(isSaveableUrl('nothttps://example.com')).toBe(false);
});
