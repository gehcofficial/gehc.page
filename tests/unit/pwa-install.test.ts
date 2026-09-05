import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectPwaInstallKind, isIosDevice, isSafariBrowser } from '../../src/lib/pwa-install';

function mockNav(userAgent: string, platform = 'Win32', maxTouchPoints = 0) {
  vi.stubGlobal('navigator', {
    userAgent,
    platform,
    maxTouchPoints,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectPwaInstallKind', () => {
  it('treats iPhone Safari as ios (Add to Home Screen)', () => {
    mockNav(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'iPhone',
    );
    expect(isIosDevice()).toBe(true);
    expect(detectPwaInstallKind()).toBe('ios');
  });

  it('treats iPhone Chrome as ios because install still requires Safari', () => {
    mockNav(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      'iPhone',
    );
    expect(detectPwaInstallKind()).toBe('ios');
  });

  it('treats iPadOS desktop-UA as ios', () => {
    mockNav(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'MacIntel',
      5,
    );
    expect(isIosDevice()).toBe(true);
    expect(detectPwaInstallKind()).toBe('ios');
  });

  it('treats Mac Safari as macos-safari (Add to Dock)', () => {
    mockNav(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'MacIntel',
      0,
    );
    expect(isSafariBrowser()).toBe(true);
    expect(detectPwaInstallKind()).toBe('macos-safari');
  });

  it('treats Mac Chrome as chromium (Install app)', () => {
    mockNav(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'MacIntel',
    );
    expect(isSafariBrowser()).toBe(false);
    expect(detectPwaInstallKind()).toBe('chromium');
  });
});
