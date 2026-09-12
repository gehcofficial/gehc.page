import { describe, it, expect } from 'vitest';
import { isHubHost, isYouthAppHost, resolveHostUnit, normalizeHost } from '../../src/lib/host-context';
import { resolveHostContext } from '../../server/lib/host-context.mjs';

describe('host-context (frontend)', () => {
  it('normalizeHost membuang port & lowercase', () => {
    expect(normalizeHost('Youth.GEHC.page:3000')).toBe('youth.gehc.page');
    expect(normalizeHost('')).toBe('');
  });

  it('hanya apex/www yang dianggap hub', () => {
    expect(isHubHost('gehc.page')).toBe(true);
    expect(isHubHost('www.gehc.page')).toBe(true);
    expect(isHubHost('youth.gehc.page')).toBe(false);
    expect(isHubHost('gehcpage.vercel.app')).toBe(false);
  });

  it('memetakan subdomain English ke unit', () => {
    expect(resolveHostUnit('youth.gehc.page')).toBe('youth');
    expect(resolveHostUnit('teen.gehc.page')).toBe('teen');
    expect(resolveHostUnit('kids.gehc.page')).toBe('kids');
    expect(resolveHostUnit('men.gehc.page')).toBe('men');
    expect(resolveHostUnit('women.gehc.page')).toBe('women');
    expect(resolveHostUnit('districts.gehc.page')).toBe('districts');
    expect(resolveHostUnit('community.gehc.page')).toBe('community');
  });

  it('host tak dikenal tetap aplikasi Pemuda', () => {
    expect(isYouthAppHost('gehcpage.vercel.app')).toBe(true);
    expect(isYouthAppHost('localhost')).toBe(true);
    expect(isYouthAppHost('preview-abc.vercel.app')).toBe(true);
    expect(isYouthAppHost('youth.gehc.page')).toBe(true);
    expect(isYouthAppHost('gehc.page')).toBe(false);
  });
});

describe('host-context (server)', () => {
  it('hub → netral tanpa tenant/bipra', () => {
    expect(resolveHostContext('gehc.page')).toEqual({
      unit: 'hub',
      tenantId: null,
      bipra: null,
      isHub: true,
    });
  });

  it('unit → tenant + kategorial default', () => {
    expect(resolveHostContext('youth.gehc.page')).toMatchObject({
      unit: 'youth',
      tenantId: 'tenant-youth',
      bipra: 'PEMUDA',
    });
    expect(resolveHostContext('teen.gehc.page')).toMatchObject({
      unit: 'teen',
      tenantId: 'tenant-teen',
      bipra: 'REMAJA',
    });
    expect(resolveHostContext('kids.gehc.page')).toMatchObject({ unit: 'kids', bipra: 'ANAK' });
    expect(resolveHostContext('men.gehc.page')).toMatchObject({ unit: 'men', bipra: 'BAPAK' });
    expect(resolveHostContext('women.gehc.page')).toMatchObject({ unit: 'women', bipra: 'IBU' });
    expect(resolveHostContext('districts.gehc.page')).toMatchObject({
      unit: 'districts',
      tenantId: 'tenant-districts',
      bipra: null,
    });
  });

  it('fallback Pemuda untuk host tak dikenal', () => {
    expect(resolveHostContext('gehcpage.vercel.app')).toMatchObject({
      unit: 'youth',
      tenantId: 'tenant-youth',
      bipra: 'PEMUDA',
      isHub: false,
    });
    expect(resolveHostContext({ headers: { host: 'localhost:8787' } })).toMatchObject({
      tenantId: 'tenant-youth',
    });
  });
});
