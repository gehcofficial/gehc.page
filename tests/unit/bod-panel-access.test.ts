import { describe, expect, it } from 'vitest';
import { canAccessYouthBodPanel, parseBodPanelTab } from '../../src/lib/bod-panel-access';
import { buildPortalNavItems } from '../../src/lib/portal-nav-config';

describe('Panel BOD Youth', () => {
  it('hanya youth + BOD atau SUPERADMIN', () => {
    expect(canAccessYouthBodPanel({ portalId: 'youth', isBodTimkerja: true })).toBe(true);
    expect(canAccessYouthBodPanel({ portalId: 'youth', isSuperAdmin: true })).toBe(true);
    expect(canAccessYouthBodPanel({ portalId: 'youth', isBodTimkerja: false, isSuperAdmin: false })).toBe(false);
    expect(canAccessYouthBodPanel({ portalId: 'teen', isBodTimkerja: true })).toBe(false);
  });

  it('parse tab hash', () => {
    expect(parseBodPanelTab('antrean')).toBe('antrean');
    expect(parseBodPanelTab('')).toBe('penatalayan');
  });

  it('BOD Tim Kerja COMMITTEE melihat panel-bod, bukan tautan terpisah', () => {
    const ids = buildPortalNavItems('COMMITTEE', { isGroupMentor: false, isMentee: false, isBodTimkerja: true }, false, 'youth').map((i) => i.id);
    expect(ids).toContain('panel-bod');
    expect(ids).not.toContain('penatalayan-tautan');
  });
});
