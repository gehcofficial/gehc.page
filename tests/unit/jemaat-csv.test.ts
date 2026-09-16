import { describe, it, expect } from 'vitest';
import { toCsv } from '../../src/lib/csv';
import { matchesMainFilter, needsPlacement, type YouthUserLite } from '../../src/lib/jemaat-filter';

describe('toCsv', () => {
  it('menulis header dan meng-escape koma/kutip', () => {
    const csv = toCsv(
      [{ name: 'A, B', note: 'he said "hi"' }, { name: 'C', note: null }],
      [
        { header: 'nama', value: (r) => r.name },
        { header: 'note', value: (r) => r.note },
      ],
    );
    expect(csv.startsWith('nama,note\n')).toBe(true);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain('C,');
  });
});

const base: YouthUserLite = { id: 'u1', bipra: 'PEMUDA', memberStatus: 'ACTIVE', roleAssignments: [] };

describe('status keaktifan (jemaat-filter)', () => {
  it('filter ALUMNI/NONAKTIF mengikuti memberStatus', () => {
    expect(matchesMainFilter({ ...base, memberStatus: 'ALUMNI' }, 'ALUMNI')).toBe(true);
    expect(matchesMainFilter({ ...base, memberStatus: 'ALUMNI' }, 'NONAKTIF')).toBe(false);
    expect(matchesMainFilter({ ...base, memberStatus: 'NONAKTIF' }, 'NONAKTIF')).toBe(true);
  });

  it('alumni/nonaktif dikecualikan dari Individu', () => {
    expect(matchesMainFilter({ ...base, memberStatus: 'ALUMNI' }, 'INDIVIDU')).toBe(false);
    expect(matchesMainFilter(base, 'INDIVIDU')).toBe(true);
  });

  it('needsPlacement: pemuda aktif tanpa grup binaan', () => {
    expect(needsPlacement(base)).toBe(true);
    expect(needsPlacement({ ...base, isIndividuExplicit: true })).toBe(false);
    expect(needsPlacement({ ...base, memberStatus: 'ALUMNI' })).toBe(false);
    expect(needsPlacement({ ...base, memberStatus: 'NONAKTIF' })).toBe(false);
    expect(needsPlacement({
      ...base,
      roleAssignments: [{ id: 'a', role: 'MENTEE', isActive: true, group: { id: 'g', name: 'Agape' } }],
    })).toBe(false);
    expect(needsPlacement({
      ...base,
      roleAssignments: [{ id: 'a', role: 'MENTEE', isActive: true, group: { id: 'g', name: 'Tanpa Group' } }],
    })).toBe(true);
  });
});
