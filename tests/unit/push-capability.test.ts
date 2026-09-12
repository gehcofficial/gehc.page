import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushCapability, pushCapabilityMessage } from '../../src/lib/push-capability';

const IPHONE_16_4 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1';
const IPHONE_15 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const IPHONE_16_2 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1';
const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function iosNav(userAgent: string, opts: { serviceWorker?: boolean; standalone?: boolean } = {}) {
  vi.stubGlobal('navigator', {
    userAgent,
    platform: 'iPhone',
    maxTouchPoints: 5,
    ...(opts.serviceWorker ? { serviceWorker: {} } : {}),
    ...(opts.standalone !== undefined ? { standalone: opts.standalone } : {}),
  });
  vi.stubGlobal('window', {
    isSecureContext: true,
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: Boolean(opts.standalone) },
    ...(opts.serviceWorker ? { PushManager: function PushManager() {} } : {}),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pushCapability — iOS', () => {
  it('Safari tab iOS 16.4 tanpa PushManager → ios-need-install (bukan no-sw)', () => {
    iosNav(IPHONE_16_4, { standalone: false });
    vi.stubGlobal('Notification', { permission: 'default' });
    const cap = pushCapability();
    expect(cap.state).toBe('ios-need-install');
    expect(cap.state).not.toBe('no-sw');
  });

  it('iOS 15 → ios-old', () => {
    iosNav(IPHONE_15, { standalone: false });
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(pushCapability().state).toBe('ios-old');
  });

  it('iOS 16.2 → ios-old', () => {
    iosNav(IPHONE_16_2, { standalone: false });
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(pushCapability().state).toBe('ios-old');
  });

  it('iOS 16.4 standalone dengan API → supported', () => {
    iosNav(IPHONE_16_4, { standalone: true, serviceWorker: true });
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(pushCapability().state).toBe('supported');
  });

  it('pesan no-sw di iOS mengarah ke install Home Screen', () => {
    iosNav(IPHONE_16_4, { standalone: true });
    vi.stubGlobal('Notification', { permission: 'default' });
    const msg = pushCapabilityMessage('no-sw');
    expect(msg.title).toMatch(/ikon iPhone/i);
  });
});

describe('pushCapability — desktop', () => {
  it('Chrome desktop dengan API → supported', () => {
    vi.stubGlobal('navigator', { userAgent: CHROME_WIN, platform: 'Win32', maxTouchPoints: 0, serviceWorker: {} });
    vi.stubGlobal('window', { isSecureContext: true, matchMedia: () => ({ matches: false }), PushManager: function PushManager() {} });
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(pushCapability().state).toBe('supported');
  });

  it('desktop tanpa PushManager → no-sw', () => {
    vi.stubGlobal('navigator', { userAgent: CHROME_WIN, platform: 'Win32', maxTouchPoints: 0 });
    vi.stubGlobal('window', { isSecureContext: true, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(pushCapability().state).toBe('no-sw');
  });

  it('izin ditolak → denied', () => {
    vi.stubGlobal('navigator', { userAgent: CHROME_WIN, platform: 'Win32', maxTouchPoints: 0, serviceWorker: {} });
    vi.stubGlobal('window', { isSecureContext: true, matchMedia: () => ({ matches: false }), PushManager: function PushManager() {} });
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(pushCapability().state).toBe('denied');
  });
});
