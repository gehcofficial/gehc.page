import { describe, expect, it } from 'vitest';
import { scheduleMatchesEvent, summarizePetugas, wibDayKey } from '../../server/lib/petugas-crosscheck.mjs';

describe('petugas-crosscheck: hari WIB', () => {
  it('wibDayKey menggeser +7 jam', () => {
    expect(wibDayKey('2026-10-10T18:00:00.000Z')).toBe('2026-10-11');
    expect(wibDayKey('2026-10-10T16:00:00.000Z')).toBe('2026-10-10');
    expect(wibDayKey(null)).toBeNull();
    expect(wibDayKey('ngawur')).toBeNull();
  });
});

describe('petugas-crosscheck: pencocokan jadwal', () => {
  const event = { id: 'ev-1', eventDate: '2026-10-11T03:00:00.000Z' }; // 11 Okt 10:00 WIB
  it('eventId sama selalu cocok', () => {
    expect(scheduleMatchesEvent(event, { eventId: 'ev-1', date: '2020-01-01' })).toBe(true);
  });
  it('eventId null + tanggal WIB sama → cocok (tugas mingguan)', () => {
    expect(scheduleMatchesEvent(event, { eventId: null, date: '2026-10-11' })).toBe(true);
    expect(scheduleMatchesEvent(event, { eventId: null, date: '2026-10-10T20:00:00.000Z' })).toBe(true);
  });
  it('eventId null + tanggal beda → tidak', () => {
    expect(scheduleMatchesEvent(event, { eventId: null, date: '2026-10-12' })).toBe(false);
  });
  it('eventId lain → tidak; tanpa event → tidak', () => {
    expect(scheduleMatchesEvent(event, { eventId: 'ev-2', date: '2026-10-11' })).toBe(false);
    expect(scheduleMatchesEvent(null, { eventId: 'ev-1' })).toBe(false);
  });
});

describe('petugas-crosscheck: ringkasan', () => {
  const rows = [
    { scheduleId: 's1', userId: 'u1', name: 'A', role: 'Main Speaker', division: 'DIDASKALIA', status: 'CONFIRMED', present: true, source: 'scan' },
    { scheduleId: 's2', userId: 'u2', name: 'B', role: 'Liturgia', division: 'LITURGIA', status: 'CONFIRMED', present: true, source: 'otomatis' },
    { scheduleId: 's3', userId: 'u3', name: 'C', role: 'MC', division: 'KOINONIA', status: 'SCHEDULED', present: false, source: null },
    { scheduleId: 's4', userId: 'u4', name: 'D', role: 'Foto', division: 'MARTURIA', status: 'CANCELLED', present: false, source: null },
  ];
  it('hitung total/konfirmasi/hadir + missing = SCHEDULED', () => {
    const s = summarizePetugas(rows);
    expect(s).toMatchObject({ total: 4, confirmed: 2, scheduled: 1, cancelled: 1, present: 2 });
    expect(s.missing.map((m) => m.userId)).toEqual(['u3']);
    expect(s.byDivision.DIDASKALIA).toMatchObject({ total: 1, confirmed: 1, present: 1 });
    expect(s.byDivision.KOINONIA).toMatchObject({ total: 1, confirmed: 0, present: 0 });
  });
  it('kosong → nol semua', () => {
    expect(summarizePetugas([])).toMatchObject({ total: 0, confirmed: 0, present: 0, missing: [] });
    expect(summarizePetugas(null).total).toBe(0);
  });
});
