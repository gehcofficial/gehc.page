import { describe, expect, it } from 'vitest';
import { planServingBackfill } from '../../server/lib/serving-backfill.mjs';

const groups = [
  { id: 'grp-10', name: 'Echad' }, { id: 'grp-8', name: 'Ruach' },
  { id: 'grp-5', name: 'Kairos' }, { id: 'grp-3', name: 'Shalom' },
  { id: 'grp-2', name: 'Agape' }, { id: 'grp-7', name: 'Metanoia' },
  { id: 'grp-1', name: 'Avodah' }, { id: 'grp-4', name: 'Hesed' },
  { id: 'grp-6', name: 'Logos' }, { id: 'grp-9', name: 'Dunamis' },
];

const prismaStub = ({ events, overrides = [], existing = [] }) => ({
  eventProgram: { findMany: async () => events },
  serviceWeekOverride: { findMany: async () => overrides },
  servingAssignment: { findMany: async () => existing, findFirst: async () => null },
  group: { findMany: async () => groups },
  servingCyclePair: { findMany: async () => [] }, // → fallback SERVING_PAIRS
});

describe('planServingBackfill', () => {
  it('membuat rencana berurutan dari anchor (idx 0 di minggu layanan pertama)', async () => {
    const plan = await planServingBackfill(prismaStub({
      events: [
        { id: 'e1', eventDate: new Date('2026-09-13T00:00:00Z') },
        { id: 'e2', eventDate: new Date('2026-09-20T00:00:00Z') },
        { id: 'e3', eventDate: new Date('2026-09-27T00:00:00Z') },
      ],
    }));
    expect(plan.rows.map((r) => [r.date, r.cycleIndex])).toEqual([
      ['2026-09-13', 0], ['2026-09-20', 1], ['2026-09-27', 2],
    ]);
    expect(plan.rows[0]).toMatchObject({ responsibleName: 'Echad', hostName: 'Ruach', eventId: 'e1' });
  });

  it('melewati minggu yang sudah punya baris (idempoten)', async () => {
    const plan = await planServingBackfill(prismaStub({
      events: [
        { id: 'e1', eventDate: new Date('2026-09-13T00:00:00Z') },
        { id: 'e2', eventDate: new Date('2026-09-20T00:00:00Z') },
      ],
      existing: [{ eventDate: new Date('2026-09-13T00:00:00Z') }],
    }));
    expect(plan.rows.map((r) => r.date)).toEqual(['2026-09-20']);
    // idx tetap 1 karena minggu pertama tetap menempati posisi siklus
    expect(plan.rows[0].cycleIndex).toBe(1);
  });

  it('minggu GABUNGAN/LIBUR/ALIH tidak consume siklus', async () => {
    const plan = await planServingBackfill(prismaStub({
      events: [
        { id: 'e1', eventDate: new Date('2026-09-13T00:00:00Z') },
        { id: 'e2', eventDate: new Date('2026-09-20T00:00:00Z') },
        { id: 'e3', eventDate: new Date('2026-09-27T00:00:00Z') },
      ],
      overrides: [{ eventDate: new Date('2026-09-20T00:00:00Z'), condition: 'LIBUR' }],
    }));
    expect(plan.rows.map((r) => [r.date, r.cycleIndex])).toEqual([
      ['2026-09-13', 0], ['2026-09-27', 1],
    ]);
  });

  it('tanpa event → rencana kosong', async () => {
    const plan = await planServingBackfill(prismaStub({ events: [] }));
    expect(plan.rows).toEqual([]);
    expect(plan.serviceDays).toEqual([]);
  });
});
