import { describe, expect, it } from 'vitest';
import {
  originDateForEvent,
  sundaysInMonth,
  weekForEventDate,
  weekIndexForDateWib,
} from '../../src/lib/church-week';

const GESER_18_17 = [{ eventDate: '2026-10-18', newEventDate: '2026-10-17', condition: 'GESER' }];

describe('church-week: grid Minggu–Sabtu', () => {
  it('Minggu Oktober 2026 = 4/11/18/25', () => {
    expect(sundaysInMonth('2026-10')).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  });

  it('Sabtu 17 Okt masuk W2, Minggu 18 Okt masuk W3 (tanpa override)', () => {
    expect(weekIndexForDateWib('2026-10-17T13:00:00+07:00')).toBe(2);
    expect(weekIndexForDateWib('2026-10-18T13:00:00+07:00')).toBe(3);
  });
});

describe('church-week: arah-balik GESER (materi ikut origin week)', () => {
  it('originDateForEvent membalikkan target ke asal', () => {
    expect(originDateForEvent('2026-10-17', GESER_18_17)).toBe('2026-10-18');
    expect(originDateForEvent('2026-10-18', GESER_18_17)).toBe('2026-10-18');
    expect(originDateForEvent('2026-10-11', GESER_18_17)).toBe('2026-10-11');
  });

  it('kondisi selain GESER diabaikan + input rusak aman', () => {
    expect(originDateForEvent('2026-10-17', [{ eventDate: '2026-10-18', newEventDate: '2026-10-17', condition: 'LIBUR' }])).toBe('2026-10-17');
    expect(originDateForEvent('2026-10-17', [])).toBe('2026-10-17');
    expect(originDateForEvent('', GESER_18_17)).toBe('');
    expect(originDateForEvent('acak', GESER_18_17)).toBe('');
  });

  it('weekForEventDate: event geseran 17 Okt → 2026-10/W3', () => {
    expect(weekForEventDate('2026-10-17T13:00:00+07:00', GESER_18_17)).toEqual({ ym: '2026-10', weekIndex: 3 });
    expect(weekForEventDate('2026-10-17T13:00:00+07:00', [])).toEqual({ ym: '2026-10', weekIndex: 2 });
    expect(weekForEventDate('2026-10-18T13:00:00+07:00', GESER_18_17)).toEqual({ ym: '2026-10', weekIndex: 3 });
    expect(weekForEventDate(null)).toEqual({ ym: '', weekIndex: 1 });
  });
});
