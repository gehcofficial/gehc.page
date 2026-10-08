import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastPortalPlace, portalLiturgiaHref, rememberPortalPlace } from '../../src/lib/portal-place';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
    },
  });
  return store;
}

describe('portal-place: tujuan tombol Portal Liturgia', () => {
  it('posisi div-liturgia terakhir menang', () => {
    expect(portalLiturgiaHref('#/portal/komisi/div-liturgia', 'youth')).toBe('#/portal/komisi/div-liturgia');
  });

  it('namespace aktif → tab Liturgia', () => {
    expect(portalLiturgiaHref('', 'komisi')).toBe('#/portal/komisi/div-liturgia');
    expect(portalLiturgiaHref(null, 'superadmin')).toBe('#/portal/superadmin/div-liturgia');
  });

  it('fallback posisi lain lalu #/portal', () => {
    expect(portalLiturgiaHref('#/portal/komisi/dashboard', '')).toBe('#/portal/komisi/dashboard');
    expect(portalLiturgiaHref('', '')).toBe('#/portal');
    expect(portalLiturgiaHref(null, null)).toBe('#/portal');
  });
});

describe('portal-place: ingat + baca posisi terakhir', () => {
  it('round-trip dalam TTL', () => {
    stubStorage();
    rememberPortalPlace('#/portal/komisi/div-liturgia');
    expect(lastPortalPlace()).toBe('#/portal/komisi/div-liturgia');
  });

  it('bukan rute portal tidak disimpan', () => {
    stubStorage();
    rememberPortalPlace('#/portal/komisi/div-liturgia');
    rememberPortalPlace('#/ibadah/x/layar');
    expect(lastPortalPlace()).toBe('#/portal/komisi/div-liturgia');
  });

  it('kedaluwarsa >24 jam → fallback', () => {
    const store = stubStorage({
      gehc_last_portal: '#/portal/komisi/div-liturgia',
      gehc_last_portal_at: String(Date.now() - 25 * 3600 * 1000),
    });
    expect(lastPortalPlace()).toBe('#/portal');
    expect(store.get('gehc_last_portal')).toBe('#/portal/komisi/div-liturgia');
  });
});
