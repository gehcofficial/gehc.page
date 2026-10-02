import { describe, expect, it } from 'vitest';
import {
  DIVISION_TAB_IDS,
  canSeeDivisionTab,
  divisionForTab,
} from '../../src/lib/portal-nav-config';
import {
  canAccessDivision,
  isBodCommittee,
  isKomisiUser,
  isSuperadminUser,
} from '../../server/lib/division-access.mjs';

const user = (...roles: string[]) => ({ roles: roles.map((role) => ({ role })) });

describe('division-access — gate panel divisi (server)', () => {
  it('isKomisiUser hanya true untuk KOMISI', () => {
    expect(isKomisiUser(user('KOMISI'))).toBe(true);
    expect(isKomisiUser(user('COMMITTEE'))).toBe(false);
    expect(isKomisiUser(user('BPMJ'))).toBe(false);
  });

  it('isBodCommittee false tanpa peran COMMITTEE (tanpa DB)', async () => {
    expect(await isBodCommittee(user('MENTEE'))).toBe(false);
    expect(await isBodCommittee(user('KOMISI'))).toBe(false);
    expect(await isBodCommittee(user('BPMJ'))).toBe(false);
  });

  it('divisi tak dikenal selalu ditolak', async () => {
    expect(await canAccessDivision(user('SUPERADMIN'), 'ASING')).toBe(false);
    expect(await canAccessDivision(user('KOMISI'), '')).toBe(false);
  });

  it('SUPERADMIN & KOMISI lolos tanpa perlu keanggotaan divisi', async () => {
    expect(await canAccessDivision(user('SUPERADMIN'), 'LITURGIA')).toBe(true);
    expect(await canAccessDivision(user('KOMISI'), 'BENZARPR')).toBe(true);
  });

  it('tanpa user (null) → tanpa divisi', async () => {
    expect(await canAccessDivision(null, 'LITURGIA')).toBe(false);
  });

  it('isSuperadminUser mendeteksi role SUPERADMIN', () => {
    expect(isSuperadminUser(user('SUPERADMIN'))).toBe(true);
    expect(isSuperadminUser(user('KOMISI'))).toBe(false);
  });

  it('DIVISION_TAB_IDS memetakan ke 6 divisi (5 Panca + BZP)', () => {
    expect(DIVISION_TAB_IDS).toHaveLength(6);
    expect(DIVISION_TAB_IDS).toContain('div-benzarpr');
    for (const id of DIVISION_TAB_IDS) expect(divisionForTab(id)).not.toBeNull();
  });

  it('canSeeDivisionTab toleran huruf & menolak tab non-divisi', () => {
    const me = { isSuperadmin: false, divisions: ['didaskalia'], headDivisions: [] };
    expect(canSeeDivisionTab(me, 'div-didaskalia')).toBe(true);
    expect(canSeeDivisionTab(me, 'event-info')).toBe(false);
    expect(canSeeDivisionTab(me, 'div-asing')).toBe(false);
  });
});
