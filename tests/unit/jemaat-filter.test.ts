import { describe, expect, it } from 'vitest';
import {
  buildSubFilters,
  hasBeyonderWithGroup,
  matchesMainFilter,
  matchesSubFilter,
  type YouthUserLite,
} from '../../src/lib/jemaat-filter';

const base = (over: Partial<YouthUserLite> = {}): YouthUserLite => ({
  id: 'u1',
  bipra: 'PEMUDA',
  isIndividuExplicit: false,
  isBeyonders: false,
  roles: [],
  roleAssignments: [],
  ...over,
});

describe('hasBeyonderWithGroup', () => {
  it('false bila flag isBeyonders true tapi tanpa assignment', () => {
    expect(hasBeyonderWithGroup(base({ isBeyonders: true }))).toBe(false);
  });

  it('false bila assignment tanpa group', () => {
    expect(
      hasBeyonderWithGroup(
        base({ roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: true, group: null }] }),
      ),
    ).toBe(false);
  });

  it('false bila group bernama Tanpa Group', () => {
    expect(
      hasBeyonderWithGroup(
        base({ roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: true, group: { id: 'g0', name: 'Tanpa Group' } }] }),
      ),
    ).toBe(false);
  });

  it('true bila assignment aktif + group terisi', () => {
    expect(
      hasBeyonderWithGroup(
        base({ roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: true, group: { id: 'grp-ruach', name: 'Ruach' } }] }),
      ),
    ).toBe(true);
  });

  it('false bila assignment nonaktif', () => {
    expect(
      hasBeyonderWithGroup(
        base({ roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: false, group: { id: 'grp-ruach', name: 'Ruach' } }] }),
      ),
    ).toBe(false);
  });

  it('mengabaikan legacy roles tanpa groupId', () => {
    expect(hasBeyonderWithGroup(base({ roles: [{ role: 'MENTEE' }] }))).toBe(false);
  });
});

describe('matchesMainFilter', () => {
  it('BEYONDERS hanya assignment+grup (bukan flag semata)', () => {
    expect(matchesMainFilter(base({ isBeyonders: true }), 'BEYONDERS')).toBe(false);
    expect(
      matchesMainFilter(
        base({ roleAssignments: [{ id: 'a1', role: 'MENTOR', isActive: true, group: { id: 'g', name: 'Agape' } }] }),
        'BEYONDERS',
      ),
    ).toBe(true);
  });

  it('Tanpa Group masuk INDIVIDU', () => {
    const y = base({ roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: true, group: null }] });
    expect(matchesMainFilter(y, 'INDIVIDU')).toBe(true);
    expect(matchesMainFilter(y, 'BEYONDERS')).toBe(false);
  });

  it('isIndividuExplicit dikecualikan dari Beyonders', () => {
    const y = base({
      isIndividuExplicit: true,
      roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: true, group: { id: 'g', name: 'Agape' } }],
    });
    expect(matchesMainFilter(y, 'BEYONDERS')).toBe(false);
  });

  it('non-Pemuda tidak masuk Beyonders/Individu', () => {
    const y = base({ bipra: 'BAPAK' });
    expect(matchesMainFilter(y, 'BEYONDERS')).toBe(false);
    expect(matchesMainFilter(y, 'INDIVIDU')).toBe(false);
  });
});

describe('buildSubFilters + matchesSubFilter (Beyonders)', () => {
  const users: YouthUserLite[] = [
    base({ id: 'u1', roleAssignments: [{ id: 'a1', role: 'MENTEE', isActive: true, group: { id: 'g1', name: 'Agape' } }] }),
    base({ id: 'u2', roleAssignments: [{ id: 'a2', role: 'MENTOR', isActive: true, group: { id: 'g1', name: 'Agape' } }] }),
    base({ id: 'u3', roleAssignments: [{ id: 'a3', role: 'MENTEE', isActive: true, group: { id: 'g2', name: 'Logos' } }] }),
    // user rangkap 2 assignment di grup sama → tidak dobel hitung
    base({
      id: 'u4',
      roleAssignments: [
        { id: 'a4', role: 'MENTEE', isActive: true, group: { id: 'g1', name: 'Agape' } },
        { id: 'a5', role: 'CO_MENTOR', isActive: true, group: { id: 'g1', name: 'Agape' } },
      ],
    }),
  ];

  it('hitung user unik per grup', () => {
    const subs = buildSubFilters(users, 'BEYONDERS', []);
    expect(subs).toEqual([
      { key: 'Agape', label: 'Agape', count: 3 },
      { key: 'Logos', label: 'Logos', count: 1 },
    ]);
  });

  it('matchesSubFilter hanya grup terpilih', () => {
    expect(matchesSubFilter(users[0], 'BEYONDERS', 'Agape', [])).toBe(true);
    expect(matchesSubFilter(users[0], 'BEYONDERS', 'Logos', [])).toBe(false);
    expect(matchesSubFilter(users[0], 'BEYONDERS', null, [])).toBe(true);
  });
});
