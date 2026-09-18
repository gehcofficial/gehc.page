import { describe, expect, it } from 'vitest';
import {
  BIPRA_CATALOG,
  LEADERSHIP_CATALOG,
  canWriteKindSync,
  channelRank,
  isChannelWriterSync,
  leadershipRefsFor,
  personalChannelScope,
} from '../../server/lib/channel-link-access.mjs';

const user = (...roles: string[]) => ({ roles: roles.map((role) => ({ role })) });

describe('channel-link write RBAC', () => {
  it('Admin, BPMJ, Komisi, and BOD Tim Kerja may write', () => {
    expect(isChannelWriterSync(user('SUPERADMIN'))).toBe(true);
    expect(isChannelWriterSync(user('KOMISI'))).toBe(true);
    expect(isChannelWriterSync(user('BPMJ'))).toBe(true);
    expect(isChannelWriterSync(user('COMMITTEE'), true)).toBe(true);
  });

  it('mentor, co-mentor, mentee, and non-BOD committee cannot write', () => {
    expect(isChannelWriterSync(user('MENTOR'))).toBe(false);
    expect(isChannelWriterSync(user('CO_MENTOR'))).toBe(false);
    expect(isChannelWriterSync(user('MENTEE'))).toBe(false);
    expect(isChannelWriterSync(user('COMMITTEE'), false)).toBe(false);
  });

  it('mentor cannot PUT GROUP; BPMJ and BOD can', () => {
    expect(canWriteKindSync(user('MENTOR'), 'GROUP')).toBe(false);
    expect(canWriteKindSync(user('BPMJ'), 'GROUP')).toBe(true);
    expect(canWriteKindSync(user('COMMITTEE'), 'GROUP', true)).toBe(true);
    expect(canWriteKindSync(user('COMMITTEE'), 'DIVISION', false)).toBe(false);
  });

  it('EVENT and KOLOM stay Komisi/Admin even for BOD', () => {
    expect(canWriteKindSync(user('COMMITTEE'), 'EVENT', true)).toBe(false);
    expect(canWriteKindSync(user('BPMJ'), 'EVENT')).toBe(false);
    expect(canWriteKindSync(user('KOMISI'), 'EVENT')).toBe(true);
    expect(canWriteKindSync(user('COMMITTEE'), 'KOLOM', true)).toBe(false);
    expect(canWriteKindSync(user('KOMISI'), 'KOLOM')).toBe(true);
  });

  it('kepemimpinan & BIPRA hanya Komisi/Admin (termasuk BPMJ tidak boleh)', () => {
    for (const kind of ['LEADERSHIP', 'BIPRA']) {
      expect(canWriteKindSync(user('KOMISI'), kind)).toBe(true);
      expect(canWriteKindSync(user('SUPERADMIN'), kind)).toBe(true);
      expect(canWriteKindSync(user('BPMJ'), kind)).toBe(false);
      expect(canWriteKindSync(user('COMMITTEE'), kind, true)).toBe(false);
    }
  });

  it('katalog kepemimpinan: Komisi, Tim Kerja (BOD), BPMJ', () => {
    expect(LEADERSHIP_CATALOG.map((e) => e.id)).toEqual(['KOMISI', 'TIMKERJA', 'BPMJ']);
  });

  it('katalog BIPRA: lima kategorial', () => {
    expect(BIPRA_CATALOG.map((e) => e.id)).toEqual(['BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK']);
  });
});

describe('kanal personal berjenjang', () => {
  const member = (...roles: string[]) => ({ roles: roles.map((role) => ({ role })) });

  it('peringkat: admin > BPMJ > Komisi > BOD > anggota', () => {
    expect(channelRank(member('KOMISI'), { isSuperadmin: true })).toBe('ADMIN');
    expect(channelRank(member('SUPERADMIN'))).toBe('ADMIN');
    expect(channelRank(member('BPMJ', 'KOMISI'))).toBe('BPMJ');
    expect(channelRank(member('KOMISI', 'COMMITTEE'))).toBe('KOMISI');
    expect(channelRank(member('COMMITTEE'), { isBod: true })).toBe('BOD');
    expect(channelRank(member('COMMITTEE'), { isBod: false })).toBe('MEMBER');
    expect(channelRank(member('MENTOR'))).toBe('MEMBER');
    expect(channelRank(member('MENTEE'))).toBe('MEMBER');
  });

  it('peran AKTIF (chip) yang menentukan untuk akun multi-role', () => {
    const multi = member('SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'MENTEE');
    // Chip MENTOR → hanya klusternya, walau punya SUPERADMIN.
    expect(channelRank(multi, { activeRole: 'MENTOR', isBod: true })).toBe('MEMBER');
    expect(channelRank(multi, { activeRole: 'MENTEE', isSuperadmin: true })).toBe('MEMBER');
    // Chip COMMITTEE → BOD hanya bila benar-benar Tim Kerja.
    expect(channelRank(multi, { activeRole: 'COMMITTEE', isBod: true })).toBe('BOD');
    expect(channelRank(multi, { activeRole: 'COMMITTEE', isBod: false })).toBe('MEMBER');
    // Chip pengurus dan admin.
    expect(channelRank(multi, { activeRole: 'KOMISI' })).toBe('KOMISI');
    expect(channelRank(multi, { activeRole: 'BPMJ' })).toBe('BPMJ');
    expect(channelRank(multi, { activeRole: 'SUPERADMIN' })).toBe('ADMIN');
    // Peran aktif yang tidak dimiliki → fallback ke role tertinggi.
    expect(channelRank(multi, { activeRole: 'ALUMNI' })).toBe('ADMIN');
    expect(channelRank(member('MENTOR', 'MENTEE'), { activeRole: 'MENTEE' })).toBe('MEMBER');
  });

  it('hanya Admin/Superadmin yang melihat semua kanal', () => {
    expect(personalChannelScope({ rank: 'ADMIN' }).seeAll).toBe(true);
    for (const rank of ['BPMJ', 'KOMISI', 'BOD', 'MEMBER']) {
      expect(personalChannelScope({ rank }).seeAll).toBe(false);
    }
  });

  it('kanal kepemimpinan hanya yang melekat pada peran', () => {
    expect(leadershipRefsFor('ADMIN')).toEqual(['KOMISI', 'TIMKERJA', 'BPMJ']);
    expect(leadershipRefsFor('BPMJ')).toEqual(['BPMJ']);
    expect(leadershipRefsFor('KOMISI')).toEqual(['KOMISI']);
    expect(leadershipRefsFor('BOD')).toEqual(['TIMKERJA']);
    expect(leadershipRefsFor('MEMBER')).toEqual([]);
  });

  it('Komisi hanya melihat kanal Komisi + klusternya (bukan semua grup)', () => {
    const r = personalChannelScope({ rank: 'KOMISI', bipra: 'PEMUDA', groupIds: ['grp-7'] });
    expect(r.refs).toEqual([
      { kind: 'LEADERSHIP', refId: 'KOMISI' },
      { kind: 'GROUP', refId: 'grp-7' },
      { kind: 'BIPRA', refId: 'PEMUDA' },
    ]);
    expect(r.refs.some((x) => x.kind === 'GROUP' && x.refId !== 'grp-7')).toBe(false);
  });

  it('BOD Tim Kerja hanya kanal TIMKERJA + divisi tempatnya ditugaskan', () => {
    const r = personalChannelScope({ rank: 'BOD', divisionCodes: ['LITURGIA'], groupIds: ['grp-2'] });
    expect(r.refs).toContainEqual({ kind: 'LEADERSHIP', refId: 'TIMKERJA' });
    expect(r.refs).toContainEqual({ kind: 'DIVISION', refId: 'LITURGIA' });
    expect(r.refs).toContainEqual({ kind: 'GROUP', refId: 'grp-2' });
  });

  it('anggota: hanya grup, divisi, BIPRA, kolom, dan minat miliknya', () => {
    const r = personalChannelScope({
      rank: 'MEMBER',
      bipra: 'PEMUDA',
      kolomId: 'kolom-3',
      groupIds: ['g1', 'g1', 'g2'],
      divisionCodes: ['LITURGIA'],
      recreationalIds: ['rec-futsal'],
    });
    expect(r.seeAll).toBe(false);
    expect(r.refs).toEqual([
      { kind: 'GROUP', refId: 'g1' },
      { kind: 'GROUP', refId: 'g2' },
      { kind: 'DIVISION', refId: 'LITURGIA' },
      { kind: 'BIPRA', refId: 'PEMUDA' },
      { kind: 'KOLOM', refId: 'kolom-3' },
      { kind: 'RECREATIONAL', refId: 'rec-futsal' },
    ]);
  });

  it('anggota tanpa kluster → tidak ada kanal (dan tanpa LEADERSHIP)', () => {
    const r = personalChannelScope({ rank: 'MEMBER', bipra: null, kolomId: null });
    expect(r.seeAll).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.refs.some((x) => x.kind === 'LEADERSHIP')).toBe(false);
  });

  it('kolom hanya untuk kolom terkait, BIPRA hanya untuk BIPRA terkait', () => {
    const a = personalChannelScope({ rank: 'MEMBER', bipra: 'ANAK', kolomId: 'kolom-1' });
    expect(a.refs).toContainEqual({ kind: 'BIPRA', refId: 'ANAK' });
    expect(a.refs).not.toContainEqual({ kind: 'BIPRA', refId: 'PEMUDA' });
    expect(a.refs).toContainEqual({ kind: 'KOLOM', refId: 'kolom-1' });
    expect(a.refs).not.toContainEqual({ kind: 'KOLOM', refId: 'kolom-2' });
  });
});
