import { describe, expect, it, vi } from 'vitest';
import { OVERRIDE_CONDITIONS, effectiveDate, originDateFor, upsertOverride } from '../../server/lib/service-overrides.mjs';
import { renameServiceDateSuffix } from '../../server/lib/service-events.mjs';
import { planGeser, applyGeser, shiftInstantKeepTime } from '../../server/lib/service-geser.mjs';

type AnyParams = Parameters<typeof upsertOverride>[1];
const geserParams = (p: Record<string, unknown>) => p as unknown as AnyParams;

describe('GESER overrides', () => {
  it('GESER terdaftar sebagai kondisi valid', () => {
    expect(OVERRIDE_CONDITIONS).toContain('GESER');
  });

  it('effectiveDate mengikuti newEventDate bila GESER valid', () => {
    const ov = new Map([['2026-10-18', { condition: 'GESER', newEventDate: '2026-10-17' }]]);
    expect(effectiveDate('2026-10-18', ov)).toBe('2026-10-17');
  });

  it('effectiveDate kembali ke tanggal asal bila bukan GESER / tanpa target', () => {
    expect(effectiveDate('2026-10-18', new Map())).toBe('2026-10-18');
    const libur = new Map([['2026-10-18', { condition: 'LIBUR' }]]);
    expect(effectiveDate('2026-10-18', libur)).toBe('2026-10-18');
    const broken = new Map([['2026-10-18', { condition: 'GESER', newEventDate: null }]]);
    expect(effectiveDate('2026-10-18', broken)).toBe('2026-10-18');
    const same = new Map([['2026-10-18', { condition: 'GESER', newEventDate: '2026-10-18' }]]);
    expect(effectiveDate('2026-10-18', same)).toBe('2026-10-18');
  });

  it('upsertOverride menolak GESER tanpa / sama dengan tanggal asal', async () => {
    const prisma = { $executeRawUnsafe: vi.fn(async () => []) };
    await expect(upsertOverride(prisma, geserParams({ eventDate: '2026-10-18', condition: 'GESER' }))).rejects.toThrow(/newEventDate/);
    await expect(
      upsertOverride(prisma, geserParams({ eventDate: '2026-10-18', condition: 'GESER', newEventDate: '2026-10-18' })),
    ).rejects.toThrow(/berbeda/);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('upsertOverride GESER valid menulis new_event_date', async () => {
    const prisma = { $executeRawUnsafe: vi.fn(async () => []) };
    const out = await upsertOverride(prisma, geserParams({
      eventDate: '2026-10-18',
      condition: 'GESER',
      note: 'Kegiatan gereja',
      newEventDate: '2026-10-17',
    }));
    expect(out).toEqual({ eventDate: '2026-10-18', condition: 'GESER', newEventDate: '2026-10-17' });
    const calls = prisma.$executeRawUnsafe.mock.calls as unknown[][];
    const [sql, ...params] = calls[0] as [string, ...unknown[]];
    expect(sql).toContain('new_event_date');
    expect(params).toContain('2026-10-17');
  });
});

describe('originDateFor (arah-balik GESER: materi ikut origin week)', () => {
  const ov = new Map([['2026-10-18', { condition: 'GESER', newEventDate: '2026-10-17' }]]);
  it('target geser kembali ke asal; selain itu tetap', () => {
    expect(originDateFor('2026-10-17', ov)).toBe('2026-10-18');
    expect(originDateFor('2026-10-18', ov)).toBe('2026-10-18');
    expect(originDateFor('2026-10-11', ov)).toBe('2026-10-11');
    expect(originDateFor('2026-10-17', new Map())).toBe('2026-10-17');
    expect(originDateFor('', ov)).toBeNull();
  });
});

describe('renameServiceDateSuffix', () => {
  it('mengganti suffix tanggal ID di akhir nama', () => {
    expect(renameServiceDateSuffix('Ibadah Pemuda Raya: Ancient Word, Modern World - 18 Okt 2026', '2026-10-17'))
      .toBe('Ibadah Pemuda Raya: Ancient Word, Modern World - 17 Okt 2026');
  });
  it('membiarkan nama tanpa suffix tanggal', () => {
    expect(renameServiceDateSuffix('Ibadah Gabungan Remaja', '2026-10-17')).toBe('Ibadah Gabungan Remaja');
  });
});

describe('geser sistemik plan/apply', () => {
  const mkPrisma = () => {
    const store = {
      assignments: [{ id: 'a1', cycleIndex: 2, eventDate: new Date('2026-10-18T00:00:00.000Z'), responsibleGroup: { name: 'R' }, hostGroup: { name: 'H' } }],
      events: [{ id: 'e1', name: 'Ibadah Pemuda Raya: Tema - 18 Okt 2026', slug: 's1', serviceType: 'SERVING_DAY', eventDate: new Date('2026-10-18T02:00:00.000Z'), startDate: new Date('2026-10-18T02:00:00.000Z'), status: 'ACTIVE' }],
      sessions: [{ id: 'ws1', title: 'Sesi', slug: 'sesi-1', sessionDate: new Date('2026-10-18T00:00:00.000Z'), eventId: 'e1' }],
      schedules: [{ id: 'sch1', date: new Date('2026-10-18T00:00:00.000Z'), eventId: 'e1', status: 'SCHEDULED' }],
      channels: [{ id: 'ch1', eventDate: new Date('2026-10-18T00:00:00.000Z'), status: 'OPEN', eventId: 'e1' }],
      contents: [{ id: 'c1', title: 'Ibadah Pemuda Raya: Tema - 18 Okt 2026', eventDate: new Date('2026-10-18T00:00:00.000Z'), eventId: 'e1' }],
      timeline: [{ id: 't1', day: new Date('2026-10-18T00:00:00.000Z'), eventId: 'e1', title: 'Ibadah' }],
      divisions: [{ id: 'd1', division: 'DIDASKALIA', driveFolderId: 'drv1', eventId: 'e1' }],
      overrides: [] as Array<{ eventDate: string; condition: string; newEventDate?: string }>,
    };
    const inRange = (d: Date, gte: Date, lt: Date) => d >= gte && d < lt;
    return {
      store,
      servingAssignment: {
        findMany: vi.fn(async ({ where }: any) => store.assignments.filter((a) => inRange(a.eventDate, where.eventDate.gte, where.eventDate.lt))),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.assignments.find((a) => a.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      eventProgram: {
        findMany: vi.fn(async ({ where }: any) => store.events.filter((e) => inRange(e.eventDate, where.eventDate.gte, where.eventDate.lt))),
        findUnique: vi.fn(async ({ where }: any) => store.events.find((e) => e.id === where.id) || null),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.events.find((e) => e.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      worshipSession: {
        findMany: vi.fn(async () => store.sessions),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.sessions.find((s) => s.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      serviceSchedule: {
        findMany: vi.fn(async ({ where }: any) => {
          if (where?.eventId) return store.schedules.filter((s) => where.eventId.in.includes(s.eventId));
          return [];
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.schedules.find((s) => s.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      servingWeekChannel: {
        findMany: vi.fn(async ({ where }: any) => store.channels.filter((c) => inRange(c.eventDate, where.eventDate.gte, where.eventDate.lt))),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.channels.find((c) => c.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      contentItem: {
        findMany: vi.fn(async () => store.contents),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.contents.find((c) => c.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      dayTimelineItem: {
        findMany: vi.fn(async () => store.timeline),
        update: vi.fn(async ({ where, data }: any) => {
          const row = store.timeline.find((t) => t.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        }),
      },
      eventDivision: {
        findMany: vi.fn(async () => store.divisions),
      },
      $executeRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
        if (String(sql).startsWith('INSERT INTO service_week_overrides')) {
          store.overrides.push({ eventDate: String(params[0]), condition: String(params[1]), newEventDate: String(params[5]) });
          return [];
        }
        return [];
      }),
    };
  };

  it('shiftInstantKeepTime mempertahankan jam (09:00 WIB)', () => {
    const out = shiftInstantKeepTime(new Date('2026-10-18T02:00:00.000Z'), '2026-10-17');
    expect(out.toISOString()).toBe('2026-10-17T02:00:00.000Z');
  });

  it('planGeser memuat semua artefak + preview rename', async () => {
    const prisma = mkPrisma() as any;
    const { preview, collisions } = await planGeser(prisma, '2026-10-18', '2026-10-17');
    expect(collisions).toHaveLength(0);
    expect(preview.assignments).toHaveLength(1);
    expect(preview.events[0].newName).toBe('Ibadah Pemuda Raya: Tema - 17 Okt 2026');
    expect(preview.worshipSessionsFollow).toBe(1);
    expect(preview.scheduleCount).toBe(1);
    expect(preview.channelCount).toBe(1);
    expect(preview.contentCount).toBe(1);
    expect(preview.contents[0].newTitle).toBe('Ibadah Pemuda Raya: Tema - 17 Okt 2026');
  });

  it('planGeser menandai tabrakan tanggal tujuan dengan label', async () => {
    const prisma = mkPrisma() as any;
    prisma.store.channels.push({ id: 'ch2', eventDate: new Date('2026-10-17T00:00:00.000Z'), status: 'OPEN', eventId: 'lain' });
    (prisma.eventProgram.findMany as any).mockImplementationOnce(async () => []);
    const { preview, collisions } = await planGeser(prisma, '2026-10-18', '2026-10-17');
    expect(collisions.length).toBeGreaterThan(0);
    expect(preview.collisions[0].label).toMatch(/Grup WA|Jadwal|Ibadah/);
  });

  it('applyGeser memindahkan semua tabel + rename + override', async () => {
    const prisma = mkPrisma() as any;
    const out = await applyGeser(prisma, { from: '2026-10-18', to: '2026-10-17', note: 'test', createdById: 'u1' });
    expect(out.moved).toMatchObject({ assignments: 1, events: 1, sessions: 1, schedules: 1, channels: 1, contents: 1, timeline: 1 });
    expect(prisma.store.events[0].name).toBe('Ibadah Pemuda Raya: Tema - 17 Okt 2026');
    expect(prisma.store.events[0].eventDate.toISOString().slice(0, 10)).toBe('2026-10-17');
    // Jam 02:00Z (09:00 WIB) dipertahankan, bukan midnight.
    expect(prisma.store.events[0].eventDate.toISOString()).toBe('2026-10-17T02:00:00.000Z');
    expect(prisma.store.contents[0].title).toBe('Ibadah Pemuda Raya: Tema - 17 Okt 2026');
    expect(prisma.store.overrides).toHaveLength(1);
    expect(out.renamed.length).toBeGreaterThan(0);
  });

  it('applyGeser menolak bila tujuan terisi (409 + preview)', async () => {
    const prisma = mkPrisma() as any;
    prisma.store.events.push({ id: 'e2', name: 'Lain - 17 Okt 2026', slug: 's2', serviceType: 'SERVING_DAY', eventDate: new Date('2026-10-17T02:00:00.000Z'), startDate: null, status: 'ACTIVE' });
    await expect(applyGeser(prisma, { from: '2026-10-18', to: '2026-10-17' })).rejects.toMatchObject({ status: 409 });
    // Sumber tidak ikut terpindah bila ditolak.
    expect(prisma.store.assignments[0].eventDate.toISOString().slice(0, 10)).toBe('2026-10-18');
  });
});
