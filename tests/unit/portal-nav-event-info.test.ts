import { describe, expect, it } from 'vitest';
import { buildPortalNavItems } from '../../src/lib/portal-nav-config';

const ctx = { isGroupMentor: false, isMentee: false };

describe('buildPortalNavItems — Info Event', () => {
  it('onboarding hanya melihat Info Event + Akun', () => {
    const ids = buildPortalNavItems('MENTEE', ctx, true).map((i) => i.id);
    expect(ids).toEqual(['event-info', 'account']);
  });

  it('member aktif tetap melihat Info Event (QR & WA)', () => {
    for (const role of ['MENTEE', 'MENTOR', 'COMMITTEE', 'KOMISI', 'BPMJ', 'SUPERADMIN'] as const) {
      const ids = buildPortalNavItems(role, ctx, false).map((i) => i.id);
      expect(ids, role).toContain('event-info');
    }
  });

  it('Info Event muncul di awal override MENTEE', () => {
    const ids = buildPortalNavItems('MENTEE', ctx, false).map((i) => i.id);
    expect(ids[0]).toBe('event-info');
  });
});
