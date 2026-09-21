import { describe, it, expect } from 'vitest';
import {
  buildPortalNavItems,
  buildPortalSidebarItems,
  findParentForTab,
} from '../../src/lib/portal-nav-config';

const ctx = { isGroupMentor: false, isMentee: false };

describe('buildPortalSidebarItems — P2-1 grouping (bertahap)', () => {
  it('COMMITTEE: menggabungkan anak jadi parent, tapi id anak tetap routable', () => {
    const flat = buildPortalNavItems('COMMITTEE', ctx, false);
    const rows = buildPortalSidebarItems('COMMITTEE', ctx, false);

    const parentIds = rows.filter((r) => r.type === 'parent').map((r) => r.parent.id);
    expect(parentIds).toContain('konten');
    expect(parentIds).toContain('regenerasi');

    const konten = rows.find((r) => r.type === 'parent' && r.parent.id === 'konten');
    expect(konten && konten.type === 'parent' ? konten.children.map((c) => c.id) : []).toEqual(
      expect.arrayContaining(['content-weekly', 'content-activities', 'media-guide', 'announcements']),
    );

    // Anak tidak lagi tampil sebagai baris top-level…
    const topLevelIds = rows
      .filter((r) => r.type === 'item')
      .map((r) => (r.type === 'item' ? r.item.id : ''));
    expect(topLevelIds).not.toContain('content-weekly');
    expect(topLevelIds).not.toContain('beyonders-leaders');

    // …tetapi tetap ada di daftar izin (routable / isTabAllowed).
    expect(flat.map((i) => i.id)).toEqual(expect.arrayContaining(['content-weekly', 'beyonders-leaders']));

    // Jumlah baris lebih sedikit dari jumlah tab.
    expect(rows.length).toBeLessThan(flat.length);
  });

  it('parent dengan <2 anak yang lolos tidak digabung (struktur tetap tunggal)', () => {
    const rows = buildPortalSidebarItems('COMMITTEE', ctx, false);
    expect(rows.some((r) => r.type === 'parent' && r.parent.id === 'struktur-hirarki')).toBe(false);
    expect(rows.some((r) => r.type === 'item' && r.item.id === 'struktur')).toBe(true);
  });

  it('peran di luar rollout belum berubah (KOMISI tetap datar)', () => {
    const flat = buildPortalNavItems('KOMISI', ctx, false);
    const rows = buildPortalSidebarItems('KOMISI', ctx, false);
    expect(rows.every((r) => r.type === 'item')).toBe(true);
    expect(rows.length).toBe(flat.length);
  });

  it('findParentForTab menemukan parent dari tab anak', () => {
    const rows = buildPortalSidebarItems('COMMITTEE', ctx, false);
    expect(findParentForTab(rows, 'content-weekly')?.id).toBe('konten');
    expect(findParentForTab(rows, 'event-info')).toBeNull();
  });
});
