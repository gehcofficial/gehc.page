import { describe, expect, it } from 'vitest';
import {
  PUBLIC_DUTY_STATUSES,
  assignCycleIndexes,
  filterPublicDuties,
  groupDutiesByDay,
  isPublicDuty,
} from '../../server/lib/service-duty.mjs';

describe('aturan tampil publik petugas', () => {
  it('hanya CONFIRMED & DONE yang boleh tampil publik', () => {
    expect(PUBLIC_DUTY_STATUSES).toEqual(['CONFIRMED', 'DONE']);
    expect(isPublicDuty({ status: 'CONFIRMED' })).toBe(true);
    expect(isPublicDuty({ status: 'done' })).toBe(true);
    expect(isPublicDuty({ status: 'SCHEDULED' })).toBe(false);
    expect(isPublicDuty({ status: 'CANCELLED' })).toBe(false);
    expect(isPublicDuty({})).toBe(false);
    expect(isPublicDuty(null)).toBe(false);
  });

  it('filter menyisakan hanya yang dikonfirmasi', () => {
    const rows = [
      { id: 'a', status: 'SCHEDULED' },
      { id: 'b', status: 'CONFIRMED' },
      { id: 'c', status: 'DONE' },
      { id: 'd', status: 'CANCELLED' },
    ];
    expect(filterPublicDuties(rows).map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('groupDutiesByDay', () => {
  const rows = [
    { date: '2026-09-27', status: 'CONFIRMED', timeStart: '13:00', serviceRole: { name: 'Singer', division: 'LITURGIA' }, user: { name: 'Budi' } },
    { date: '2026-09-27', status: 'CONFIRMED', timeStart: '07:00', serviceRole: { name: 'Operator Sound', division: 'MARTURIA' }, user: { name: 'Sari' } },
    { date: new Date('2026-10-04T00:00:00Z'), status: 'DONE', serviceRole: { name: 'Liturgist', division: 'LITURGIA' }, user: { name: 'Ani' } },
  ];

  it('mengelompokkan per tanggal & urut jam', () => {
    const out = groupDutiesByDay(rows);
    expect(Object.keys(out).sort()).toEqual(['2026-09-27', '2026-10-04']);
    expect(out['2026-09-27'].map((x) => x.role)).toEqual(['Operator Sound', 'Singer']);
    expect(out['2026-09-27'][1]).toMatchObject({ name: 'Budi', division: 'LITURGIA', timeStart: '13:00' });
  });

  it('menerima Date (Prisma @db.Date)', () => {
    const out = groupDutiesByDay(rows);
    expect(out['2026-10-04'][0].name).toBe('Ani');
  });

  it('aman untuk data kosong / tanpa tanggal', () => {
    expect(groupDutiesByDay([])).toEqual({});
    expect(groupDutiesByDay([{ status: 'DONE' }])).toEqual({});
  });
});

describe('assignCycleIndexes', () => {
  it('memberi indeks berurutan dari baseIdx dan membungkus di 10', () => {
    const days = ['2026-09-13', '2026-09-20', '2026-09-27'];
    expect([...assignCycleIndexes(days, { baseIdx: 0 }).values()]).toEqual([0, 1, 2]);
    expect([...assignCycleIndexes(days, { baseIdx: 8 }).values()]).toEqual([8, 9, 0]);
  });

  it('aman untuk daftar kosong', () => {
    expect(assignCycleIndexes([]).size).toBe(0);
    expect(assignCycleIndexes(undefined).size).toBe(0);
  });
});
