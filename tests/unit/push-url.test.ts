import { describe, expect, it } from 'vitest';
import { normalizePushUrl, PUSH_URL_FALLBACK } from '../../server/lib/push-url.mjs';

describe('push-url: normalisasi URL tujuan notifikasi', () => {
  it('URL telanjang `#/...` menjadi `/#/…` (anti-buka source SW)', () => {
    expect(normalizePushUrl('#/portal')).toBe('/#/portal');
    expect(normalizePushUrl('#/portal/komisi/people')).toBe('/#/portal/komisi/people');
    expect(normalizePushUrl('#portal')).toBe('/#/portal');
  });

  it('URL sudah benar tidak berubah', () => {
    expect(normalizePushUrl('/#/portal')).toBe('/#/portal');
    expect(normalizePushUrl('/#/bulletin')).toBe('/#/bulletin');
    expect(normalizePushUrl('/')).toBe('/');
  });

  it('path tanpa hash dijadikan rute hash', () => {
    expect(normalizePushUrl('/portal')).toBe('/#/portal');
    expect(normalizePushUrl('portal/komisi')).toBe('/#/portal/komisi');
  });

  it('URL absolut dipertahankan, kosong pakai fallback', () => {
    expect(normalizePushUrl('https://youth.gehc.page/#/portal')).toBe('https://youth.gehc.page/#/portal');
    expect(normalizePushUrl('')).toBe(PUSH_URL_FALLBACK);
    expect(normalizePushUrl(null)).toBe(PUSH_URL_FALLBACK);
    expect(normalizePushUrl(undefined)).toBe(PUSH_URL_FALLBACK);
  });

  it('hasil selalu aman untuk clients.openWindow (tak pernah telanjang `#`)', () => {
    const samples = ['#/portal', '#/portal/komisi/people', '/#/portal', '/portal', '', 'https://x/y'];
    for (const s of samples) {
      const out = normalizePushUrl(s);
      expect(out.startsWith('#')).toBe(false);
    }
  });
});
