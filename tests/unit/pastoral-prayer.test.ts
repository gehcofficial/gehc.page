import { describe, expect, it } from 'vitest';
import {
  decoratePrayerWeek,
  lateRecordedDays,
  mondayOf,
  parseDayInput,
  upcomingSunday,
  weekRange,
  wibDayKey,
} from '../../server/lib/prayer-week.mjs';

describe('wibDayKey', () => {
  it('tengah malam WIB ikut hari baru', () => {
    expect(wibDayKey(new Date('2026-09-08T17:30:00Z'))).toBe('2026-09-09');
    expect(wibDayKey(new Date('2026-09-09T03:00:00Z'))).toBe('2026-09-09');
  });
});

describe('parseDayInput', () => {
  it('hanya format YYYY-MM-DD', () => {
    expect(parseDayInput('2026-09-06')?.toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(parseDayInput('2026-9-6')).toBeNull();
    expect(parseDayInput('')).toBeNull();
    expect(parseDayInput(undefined)).toBeNull();
  });
});

describe('upcomingSunday / mondayOf', () => {
  it('Minggu terdekat (termasuk hari ini)', () => {
    // Rabu 9 Sep 2026 WIB → Minggu 13 Sep 2026.
    expect(upcomingSunday(new Date('2026-09-09T03:00:00Z'))).toBe('2026-09-13');
    // Minggu 13 Sep 2026 → hari itu sendiri.
    expect(upcomingSunday(new Date('2026-09-13T03:00:00Z'))).toBe('2026-09-13');
    // Sabtu 12 Sep 2026 → Minggu 13 Sep.
    expect(upcomingSunday(new Date('2026-09-12T03:00:00Z'))).toBe('2026-09-13');
  });

  it('Senin dari minggu berjalan', () => {
    expect(mondayOf('2026-09-13')).toBe('2026-09-07');
    expect(mondayOf('2026-09-07')).toBe('2026-09-07');
    expect(mondayOf('2026-09-09')).toBe('2026-09-07');
  });

  it('weekRange memberi Senin–Minggu', () => {
    const r = weekRange('2026-09-13');
    expect(r.monday).toBe('2026-09-07');
    expect(r.start.toISOString().slice(0, 10)).toBe('2026-09-07');
    expect(r.end.toISOString().slice(0, 10)).toBe('2026-09-13');
  });
});

describe('decoratePrayerWeek', () => {
  const notes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('menandai yang sudah didoakan minggu ini + statistik', () => {
    const r = decoratePrayerWeek(notes, [{ noteId: 'a', prayedOn: '2026-09-08' }, { noteId: 'c', prayedOn: '2026-09-13' }]);
    expect(r.notes.map((n) => n.prayedThisWeek)).toEqual([true, false, true]);
    expect(r.stats).toEqual({ total: 3, prayed: 2, notPrayed: 1 });
  });

  it('tanpa log → semua belum didoakan', () => {
    const r = decoratePrayerWeek(notes, []);
    expect(r.stats).toEqual({ total: 3, prayed: 0, notPrayed: 3 });
  });
});

describe('lateRecordedDays', () => {
  it('0 bila sama hari atau tidak lengkap', () => {
    expect(lateRecordedDays('2026-09-03', '2026-09-03')).toBe(0);
    expect(lateRecordedDays(null, '2026-09-03')).toBe(0);
    expect(lateRecordedDays('2026-09-03', null)).toBe(0);
  });

  it('menghitung keterlambatan pencatatan', () => {
    expect(lateRecordedDays('2026-09-03', '2026-09-06')).toBe(3);
  });
});
