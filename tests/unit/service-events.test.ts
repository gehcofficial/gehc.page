import { describe, it, expect } from 'vitest';
import { formatSundayID, servicePrefix, formatServiceName, sundayInstant, resolveWorshipEventByDate } from '../../server/lib/service-events.mjs';

describe('formatSundayID', () => {
  it('06 Sep 2026', () => {
    expect(formatSundayID('2026-09-06')).toBe('06 Sep 2026');
  });

  it('Mei dan Agu Indonesia', () => {
    expect(formatSundayID('2026-05-03')).toBe('03 Mei 2026');
    expect(formatSundayID('2026-08-30')).toBe('30 Agu 2026');
  });
});

describe('servicePrefix', () => {
  it('kolom mengalahkan bipra', () => {
    expect(servicePrefix('Pemuda', 'Kolom 5')).toBe('Ibadah Kolom 5');
  });

  it('default Pemuda', () => {
    expect(servicePrefix('Pemuda', '')).toBe('Ibadah Pemuda');
    expect(servicePrefix('', '')).toBe('Ibadah Pemuda');
  });
});

describe('formatServiceName', () => {
  it('pola Prefix: Tema - DD Mon YYYY', () => {
    expect(formatServiceName('Ibadah Pemuda', 'Hidup Kudus', '2026-09-06')).toBe(
      'Ibadah Pemuda: Hidup Kudus - 06 Sep 2026',
    );
  });

  it('tema kosong = string kosong', () => {
    expect(formatServiceName('Ibadah Pemuda', '  ', '2026-09-06')).toBe('');
  });
});

describe('sundayInstant', () => {
  it('instant valid dan null untuk input rusak', () => {
    expect(sundayInstant('2026-09-06')?.toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(sundayInstant('ngaco')).toBeNull();
  });
});

describe('resolveWorshipEventByDate', () => {
  const prisma = (rows: unknown[]) => ({ eventProgram: { findMany: async () => rows } });
  const ev = (id: string, eventDate: string, serviceType?: string, kind?: string) =>
    ({ id, eventDate: new Date(eventDate), serviceType: serviceType ?? null, kind: kind ?? null });

  it('match ibadah dengan jam WIB (09:00 WIB = 02:00Z)', async () => {
    const p = prisma([ev('e1', '2026-09-06T02:00:00.000Z', 'SERVING_DAY')]) as never;
    expect(await resolveWorshipEventByDate(p, '2026-09-06')).toBe('e1');
  });

  it('match wall-clock sore (15:00+07:00) & mentoring/UMUM', async () => {
    const p = prisma([
      ev('e1', '2026-09-12T08:00:00.000Z', 'MENTORING_DAY'),
      ev('e2', '2026-09-12T08:00:00.000Z', null, 'UMUM'),
    ]) as never;
    expect(await resolveWorshipEventByDate(p, '2026-09-12')).toBe('e1');
  });

  it('event malam UTC jatuh ke tanggal WIB berikutnya', async () => {
    const p = prisma([ev('e1', '2026-09-12T23:00:00.000Z', 'SERVING_DAY')]) as never;
    expect(await resolveWorshipEventByDate(p, '2026-09-12')).toBeNull();
    expect(await resolveWorshipEventByDate(p, '2026-09-13')).toBe('e1');
  });

  it('bukan ibadah = dilewati; tanpa match = null', async () => {
    const p = prisma([ev('e1', '2026-09-06T02:00:00.000Z', null, 'LATIHAN')]) as never;
    expect(await resolveWorshipEventByDate(p, '2026-09-06')).toBeNull();
    expect(await resolveWorshipEventByDate(null as never, '2026-09-06')).toBeNull();
    expect(await resolveWorshipEventByDate(prisma([]) as never, 'ngaco')).toBeNull();
  });
});
