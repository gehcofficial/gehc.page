import { describe, expect, it } from 'vitest';
import { canShowPortalRegister } from '../../src/lib/event-register';
import { canViewMaterialDoc, materialVisibility } from '../../src/lib/material-visibility.mjs';

describe('event-register: tombol daftar di portal', () => {
  it('tampil bila belum terdaftar & event aktif', () => {
    expect(canShowPortalRegister({ registered: false, status: 'ACTIVE', isBaku: false })).toBe(true);
    expect(canShowPortalRegister({ registered: false, status: 'PLANNING', isBaku: false })).toBe(true);
  });

  it('sembunyi bila sudah terdaftar / baku / selesai / arsip', () => {
    expect(canShowPortalRegister({ registered: true, status: 'ACTIVE', isBaku: false })).toBe(false);
    expect(canShowPortalRegister({ registered: false, status: 'ACTIVE', isBaku: true })).toBe(false);
    expect(canShowPortalRegister({ registered: false, status: 'DONE', isBaku: false })).toBe(false);
    expect(canShowPortalRegister({ registered: false, status: 'ARCHIVED', isBaku: false })).toBe(false);
  });
});

describe('canViewMaterialDoc: ringkasan setara RHB', () => {
  it('khutbah & rhb: beyonders + staf lolos', () => {
    for (const doc of ['khutbah', 'rhb']) {
      expect(canViewMaterialDoc(['MENTEE'], doc)).toBe(true);
      expect(canViewMaterialDoc(['MENTOR'], doc)).toBe(true);
      expect(canViewMaterialDoc(['CO_MENTOR'], doc)).toBe(true);
      expect(canViewMaterialDoc(['KOMISI'], doc)).toBe(true);
      expect(canViewMaterialDoc([], doc)).toBe(false);
      expect(canViewMaterialDoc(['ALUMNI'], doc)).toBe(false);
    }
  });

  it('pembekalan: mentor + staf + tim Didaskalia (mentee ditolak)', () => {
    expect(canViewMaterialDoc(['MENTOR'], 'pembekalan')).toBe(true);
    expect(canViewMaterialDoc(['KOMISI'], 'pembekalan')).toBe(true);
    expect(canViewMaterialDoc(['MENTEE'], 'pembekalan')).toBe(false);
    expect(canViewMaterialDoc([], 'pembekalan')).toBe(false);
    expect(canViewMaterialDoc([], 'pembekalan', { didaskaliaTeam: true })).toBe(true);
    expect(materialVisibility('pembekalan', { roles: ['MENTEE'] }).reason).toMatch(/mentor/i);
  });

  it('mengikuti topeng peran aktif (huruf kecil aman)', () => {
    expect(canViewMaterialDoc(['mentee'], 'khutbah')).toBe(true);
    expect(canViewMaterialDoc(['member'], 'khutbah')).toBe(false);
  });
});
