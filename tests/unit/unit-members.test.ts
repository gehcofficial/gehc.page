import { describe, it, expect } from 'vitest';
import { canSeeMemberPii, memberSelect, unitMemberWhere } from '../../server/lib/unit-members.mjs';

describe('unit-members', () => {
  it('kategorial: filter BIPRA per unit', () => {
    expect(unitMemberWhere('tenant-men')).toEqual({ bipra: 'BAPAK' });
    expect(unitMemberWhere('tenant-women')).toEqual({ bipra: 'IBU' });
    expect(unitMemberWhere('tenant-youth')).toEqual({ bipra: 'PEMUDA' });
    expect(unitMemberWhere('tenant-teen')).toEqual({ bipra: 'REMAJA' });
    expect(unitMemberWhere('tenant-kids')).toEqual({ bipra: 'ANAK' });
  });

  it('kolom: filter kolomId', () => {
    expect(unitMemberWhere('tenant-districts')).toEqual({ kolomId: { not: null } });
    expect(unitMemberWhere('tenant-districts', { kolomId: 'kol-1' })).toEqual({ kolomId: 'kol-1' });
  });

  it('jemaat/community: semua anggota', () => {
    expect(unitMemberWhere('tenant-jemaat')).toEqual({});
    expect(unitMemberWhere('tenant-community')).toEqual({});
  });

  it('PII hanya untuk pengurus', () => {
    expect(canSeeMemberPii([{ role: 'KOMISI' }])).toBe(true);
    expect(canSeeMemberPii([{ role: 'BPMJ' }])).toBe(true);
    expect(canSeeMemberPii([{ role: 'SUPERADMIN' }])).toBe(true);
    expect(canSeeMemberPii([{ role: 'MEMBER' }])).toBe(false);
    expect(canSeeMemberPii([{ role: 'MENTEE' }])).toBe(false);
    expect(canSeeMemberPii([])).toBe(false);
  });

  it('memberSelect menyertakan kontak hanya bila PII', () => {
    expect(memberSelect(false).phone).toBeUndefined();
    expect(memberSelect(true).phone).toBe(true);
    expect(memberSelect(true).email).toBe(true);
    expect(memberSelect(false).name).toBe(true);
  });
});
