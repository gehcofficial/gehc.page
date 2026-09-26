import { describe, it, expect } from 'vitest';
import {
  ALL_PORTAL_IDS,
  PORTAL_PROFILES,
  isJemaatPortal,
  isKnownHost,
  isPortalId,
  isProductionHost,
  portalIdForHost,
  portalOverrideFromSearch,
  portalScopeOf,
  resolvePortalId,
  tenantIdForHost,
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

  it('host staging memetakan ke portal yang sama seperti prod', () => {
    expect(portalIdForHost('staging.gehc.page')).toBe('jemaat');
    expect(portalIdForHost('staging-youth.gehc.page')).toBe('youth');
    expect(portalIdForHost('staging-men.gehc.page')).toBe('men');
    expect(portalIdForHost('staging-women.gehc.page')).toBe('women');
    expect(portalIdForHost('staging-districts.gehc.page')).toBe('kolom');
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

  it('override aktif hanya di host tak dikenal', () => {
    expect(portalOverrideFromSearch('?portal=jemaat', 'localhost')).toBe('jemaat');
    expect(portalOverrideFromSearch('?portal=youth', 'staging-gehcpage.vercel.app')).toBe('youth');
    expect(portalOverrideFromSearch('?portal=jemaat', 'gehc.page')).toBeNull();
    expect(portalOverrideFromSearch('?portal=jemaat', 'youth.gehc.page')).toBeNull();
    expect(portalOverrideFromSearch('?portal=youth', 'staging.gehc.page')).toBeNull();
    expect(portalOverrideFromSearch('?portal=jemaat', 'staging-youth.gehc.page')).toBeNull();
  });

  it('isKnownHost membedakan host berstruktur vs tak dikenal', () => {
    expect(isKnownHost('gehc.page')).toBe(true);
    expect(isKnownHost('staging.gehc.page')).toBe(true);
    expect(isKnownHost('staging-youth.gehc.page')).toBe(true);
    expect(isKnownHost('localhost')).toBe(false);
    expect(isKnownHost('staging-gehcpage.vercel.app')).toBe(false);
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
    expect(resolvePortalId('staging.gehc.page')).toBe('jemaat');
    expect(resolvePortalId('staging-youth.gehc.page')).toBe('youth');
    // Host sudah menentukan portal → override diabaikan.
    expect(resolvePortalId('staging.gehc.page', '?portal=youth')).toBe('jemaat');
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

describe('portal-profiles — tenant per host', () => {
  it('hub → tenant-jemaat; unit → tenant unit; tak dikenal → youth', () => {
    expect(tenantIdForHost('gehc.page')).toBe('tenant-jemaat');
    expect(tenantIdForHost('staging.gehc.page')).toBe('tenant-jemaat');
    expect(tenantIdForHost('youth.gehc.page')).toBe('tenant-youth');
    expect(tenantIdForHost('men.gehc.page')).toBe('tenant-men');
    expect(tenantIdForHost('districts.gehc.page')).toBe('tenant-districts');
    expect(tenantIdForHost('staging-women.gehc.page')).toBe('tenant-women');
    expect(tenantIdForHost('localhost')).toBe('tenant-youth');
  });
});
