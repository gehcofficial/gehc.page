import { describe, expect, it } from 'vitest';
import { geserConsumesRotationSlot } from '../../server/lib/serving-week-expectations.mjs';

describe('GESER + rotasi 10 grup', () => {
  it('minggu GESER dengan baris pindah tetap consume slot rotasi', () => {
    const ov = { condition: 'GESER', newEventDate: '2026-10-17' };
    const moved = { id: 'sva-1', cycleIndex: 4 };
    expect(geserConsumesRotationSlot(ov, moved)).toBe(true);
  });

  it('GESER tanpa baris pindah tidak consume', () => {
    expect(geserConsumesRotationSlot({ condition: 'GESER', newEventDate: '2026-10-17' }, null)).toBe(false);
  });

  it('simulasi Oktober 2026: idx 25 Okt selaras setelah GESER 18→17', () => {
    const baseIdx = 3;
    let seq = 0;
    const weeks = ['2026-10-11', '2026-10-18', '2026-10-25'];
    const hasGeser = { '2026-10-18': { condition: 'GESER', newEventDate: '2026-10-17' } };
    const dbIdx: Record<string, number> = { '2026-10-11': 3, '2026-10-17': 4, '2026-10-25': 5 };
    const expected: Record<string, number> = {};
    for (const iso of weeks) {
      const ov = hasGeser[iso];
      if (ov?.condition === 'GESER' && ov.newEventDate && dbIdx[ov.newEventDate] !== undefined) {
        seq += 1;
        continue;
      }
      const exp = (baseIdx + seq) % 10;
      expected[iso] = exp;
      seq += 1;
    }
    expect(expected['2026-10-25']).toBe(5);
    expect(dbIdx['2026-10-25']).toBe(5);
  });
});
