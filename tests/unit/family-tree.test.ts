import { describe, expect, it } from 'vitest';
import { activeMentees, historyMentees, isActiveMentee } from '../../src/lib/family-tree';
import type { GroupBatch } from '../../src/types';

const batch = (mentees: GroupBatch['mentees']): GroupBatch => ({
  id: 'b1',
  group_id: 'grp-10',
  batchLabel: '',
  period: '2026-09',
  mentor: 'Holly Kalele',
  comentor: 'Aditya Wellem',
  theme: '',
  isCurrent: true,
  mentees,
});

describe('family-tree — pohon batch berjalan hanya ACTIVE', () => {
  it('menyembunyikan ALUMNI/PAST/MOVED dari pohon (kasus Nicole)', () => {
    const b = batch([
      { name: 'Chelsea T.', status: 'ACTIVE' },
      { name: 'Nicole', status: 'ACTIVE' },
      { name: 'Veylicia Kaempe', status: 'MOVED' },
      { name: 'Senior X', status: 'ALUMNI' },
      { name: 'Gen Lalu Y', status: 'PAST' },
    ]);
    expect(activeMentees(b).map((m) => m.name)).toEqual(['Chelsea T.', 'Nicole']);
  });

  it('riwayat tetap menyimpan semua status', () => {
    const b = batch([
      { name: 'A', status: 'ACTIVE' },
      { name: 'B', status: 'ALUMNI' },
      { name: 'C', status: 'PAST' },
      { name: 'D', status: 'MOVED' },
    ]);
    expect(historyMentees(b)).toHaveLength(4);
  });

  it('status kosong dianggap ACTIVE (data lama tanpa status)', () => {
    expect(isActiveMentee({})).toBe(true);
    expect(isActiveMentee(null)).toBe(true);
    expect(activeMentees(batch([{ name: 'Lama' }]))).toHaveLength(1);
  });

  it('batch kosong/null aman', () => {
    expect(activeMentees(null)).toEqual([]);
    expect(activeMentees(undefined)).toEqual([]);
    expect(historyMentees(null)).toEqual([]);
  });
});
