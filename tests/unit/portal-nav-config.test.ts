import { describe, it, expect } from 'vitest';
import {
  buildPortalNavItems,
  buildPortalSidebarItems,
  filterDivisionTabs,
} from '../../src/lib/portal-nav-config';
import type { UserRole } from '../../src/types';

const CTX = { isGroupMentor: false, isMentee: false, isBodTimkerja: false };

function ids(role: UserRole, portalId?: 'jemaat' | 'youth' | 'men'): string[] {
  return buildPortalNavItems(role, CTX, false, portalId).map((i) => i.id);
}

describe('portal-nav-config — tanpa portalId (perilaku lama)', () => {
  it('KOMISI melihat modul Pemuda & Jemaat sekaligus', () => {
    const list = ids('KOMISI');
    expect(list).toContain('org-hierarchy');
    expect(list).toContain('integrations');
    expect(list).toContain('div-liturgia');
    expect(list).toContain('groups-monitoring');
    expect(list).toContain('youth-gehc');
  });
});

describe('portal-nav-config — portal Jemaat', () => {
  it('modul admin jemaat tampil', () => {
    const list = ids('KOMISI', 'jemaat');
    expect(list).toContain('org-hierarchy');
    expect(list).toContain('integrations');
    expect(list).toContain('youth-gehc');
    expect(list).toContain('content-weekly');
    expect(list).toContain('pastoral-care');
  });

  it('modul khusus Pemuda disembunyikan', () => {
    const list = ids('KOMISI', 'jemaat');
    for (const id of [
      'groups-monitoring',
      'beyonders-leaders',
      'jethro',
      'jethro-placement',
      'div-liturgia',
      'div-didaskalia',
      'div-koinonia',
      'div-diakonia',
      'div-marturia',
    ]) {
      expect(list, id).not.toContain(id);
    }
  });

  it('kesaksian (mentee) disembunyikan di Jemaat', () => {
    expect(ids('MENTEE', 'jemaat')).not.toContain('kesaksian');
  });
});

describe('portal-nav-config — portal Pemuda', () => {
  it('modul Pemuda tampil, modul admin jemaat disembunyikan', () => {
    const list = ids('KOMISI', 'youth');
    expect(list).toContain('groups-monitoring');
    expect(list).toContain('div-liturgia');
    expect(list).toContain('youth-gehc');
    expect(list).not.toContain('org-hierarchy');
    expect(list).not.toContain('integrations');
  });

  it('kesaksian (mentee) tampil di Pemuda', () => {
    expect(ids('MENTEE', 'youth')).toContain('kesaksian');
    expect(ids('MENTEE', 'youth')).toContain('groups-monitoring');
  });
});

describe('portal-nav-config — sidebar mengikuti portal', () => {
  it('sidebar Jemaat tidak memuat divisi Pemuda', () => {
    const rows = buildPortalSidebarItems('KOMISI', CTX, false, 'jemaat');
    const flat = rows.flatMap((r) => (r.type === 'item' ? [r.item.id] : r.children.map((c) => c.id)));
    expect(flat).not.toContain('div-liturgia');
    expect(flat).toContain('org-hierarchy');
  });
});

describe('portal-nav-config — tier anggota (MEMBER)', () => {
  it('anggota melihat nav dasar, bukan panel pengurus', () => {
    const list = buildPortalNavItems('MEMBER', CTX, false, 'men').map((i) => i.id);
    expect(list).toContain('event-info');
    expect(list).toContain('kegiatan');
    expect(list).toContain('internal-warta');
    expect(list).toContain('dashboard');
    expect(list).toContain('account');
    expect(list).not.toContain('people');
    expect(list).not.toContain('org-hierarchy');
    expect(list).not.toContain('div-liturgia');
  });
});

describe('portal-nav-config — visibilitas modul (F3.6)', () => {
  it('BZP hanya di portal Jemaat & Pemuda', () => {
    expect(buildPortalNavItems('KOMISI', CTX, false, 'youth').map((i) => i.id)).toContain('div-benzarpr');
    expect(buildPortalNavItems('KOMISI', CTX, false, 'jemaat').map((i) => i.id)).toContain('div-benzarpr');
    expect(buildPortalNavItems('KOMISI', CTX, false, 'men').map((i) => i.id)).not.toContain('div-benzarpr');
    expect(buildPortalNavItems('KOMISI', CTX, false, 'women').map((i) => i.id)).not.toContain('div-benzarpr');
  });

  it('Fasilitas & Keuangan hanya untuk pengurus (bukan MEMBER/MENTEE)', () => {
    const men = buildPortalNavItems('MEMBER', CTX, false, 'men').map((i) => i.id);
    expect(men).not.toContain('church-facilities');
    expect(men).not.toContain('church-finance');
    const komisi = buildPortalNavItems('KOMISI', CTX, false, 'men').map((i) => i.id);
    expect(komisi).toContain('church-facilities');
    expect(komisi).toContain('church-finance');
  });

  it('Modul baca (Stewardship/MDS/Keamanan) tetap untuk anggota', () => {
    const list = buildPortalNavItems('MEMBER', CTX, false, 'men').map((i) => i.id);
    expect(list).toContain('church-stewardship');
    expect(list).toContain('church-mds');
    expect(list).toContain('church-security');
    expect(list).toContain('unit-members');
  });

  it('Dasbor BPMJ hanya BPMJ/SUPERADMIN', () => {
    expect(buildPortalNavItems('KOMISI', CTX, false, 'jemaat').map((i) => i.id)).not.toContain('church-dashboard');
    expect(buildPortalNavItems('BPMJ', CTX, false, 'jemaat').map((i) => i.id)).toContain('church-dashboard');
    expect(buildPortalNavItems('SUPERADMIN', CTX, false, 'jemaat').map((i) => i.id)).toContain('church-dashboard');
  });

  it('filterDivisionTabs menyembunyikan divisi di luar izin', () => {
    const defs = [
      { id: 'div-liturgia' },
      { id: 'div-didaskalia' },
      { id: 'event-info' },
    ];
    expect(filterDivisionTabs(defs, ['div-liturgia'], false).map((d) => d.id)).toEqual(['div-liturgia', 'event-info']);
    expect(filterDivisionTabs(defs, [], true).map((d) => d.id)).toEqual(['div-liturgia', 'div-didaskalia', 'event-info']);
  });
});
