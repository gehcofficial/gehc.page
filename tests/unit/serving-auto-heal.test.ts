import { describe, expect, it, vi } from 'vitest';
import { autoHealServingCycleIndexes } from '../../server/lib/serving-auto-heal.mjs';

describe('serving-auto-heal', () => {
  it('memperbarui cycleIndex future non-swap yang tidak selaras expected', async () => {
    const row = {
      id: 'sa-1',
      eventDate: new Date('2026-11-08T00:00:00.000Z'),
      cycleIndex: 2,
      isSwapped: false,
      _expectedCycleIndex: 5,
    };
    const update = vi.fn(async ({ data }) => {
      row.cycleIndex = data.cycleIndex;
      return row;
    });
    const prisma = { servingAssignment: { update } };
    const expectedByIso = new Map([['2026-11-08', 5]]);
    const healed = await autoHealServingCycleIndexes(prisma as never, {
      rows: [row],
      expectedByIso,
      overrides: new Map(),
      todayISO: '2026-10-01',
      actorId: 'test',
    });
    expect(healed).toHaveLength(1);
    expect(healed[0]).toMatchObject({ from: 2, to: 5 });
    expect(row.cycleIndex).toBe(5);
    expect(update).toHaveBeenCalledOnce();
  });

  it('melewati baris swap dan tanggal lampau', async () => {
    const past = {
      id: 'past',
      eventDate: new Date('2025-01-05T00:00:00.000Z'),
      cycleIndex: 1,
      isSwapped: false,
    };
    const swapped = {
      id: 'sw',
      eventDate: new Date('2026-12-07T00:00:00.000Z'),
      cycleIndex: 1,
      isSwapped: true,
    };
    const update = vi.fn();
    const prisma = { servingAssignment: { update } };
    const healed = await autoHealServingCycleIndexes(prisma as never, {
      rows: [past, swapped],
      expectedByIso: new Map([['2025-01-05', 9], ['2026-12-07', 9]]),
      overrides: new Map(),
      todayISO: '2026-10-01',
    });
    expect(healed).toHaveLength(0);
    expect(update).not.toHaveBeenCalled();
  });
});
