import { describe, it, expect } from 'vitest';
import {
  buildPortalNavItems,
  buildPortalSidebarItems,
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
