import { describe, it, expect } from 'vitest';
import {
  ALL_PORTAL_IDS,
  PORTAL_PROFILES,
  isJemaatPortal,
  isPortalId,
  isProductionHost,
  portalIdForHost,
  portalOverrideFromSearch,
  portalScopeOf,
  resolvePortalId,
} from '../../src/lib/portal-profiles';

describe('portal-profiles — host ke portal', () => {
  it('hub gehc.page = portal Jemaat', () => {
    expect(portalIdForHost('gehc.page')).toBe('jemaat');
    expect(portalIdForHost('www.gehc.page')).toBe('jemaat');
  });

  it('subdomain unit dipetakan ke portal masing-masing', () => {
    expect(portalIdForHost('youth.gehc.page')).toBe('youth');
    expect(portalIdForHost('men.gehc.page')).toBe('men');
    expect(portalIdForHost('women.gehc.page')).toBe('women');
    expect(portalIdForHost('teen.gehc.page')).toBe('teen');
    expect(portalIdForHost('kids.gehc.page')).toBe('kids');
    expect(portalIdForHost('districts.gehc.page')).toBe('kolom');
    expect(portalIdForHost('community.gehc.page')).toBe('community');
  });

  it('host tak dikenal (localhost/preview) tetap Pemuda', () => {
    expect(portalIdForHost('localhost')).toBe('youth');
    expect(portalIdForHost('gehcpage.vercel.app')).toBe('youth');
    expect(portalIdForHost('preview-abc.vercel.app')).toBe('youth');
    expect(portalIdForHost('staging-gehcpage.vercel.app')).toBe('youth');
  });

  it('setiap id punya profil', () => {
    for (const id of ALL_PORTAL_IDS) {
      expect(PORTAL_PROFILES[id]?.id).toBe(id);
    }
    expect(isPortalId('jemaat')).toBe(true);
    expect(isPortalId('nope')).toBe(false);
  });
});

describe('portal-profiles — override ?portal= (non-produksi)', () => {
  it('isProductionHost hanya untuk gehc.page & subdomainnya', () => {
    expect(isProductionHost('gehc.page')).toBe(true);
    expect(isProductionHost('youth.gehc.page')).toBe(true);
    expect(isProductionHost('localhost')).toBe(false);
    expect(isProductionHost('staging-gehcpage.vercel.app')).toBe(false);
  });

  it('override aktif hanya di non-produksi', () => {
    expect(portalOverrideFromSearch('?portal=jemaat', 'localhost')).toBe('jemaat');
    expect(portalOverrideFromSearch('?portal=youth', 'staging-gehcpage.vercel.app')).toBe('youth');
    expect(portalOverrideFromSearch('?portal=jemaat', 'gehc.page')).toBeNull();
    expect(portalOverrideFromSearch('?portal=jemaat', 'youth.gehc.page')).toBeNull();
  });

  it('override abaikan id tak dikenal / kosong', () => {
    expect(portalOverrideFromSearch('?portal=bogus', 'localhost')).toBeNull();
    expect(portalOverrideFromSearch('', 'localhost')).toBeNull();
    expect(portalOverrideFromSearch('?x=1', 'localhost')).toBeNull();
  });

  it('resolvePortalId menggabungkan host + override', () => {
    expect(resolvePortalId('gehc.page')).toBe('jemaat');
    expect(resolvePortalId('localhost')).toBe('youth');
    expect(resolvePortalId('localhost', '?portal=jemaat')).toBe('jemaat');
    expect(resolvePortalId('gehc.page', '?portal=jemaat')).toBe('jemaat');
  });
});

describe('portal-profiles — lingkup', () => {
  it('jemaat = JEMAAT, unit = BIPRA, districts = KOLOM', () => {
    expect(portalScopeOf('jemaat')).toEqual({ kind: 'JEMAAT' });
    expect(portalScopeOf('youth')).toEqual({ kind: 'BIPRA', bipra: 'PEMUDA' });
    expect(portalScopeOf('men')).toEqual({ kind: 'BIPRA', bipra: 'BAPAK' });
    expect(portalScopeOf('women')).toEqual({ kind: 'BIPRA', bipra: 'IBU' });
    expect(portalScopeOf('kolom')).toEqual({ kind: 'KOLOM' });
  });

  it('isJemaatPortal', () => {
    expect(isJemaatPortal('jemaat')).toBe(true);
    expect(isJemaatPortal('youth')).toBe(false);
  });
});
