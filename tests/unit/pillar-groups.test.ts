import { describe, expect, it } from 'vitest';
import { bucketSubOf, canonicalSubsFor, dedupeRoleLine, groupPillarMembers, isHeadOfDivision } from '../../src/lib/pillar-groups';
import type { PublicOrgMember } from '../../src/hooks/usePublicOrgTree';

const m = (over: Partial<PublicOrgMember> & { name: string }): PublicOrgMember => ({
  id: over.name,
  name: over.name,
  order: 0,
  ...over,
});

describe('isHeadOfDivision', () => {
  it('mendeteksi varian kapital', () => {
    expect(isHeadOfDivision('Kepala Divisi')).toBe(true);
    expect(isHeadOfDivision('KEPALA DIVISI')).toBe(true);
    expect(isHeadOfDivision('PIC Musik & Vokal')).toBe(false);
    expect(isHeadOfDivision(null)).toBe(false);
  });
});

describe('dedupeRoleLine', () => {
  it('tampil sekali bila sub == jabatan', () => {
    expect(dedupeRoleLine('Liturgi & Ibadah', 'Liturgi & Ibadah')).toBe('Liturgi & Ibadah');
    expect(dedupeRoleLine('liturgi & ibadah', 'Liturgi & Ibadah ')).toBe('liturgi & ibadah');
  });

  it('tampil dua bila berbeda', () => {
    expect(dedupeRoleLine('Musik & Vokal', 'PIC Musik & Vokal')).toBe('Musik & Vokal · PIC Musik & Vokal');
    expect(dedupeRoleLine(null, 'Ketua Komisi')).toBe('Ketua Komisi');
    expect(dedupeRoleLine(null, null)).toBe('');
  });
});

describe('groupPillarMembers', () => {
  const canonical = ['Liturgi & Ibadah', 'Musik & Vokal', 'Doa & Intercession'];
  const members = [
    m({ name: 'A', position: 'PIC Musik & Vokal', subdivision: 'Musik & Vokal' }),
    m({ name: 'HoD', position: 'Kepala Divisi', subdivision: null }),
    m({ name: 'B', position: 'Koordinator Liturgi & Ibadah', subdivision: 'Liturgi & Ibadah' }),
  ];

  it('kepala divisi dulu, lalu per sub canonical termasuk yang kosong', () => {
    const { head, groups, ungrouped } = groupPillarMembers(members, canonical);
    expect(head.map((x) => x.name)).toEqual(['HoD']);
    expect(groups.map((g) => g.sub)).toEqual(canonical);
    expect(groups[0].people.map((x) => x.name)).toEqual(['B']);
    expect(groups[1].people.map((x) => x.name)).toEqual(['A']);
    expect(groups[2].people).toEqual([]);
    expect(ungrouped).toEqual([]);
  });

  it('tanpa sub masuk Lainnya (tak bernama → ungrouped)', () => {
    const { groups, ungrouped } = groupPillarMembers([m({ name: 'X', subdivision: 'Tim Khusus' })], canonical);
    expect(groups.map((g) => g.sub)).toEqual([...canonical, 'Tim Khusus']);
    expect(ungrouped).toEqual([]);
  });

  it('Didaskalia: varian kurikulum + pembekalan menyatu ke Kurikulum dan Modul', () => {
    expect(canonicalSubsFor('DIDASKALIA', ['Kurikulum'])).toEqual(['Kurikulum dan Modul']);
    expect(canonicalSubsFor('LITURGIA', ['A'])).toEqual(['A']);
    expect(bucketSubOf('DIDASKALIA', 'Kurikulum Pemuridan')).toBe('Kurikulum dan Modul');
    expect(bucketSubOf('DIDASKALIA', 'Pembekalan Tim')).toBe('Kurikulum dan Modul');
    expect(bucketSubOf('DIDASKALIA', null)).toBeNull();
    const { groups } = groupPillarMembers(
      [
        m({ name: 'P', subdivision: 'Kurikulum Pemuridan' }),
        m({ name: 'Q', subdivision: 'Pembekalan Tim' }),
      ],
      ['Kurikulum'],
      'DIDASKALIA',
    );
    expect(groups.map((g) => g.sub)).toEqual(['Kurikulum dan Modul']);
    expect(groups[0].people.map((x) => x.name).sort()).toEqual(['P', 'Q']);
  });
});
