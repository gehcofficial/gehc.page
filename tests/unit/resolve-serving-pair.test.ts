import { describe, expect, it, vi } from 'vitest';
import {
  assignmentLookupDates,
  pairNamesForCaption,
  resolveServingPairForWeek,
} from '../../server/lib/resolve-serving-pair.mjs';

describe('assignmentLookupDates (GESER)', () => {
  it('menambah tanggal efektif untuk Minggu asal 18→17', () => {
    const ov = new Map([
      ['2026-10-18', { condition: 'GESER', newEventDate: '2026-10-17' }],
    ]);
    const dates = assignmentLookupDates('2026-10-18', ov);
    expect(dates).toContain('2026-10-18');
    expect(dates).toContain('2026-10-17');
  });
});

describe('pairNamesForCaption', () => {
  it('mengembalikan nama host', () => {
    const n = pairNamesForCaption({
      hostGroup: { id: 'g1', name: 'Ruach' },
      responsibleGroup: { id: 'g2', name: 'Kairos' },
      source: 'assignment',
      warnings: [],
    });
    expect(n.hostGroup).toBe('Ruach');
    expect(n.source).toBe('assignment');
  });
});

function mkPrisma(handlers: {
  assignments?: Array<Record<string, unknown>>;
  groups?: Array<{ id: string; name: string }>;
  event?: { id: string; name: string; metadata?: unknown } | null;
  overrides?: Array<{ event_date: string; condition: string; new_event_date?: string }>;
  expectedIdx?: number | null;
}) {
  const assignments = handlers.assignments || [];
  const groups = handlers.groups || [];
  return {
    servingAssignment: {
      findFirst: vi.fn(async ({ where }) => {
        const gte = where?.eventDate?.gte?.toISOString?.().slice(0, 10);
        const lte = where?.eventDate?.lte?.toISOString?.().slice(0, 10);
        return assignments.find((a) => {
          const d = String(a.event_date || a.eventDate).slice(0, 10);
          return (!gte || d >= gte) && (!lte || d <= lte);
        }) || null;
      }),
      findMany: vi.fn(async () => assignments),
      count: vi.fn(async () => 0),
    },
    group: {
      findMany: vi.fn(async ({ where }) => {
        const ids = where?.id?.in || [];
        return groups.filter((g) => ids.includes(g.id));
      }),
    },
    eventProgram: {
      findUnique: vi.fn(async () => handlers.event || null),
      findFirst: vi.fn(async () => handlers.event || null),
    },
    $queryRawUnsafe: vi.fn(async () => handlers.overrides || []),
  };
}

vi.mock('../../server/lib/service-overrides.mjs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../server/lib/service-overrides.mjs')>();
  return {
    ...orig,
    listOverrides: vi.fn(async (_prisma, from, to) => {
      const map = new Map();
      const rows = (globalThis as { __testOverrides?: Array<{ event_date: string; condition: string; new_event_date?: string }> }).__testOverrides || [];
      for (const r of rows) {
        const iso = String(r.event_date).slice(0, 10);
        if (iso >= from && iso <= to) {
          map.set(iso, {
            condition: r.condition,
            newEventDate: r.new_event_date ? String(r.new_event_date).slice(0, 10) : null,
          });
        }
      }
      return map;
    }),
  };
});

vi.mock('../../server/lib/serving-week-expectations.mjs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../server/lib/serving-week-expectations.mjs')>();
  return {
    ...orig,
    expectedCycleIndexForServingSunday: vi.fn(async () => (globalThis as { __testExpectedIdx?: number | null }).__testExpectedIdx ?? null),
  };
});

vi.mock('../../server/lib/serving-cycle.mjs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../server/lib/serving-cycle.mjs')>();
  return {
    ...orig,
    resolvePairIdsDb: vi.fn(async (_prisma, cycleIndex, groupRows) => {
      const idx = Number(cycleIndex) % 10;
      const names = [
        ['Echad', 'Ruach'],
        ['Kairos', 'Shalom'],
      ];
      const [r, h] = names[idx] || ['G1', 'G2'];
      const find = (n: string) => groupRows.find((g: { name: string }) => g.name === n)?.id || `grp-${n}`;
      return {
        responsibleGroupId: find(r),
        hostGroupId: find(h),
        responsibleName: r,
        hostName: h,
      };
    }),
  };
});

describe('resolveServingPairForWeek', () => {
  it('GESER: assignment di 17 Okt, grid 18 Okt → Ruach/Kairos', async () => {
    (globalThis as { __testOverrides?: unknown[] }).__testOverrides = [
      { event_date: '2026-10-18', condition: 'GESER', new_event_date: '2026-10-17' },
    ];
    const prisma = mkPrisma({
      assignments: [{
        event_date: '2026-10-17',
        responsibleGroupId: 'grp-6',
        hostGroupId: 'grp-9',
        responsibleGroup: { id: 'grp-6', name: 'Kairos' },
        hostGroup: { id: 'grp-9', name: 'Ruach' },
        cycleIndex: 4,
        event: { id: 'evt-1', name: 'Ibadah' },
      }],
      groups: [{ id: 'grp-6', name: 'Kairos' }, { id: 'grp-9', name: 'Ruach' }],
    });
    const r = await resolveServingPairForWeek(prisma as never, { gridDate: '2026-10-18' });
    expect(r.source).toBe('assignment');
    expect(r.hostGroup?.name).toBe('Ruach');
    expect(r.responsibleGroup?.name).toBe('Kairos');
  });

  it('tanpa assignment: expected index → nama pasangan', async () => {
    (globalThis as { __testOverrides?: unknown[] }).__testOverrides = [];
    (globalThis as { __testExpectedIdx?: number }).__testExpectedIdx = 0;
    const prisma = mkPrisma({
      groups: [{ id: 'grp-Echad', name: 'Echad' }, { id: 'grp-Ruach', name: 'Ruach' }],
    });
    const r = await resolveServingPairForWeek(prisma as never, { gridDate: '2026-10-25' });
    expect(r.source).toBe('expected');
    expect(r.hostGroup?.name).toBe('Ruach');
  });

  it('metadata event fallback', async () => {
    (globalThis as { __testExpectedIdx?: number | null }).__testExpectedIdx = null;
    const prisma = mkPrisma({
      event: {
        id: 'evt-x',
        name: 'Bedah Film',
        metadata: { penatalayanGroups: { responsibleGroupId: 'grp-a', hostGroupId: 'grp-b' } },
      },
      groups: [{ id: 'grp-a', name: 'Agape' }, { id: 'grp-b', name: 'Metanoia' }],
    });
    const r = await resolveServingPairForWeek(prisma as never, { gridDate: '2026-11-08', eventId: 'evt-x' });
    expect(r.source).toBe('metadata');
    expect(r.hostGroup?.name).toBe('Metanoia');
  });

  it('link BOD fallback bila assignment & expected kosong', async () => {
    (globalThis as { __testExpectedIdx?: number | null }).__testExpectedIdx = null;
    const prisma = mkPrisma({
      groups: [{ id: 'grp-h', name: 'Hesed' }, { id: 'grp-r', name: 'Logos' }],
    });
    const r = await resolveServingPairForWeek(prisma as never, {
      gridDate: '2026-11-08',
      linkHostGroupId: 'grp-h',
      linkResponsibleGroupId: 'grp-r',
    });
    expect(r.source).toBe('link');
    expect(r.hostGroup?.name).toBe('Hesed');
  });
});
