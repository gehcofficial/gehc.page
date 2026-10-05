import { describe, expect, it } from 'vitest';
import { hasPortalRole, memberListAccess, sameDivision } from '../../server/lib/event-visibility.mjs';

describe('event-visibility: peran portal', () => {
  it('8 peran portal diakui', () => {
    for (const r of ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI']) {
      expect(hasPortalRole([{ role: r }])).toBe(true);
    }
  });

  it('tanpa peran / peran asing → ditolak', () => {
    expect(hasPortalRole([])).toBe(false);
    expect(hasPortalRole(null)).toBe(false);
    expect(hasPortalRole([{ role: 'JEMAAT' }])).toBe(false);
  });
});

describe('event-visibility: akses daftar non-staf', () => {
  it('divisi cocok → division', () => {
    expect(memberListAccess({ roles: [{ role: 'MENTEE' }], divisionMatch: true })).toBe('division');
  });

  it('divisi tidak cocok TAPI peran valid → open (tetap terlihat)', () => {
    expect(memberListAccess({ roles: [{ role: 'MENTEE' }], divisionMatch: false })).toBe('open');
    expect(memberListAccess({ roles: [{ role: 'ALUMNI' }], divisionMatch: false })).toBe('open');
    expect(memberListAccess({ roles: [{ role: 'MENTOR' }], divisionMatch: false })).toBe('open');
  });

  it('tanpa peran portal → none (kasus "Belum ada event" yang benar)', () => {
    expect(memberListAccess({ roles: [], divisionMatch: true })).toBe('none');
    expect(memberListAccess({ roles: [{ role: 'JEMAAT' }], divisionMatch: false })).toBe('none');
  });
});

describe('event-visibility: samakan divisi', () => {
  it('case-insensitive + trim', () => {
    expect(sameDivision('didaskalia', 'DIDASKALIA')).toBe(true);
    expect(sameDivision('  Koinonia ', 'koinonia')).toBe(true);
  });

  it('kosong / beda → false', () => {
    expect(sameDivision('', 'DIDASKALIA')).toBe(false);
    expect(sameDivision(null, 'DIDASKALIA')).toBe(false);
    expect(sameDivision('DIAKONIA', 'DIDASKALIA')).toBe(false);
  });
});
