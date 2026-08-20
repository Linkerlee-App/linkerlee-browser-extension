import { afterEach, describe, expect, test, vi } from 'vitest';

import { HostAccessError, hostLabel, isDefaultHost, originPattern } from './permissions';

describe('originPattern', () => {
  test('covers every port on the host, because match patterns carry none', () => {
    expect(originPattern('https://links.example.com')).toBe('https://links.example.com/*');
    expect(originPattern('https://links.example.com:8443')).toBe('https://links.example.com/*');
  });

  test('ignores a path, which cannot narrow a host permission anyway', () => {
    expect(originPattern('https://example.com/linkerlee/')).toBe('https://example.com/*');
  });

  test('tolerates the whitespace and trailing slashes a paste brings', () => {
    expect(originPattern('  https://example.com/  ')).toBe('https://example.com/*');
  });

  // The security-relevant half: anything that would send a bearer token in the
  // clear, or that cannot be turned into a single concrete origin, is refused
  // rather than downgraded or widened.
  test('refuses http, so the token never crosses the wire in plaintext', () => {
    expect(originPattern('http://example.com')).toBeNull();
    expect(originPattern('http://localhost:8000')).toBeNull();
  });

  test('refuses non-http schemes', () => {
    expect(originPattern('file:///etc/passwd')).toBeNull();
    expect(originPattern('javascript:alert(1)')).toBeNull();
    expect(originPattern('data:text/html,hi')).toBeNull();
    expect(originPattern('ftp://example.com')).toBeNull();
  });

  // "https://linkerlee.com@evil.example.com" reads as the trusted host to anyone
  // skimming it, which is exactly how a self-hosting instruction gets weaponised.
  test('refuses a URL carrying credentials', () => {
    expect(originPattern('https://user:pass@evil.example.com')).toBeNull();
    expect(originPattern('https://linkerlee.com@evil.example.com')).toBeNull();
    expect(originPattern('https://token@example.com')).toBeNull();
  });

  test('refuses hosts that cannot form a usable match pattern', () => {
    expect(originPattern('https://example.com.')).toBeNull();
    expect(originPattern('https://.example.com')).toBeNull();
    expect(originPattern('https://example..com')).toBeNull();
    expect(originPattern('https://[::1]')).toBeNull();
    expect(originPattern('https://under_score.example.com')).toBeNull();
  });

  test('still accepts the hosts a real self-hoster uses', () => {
    expect(originPattern('https://links.example.com')).toBe('https://links.example.com/*');
    expect(originPattern('https://127.0.0.1')).toBe('https://127.0.0.1/*');
    // IDN is normalised to punycode by the same parser fetch uses, which is
    // also what defeats a homograph: the pattern and the UI both show the xn--
    // form rather than the lookalike. The property is "ASCII punycode", not one
    // hand-written encoding.
    const idn = originPattern('https://x\u00e4mple.com');
    expect(idn).toBe('https://xn--xmple-gra.com/*');
    expect(idn).toMatch(/^https:\/\/xn--[\x00-\x7F]+\/\*$/);
    expect(originPattern('HTTPS://Example.COM')).toBe('https://example.com/*');
  });

  test('refuses anything unparseable or hostless', () => {
    expect(originPattern('')).toBeNull();
    expect(originPattern('   ')).toBeNull();
    expect(originPattern('example.com')).toBeNull();
    expect(originPattern('https://')).toBeNull();
  });

  test('never widens into a wildcard, whatever it is handed', () => {
    for (const input of [
      'https://*.example.com',
      'https://*',
      'https://example.com/*',
      '*://example.com',
    ]) {
      const pattern = originPattern(input);
      if (pattern === null) continue;
      // A literal '*' may only ever be the trailing path segment.
      expect(pattern.slice(0, -1)).not.toContain('*');
      expect(pattern.endsWith('/*')).toBe(true);
    }
  });
});

describe('hostLabel', () => {
  // Guards the display sites. A stored base URL is not guaranteed to parse —
  // Options wrote the raw field for a long time, bypassing type="url" — and an
  // exception in the popup leaves it showing neither the form nor the setup
  // screen, stranding the user with no way to reach Options and fix it.
  test('returns null rather than throwing on anything unusable', () => {
    for (const bad of ['', 'linkerlee', 'notaurl', 'localhost:8000', 'http://x.com', 'https://[::1]']) {
      expect(hostLabel(bad)).toBeNull();
    }
  });

  test('names the host, port and all', () => {
    expect(hostLabel('https://links.example.com')).toBe('links.example.com');
    expect(hostLabel('https://links.example.com:8443/app')).toBe('links.example.com:8443');
  });

  test('shows punycode, so a homograph reads as one', () => {
    expect(hostLabel('https://x\u00e4mple.com')).toBe('xn--xmple-gra.com');
  });
});

describe('isDefaultHost', () => {
  test('recognises the shipped host however it is written', () => {
    expect(isDefaultHost('https://linkerlee.com')).toBe(true);
    expect(isDefaultHost('https://linkerlee.com/')).toBe(true);
    expect(isDefaultHost('https://linkerlee.com/dashboard')).toBe(true);
  });

  test('does not mistake a lookalike host for the default', () => {
    expect(isDefaultHost('https://linkerlee.com.evil.example')).toBe(false);
    expect(isDefaultHost('https://notlinkerlee.com')).toBe(false);
    expect(isDefaultHost('https://sub.linkerlee.com')).toBe(false);
    // http is not the default host either — it is not a usable host at all.
    expect(isDefaultHost('http://linkerlee.com')).toBe(false);
  });
});

describe('requestHostAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('never asks the browser for a host it refused to parse', async () => {
    const request = vi.fn();
    vi.stubGlobal('chrome', { permissions: { request } });
    const { requestHostAccess } = await import('./permissions');

    await expect(requestHostAccess('http://example.com')).rejects.toBeInstanceOf(HostAccessError);
    expect(request).not.toHaveBeenCalled();
  });

  test('asks for exactly the one origin, never the declared wildcard', async () => {
    const request = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('chrome', { permissions: { request } });
    const { requestHostAccess } = await import('./permissions');

    await expect(requestHostAccess('https://links.example.com/app')).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ['https://links.example.com/*'] });
  });

  test('does not prompt for the host that ships as a required permission', async () => {
    const request = vi.fn();
    vi.stubGlobal('chrome', { permissions: { request } });
    const { requestHostAccess } = await import('./permissions');

    await expect(requestHostAccess('https://linkerlee.com')).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('releaseUnusedHosts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('drops the origin left behind when the base URL changes', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('chrome', {
      permissions: {
        getAll: vi.fn().mockResolvedValue({
          origins: ['https://linkerlee.com/*', 'https://old.example.com/*', 'https://new.example.com/*'],
        }),
        remove,
      },
    });
    const { releaseUnusedHosts } = await import('./permissions');

    await releaseUnusedHosts('https://new.example.com');

    // The default stays — it is a required permission and cannot be released —
    // and the host now in use stays. Only the abandoned one goes.
    expect(remove).toHaveBeenCalledWith({ origins: ['https://old.example.com/*'] });
  });

  test('does nothing when there is nothing stale to drop', async () => {
    const remove = vi.fn();
    vi.stubGlobal('chrome', {
      permissions: {
        getAll: vi.fn().mockResolvedValue({ origins: ['https://linkerlee.com/*'] }),
        remove,
      },
    });
    const { releaseUnusedHosts } = await import('./permissions');

    await releaseUnusedHosts('https://linkerlee.com');

    expect(remove).not.toHaveBeenCalled();
  });
});
