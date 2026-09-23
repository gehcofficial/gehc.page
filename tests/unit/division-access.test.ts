import { describe, expect, it } from 'vitest';
import { canSeeDivisionTab, divisionForTab, DIVISION_TAB_IDS } from '../../src/lib/portal-nav-config';
import { isSuperadminUser, canAccessDivision } from '../../server/lib/division-access.mjs';

describe('canSeeDivisionTab (gating panel divisi)', () => {
  it('SUPERADMIN boleh semua panel divisi', () => {
    const me = { isSuperadmin: true, divisions: [], headDivisions: [] };
    for (const id of DIVISION_TAB_IDS) expect(canSeeDivisionTab(me, id)).toBe(true);
  });

  it('anggota divisi hanya divisinya', () => {
    const me = { isSuperadmin: false, divisions: ['DIDASKALIA'], headDivisions: [] };
    expect(canSeeDivisionTab(me, 'div-didaskalia')).toBe(true);
    expect(canSeeDivisionTab(me, 'div-benzarpr')).toBe(false);
    expect(canSeeDivisionTab(me, 'div-liturgia')).toBe(false);
  });

  it('kepala divisi dapat panel divisinya (per-divisi)', () => {
    const me = { isSuperadmin: false, divisions: [], headDivisions: ['LITURGIA'] };
    expect(canSeeDivisionTab(me, 'div-liturgia')).toBe(true);
    expect(canSeeDivisionTab(me, 'div-marturia')).toBe(false);
  });

  it('tanpa divisi (mis. KOMISI) tidak dapat panel apa pun', () => {
    const me = { isSuperadmin: false, divisions: [], headDivisions: [] };
    for (const id of DIVISION_TAB_IDS) expect(canSeeDivisionTab(me, id)).toBe(false);
  });

  it('toleran huruf besar/kecil & menolak tab non-divisi', () => {
    const me = { isSuperadmin: false, divisions: ['didaskalia'], headDivisions: [] };
    expect(canSeeDivisionTab(me, 'div-didaskalia')).toBe(true);
    expect(canSeeDivisionTab(me, 'dashboard')).toBe(false);
  });

  it('DIVISION_TAB_IDS memetakan ke 6 divisi', () => {
    expect(DIVISION_TAB_IDS).toHaveLength(6);
    expect(divisionForTab('div-benzarpr')).toBe('BENZARPR');
    expect(divisionForTab('nope')).toBeNull();
  });
});

describe('server division-access', () => {
  it('isSuperadminUser mendeteksi role SUPERADMIN', () => {
    expect(isSuperadminUser({ roles: [{ role: 'SUPERADMIN' }] })).toBe(true);
    expect(isSuperadminUser({ roles: [{ role: 'KOMISI' }] })).toBe(false);
    expect(isSuperadminUser(null)).toBe(false);
  });

  it('canAccessDivision: SUPERADMIN lolos, divisi tak dikenal ditolak', async () => {
    const admin = { id: 'u1', roles: [{ role: 'SUPERADMIN' }] };
    expect(await canAccessDivision(admin, 'BENZARPR')).toBe(true);
    expect(await canAccessDivision(admin, 'divisi-ngawur')).toBe(false);
  });

  it('canAccessDivision: user tanpa divisi ditolak (tanpa DB → daftar kosong)', async () => {
    const plain = { id: 'u2', roles: [{ role: 'KOMISI' }] };
    expect(await canAccessDivision(plain, 'LITURGIA')).toBe(false);
  });
});
