import { describe, it, expect } from 'vitest';
import { PORTAL_THEMES, brandingToOverride, resolvePortalTheme, themeForPortal } from '../../src/lib/portal-themes';

describe('portal-themes', () => {
  it('tiap portal punya palet; youth tetap merah/oranye', () => {
    expect(PORTAL_THEMES.youth.brand).toBe('#FF416C');
    expect(PORTAL_THEMES.youth.brandEnd).toBe('#FF4B2B');
    expect(PORTAL_THEMES.jemaat.brand).toBe('#7E22CE');
    for (const id of Object.keys(PORTAL_THEMES)) {
      expect(PORTAL_THEMES[id as keyof typeof PORTAL_THEMES].brand).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('resolve dari host (prod & staging)', () => {
    expect(resolvePortalTheme('men.gehc.page').brand).toBe('#0EA5E9');
    expect(resolvePortalTheme('staging-men.gehc.page').brand).toBe('#0EA5E9');
    expect(resolvePortalTheme('gehc.page').brand).toBe('#7E22CE');
    expect(resolvePortalTheme('youth.gehc.page').brand).toBe('#FF416C');
    expect(resolvePortalTheme('districts.gehc.page').brand).toBe('#10B981');
  });

  it('host tak dikenal → tema Pemuda', () => {
    expect(resolvePortalTheme('localhost').brand).toBe('#FF416C');
    expect(resolvePortalTheme('preview.vercel.app').brand).toBe('#FF416C');
  });

  it('override ?portal= hanya non-produksi', () => {
    expect(resolvePortalTheme('localhost', '?portal=jemaat').brand).toBe('#7E22CE');
    expect(resolvePortalTheme('gehc.page', '?portal=youth').brand).toBe('#7E22CE');
  });

  it('override DB menimpa sebagian saja', () => {
    const t = resolvePortalTheme('men.gehc.page', '', { brand: '#123456' });
    expect(t.brand).toBe('#123456');
    expect(t.brandEnd).toBe('#1D4ED8');
    expect(t.brandInk).toBe('#FFFFFF');
  });

  it('themeForPortal fallback', () => {
    expect(themeForPortal('youth').brand).toBe('#FF416C');
  });

  it('brandingToOverride: hanya field terisi', () => {
    expect(brandingToOverride(null)).toBeNull();
    expect(brandingToOverride({})).toBeNull();
    expect(brandingToOverride({ brand: '#112233', logo: 'https://x/y.png' })).toEqual({ brand: '#112233', logo: 'https://x/y.png' });
    const merged = resolvePortalTheme('men.gehc.page', '', brandingToOverride({ brand: '#112233' }));
    expect(merged.brand).toBe('#112233');
    expect(merged.brandEnd).toBe('#1D4ED8');
  });
});
