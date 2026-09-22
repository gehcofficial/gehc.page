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

  it('SUPERADMIN: semua parent terbentuk (orang/regenerasi/konten/struktur-hirarki/sistem)', () => {
    const rows = buildPortalSidebarItems('SUPERADMIN', ctx, false);
    const parentIds = rows.filter((r) => r.type === 'parent').map((r) => r.parent.id);
    expect(parentIds).toEqual(
      expect.arrayContaining(['orang', 'regenerasi', 'konten', 'struktur-hirarki', 'sistem']),
    );
    // Struktur & Hirarki kini punya 2 anak (struktur + org-hierarchy) untuk SUPERADMIN.
    const sh = rows.find((r) => r.type === 'parent' && r.parent.id === 'struktur-hirarki');
    expect(sh && sh.type === 'parent' ? sh.children.length : 0).toBe(2);
  });

  it('KOMISI: parent Orang/Regenerasi/Konten/Sistem terbentuk', () => {
    const rows = buildPortalSidebarItems('KOMISI', ctx, false);
    const parentIds = rows.filter((r) => r.type === 'parent').map((r) => r.parent.id);
    expect(parentIds).toEqual(expect.arrayContaining(['orang', 'regenerasi', 'konten', 'sistem']));

    const orang = rows.find((r) => r.type === 'parent' && r.parent.id === 'orang');
    expect(orang && orang.type === 'parent' ? orang.children.map((c) => c.id) : []).toEqual(
      expect.arrayContaining(['people', 'youth-gehc', 'onboarding', 'catalog']),
    );

    // sistem punya 2 anak KOMISI (integrations + church-info).
    const sistem = rows.find((r) => r.type === 'parent' && r.parent.id === 'sistem');
    expect(sistem && sistem.type === 'parent' ? sistem.children.length : 0).toBe(2);
  });

  it('BPMJ: hanya Regenerasi yang bergabung (sistem tinggal church-info)', () => {
    const rows = buildPortalSidebarItems('BPMJ', ctx, false);
    const parentIds = rows.filter((r) => r.type === 'parent').map((r) => r.parent.id);
    expect(parentIds).toContain('regenerasi');
    expect(parentIds).not.toContain('sistem');
    expect(rows.some((r) => r.type === 'item' && r.item.id === 'church-info')).toBe(true);
  });

  it('findParentForTab menemukan parent dari tab anak', () => {
    const rows = buildPortalSidebarItems('COMMITTEE', ctx, false);
    expect(findParentForTab(rows, 'content-weekly')?.id).toBe('konten');
    expect(findParentForTab(rows, 'event-info')).toBeNull();
  });
});
