import { describe, expect, it } from 'vitest';
import {
  diffAssignments,
  pairFor,
  pairFromList,
  swapGroupsInPairs,
  validateCyclePairs,
} from '../../server/lib/serving-cycle.mjs';

const groups = [
  { id: 'grp-10', name: 'Echad' },
  { id: 'grp-5', name: 'Kairos' },
  { id: 'grp-8', name: 'Ruach' },
  { id: 'grp-3', name: 'Shalom' },
];

const pairs = [
  { cycleIndex: 0, responsibleGroupId: 'grp-10', hostGroupId: 'grp-8' },
  { cycleIndex: 1, responsibleGroupId: 'grp-5', hostGroupId: 'grp-3' },
];

describe('swapGroupsInPairs', () => {
  it('menukar dua grup di penanggung & tuan rumah', () => {
    const out = swapGroupsInPairs(pairs, 'grp-10', 'grp-5');
    expect(out[0]).toMatchObject({ responsibleGroupId: 'grp-5', hostGroupId: 'grp-8' });
    expect(out[1]).toMatchObject({ responsibleGroupId: 'grp-10', hostGroupId: 'grp-3' });
  });

  it('idempoten: dua kali tukar = semula', () => {
    const twice = swapGroupsInPairs(swapGroupsInPairs(pairs, 'grp-10', 'grp-5'), 'grp-10', 'grp-5');
    expect(twice).toEqual(pairs);
  });

  it('tidak mengubah grup lain', () => {
    const out = swapGroupsInPairs(pairs, 'grp-8', 'grp-3'); // hanya host
    expect(out[0].responsibleGroupId).toBe('grp-10');
    expect(out[0].hostGroupId).toBe('grp-3');
    expect(out[1].hostGroupId).toBe('grp-8');
  });
});

describe('validateCyclePairs', () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({
    cycleIndex: i,
    responsibleGroupId: `resp-${i}`,
    hostGroupId: `host-${i}`,
  }));

  it('valid untuk 10 pasangan unik', () => {
    expect(validateCyclePairs(ten, []).ok).toBe(true);
  });

  it('menolak jumlah bukan 10', () => {
    expect(validateCyclePairs(ten.slice(0, 9), []).ok).toBe(false);
    expect(validateCyclePairs([], []).errors[0]).toContain('10 pasangan');
  });

  it('menolak grup penanggung dobel / tuan rumah dobel', () => {
    const dupResp = ten.map((p, i) => (i === 1 ? { ...p, responsibleGroupId: 'resp-0' } : p));
    expect(validateCyclePairs(dupResp, []).errors.join(' ')).toContain('penanggung dobel');
    const dupHost = ten.map((p, i) => (i === 1 ? { ...p, hostGroupId: 'host-0' } : p));
    expect(validateCyclePairs(dupHost, []).errors.join(' ')).toContain('tuan rumah dobel');
  });

  it('menolak cycleIndex dobel & grup tak dikenal', () => {
    const dupIdx = ten.map((p, i) => (i === 9 ? { ...p, cycleIndex: 0 } : p));
    expect(validateCyclePairs(dupIdx, []).errors.join(' ')).toContain('dobel');
    const unknown = ten.map((p, i) => (i === 0 ? { ...p, responsibleGroupId: 'ghost' } : p));
    expect(validateCyclePairs(unknown, groups).errors.join(' ')).toContain('tidak dikenal');
  });
});

describe('pairFromList', () => {
  it('memakai daftar DB bila ada', () => {
    const p = pairFromList(pairs, 1, groups);
    expect(p.responsibleName).toBe(''); // daftar hanya berisi id
    expect(p.responsibleGroupId).toBe('grp-5');
    expect(p.hostGroupId).toBe('grp-3');
  });

  it('fallback ke konstanta bila daftar kosong', () => {
    const p = pairFromList([], 0, groups);
    expect(p.responsibleName).toBe(pairFor(0)[0]);
    expect(p.responsibleGroupId).toBe('grp-10'); // Echad
  });
});

describe('diffAssignments', () => {
  const rows = [
    { id: 'a', eventDate: '2026-09-13', cycleIndex: 0, isSwapped: false, responsibleGroupId: 'grp-10', hostGroupId: 'grp-8' },
    { id: 'b', eventDate: '2026-09-20', cycleIndex: 1, isSwapped: false, responsibleGroupId: 'grp-5', hostGroupId: 'grp-3' },
    { id: 'c', eventDate: '2026-09-27', cycleIndex: 0, isSwapped: true, responsibleGroupId: 'grp-10', hostGroupId: 'grp-8' },
    { id: 'd', eventDate: '2026-08-30', cycleIndex: 0, isSwapped: false, responsibleGroupId: 'grp-10', hostGroupId: 'grp-8' },
  ];

  it('hanya baris dalam rentang, bukan swap, dan yang berubah', () => {
    const after = swapGroupsInPairs(pairs, 'grp-10', 'grp-5');
    const changes = diffAssignments(rows, after, groups, '2026-09-06');
    const ids = changes.map((c) => c.id);
    expect(ids).toEqual(['a', 'b']); // c = isSwapped dilewati, d = sebelum from
    expect(changes[0].before.responsibleName).toBe('Echad');
    expect(changes[0].after.responsibleName).toBe('Kairos');
    expect(changes[1].after.hostName).toBe('Shalom');
  });

  it('tanpa perubahan → daftar kosong', () => {
    expect(diffAssignments(rows, pairs, groups, '2026-09-06')).toEqual([]);
  });

  it('menerima eventDate bertipe Date', () => {
    const withDate = [{ ...rows[0], eventDate: new Date('2026-09-13T00:00:00Z') }];
    const after = swapGroupsInPairs(pairs, 'grp-10', 'grp-5');
    const changes = diffAssignments(withDate, after, groups, '2026-09-06');
    expect(changes).toHaveLength(1);
    expect(changes[0].eventDate).toBe('2026-09-13');
  });
});
