import { describe, expect, it, vi } from 'vitest';
import { OVERRIDE_CONDITIONS, effectiveDate, upsertOverride } from '../../server/lib/service-overrides.mjs';

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
