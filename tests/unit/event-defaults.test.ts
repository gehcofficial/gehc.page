import { describe, expect, it } from 'vitest';
import {
  FALLBACK_TIME_END,
  FALLBACK_TIME_START,
  FALLBACK_VENUE,
  eventDefaultsFromProfile,
  normalizeTime,
  pickDefaultSchedule,
} from '../../server/lib/event-defaults.mjs';

describe('normalizeTime', () => {
  it('menerima format Indonesia & WIB', () => {
    expect(normalizeTime('13:00')).toBe('13:00');
    expect(normalizeTime('13.00 WIB')).toBe('13:00');
    expect(normalizeTime('7:5')).toBeNull();
    expect(normalizeTime('')).toBeNull();
    expect(normalizeTime('abc')).toBeNull();
  });
});

describe('pickDefaultSchedule', () => {
  const schedules = [
    { label: 'Ibadah Umum', day: 'Minggu', time: '10.00 WIB' },
    { label: 'Ibadah Pemuda', day: 'Minggu', time: '13.00-15.00 WIB' },
  ];

  it('utamakan jadwal ibadah/pemuda untuk hari layanan', () => {
    expect(pickDefaultSchedule(schedules, 'SERVING_DAY')).toEqual({ timeStart: '13:00', timeEnd: '15:00' });
    expect(pickDefaultSchedule(schedules, 'MENTORING_DAY')).toEqual({ timeStart: '13:00', timeEnd: '15:00' });
  });

  it('ambil baris pertama bila label tidak spesifik', () => {
    const other = [{ label: 'Latihan', day: 'Sabtu', time: '09:00' }];
    expect(pickDefaultSchedule(other, 'SERVING_DAY')).toEqual({ timeStart: '09:00', timeEnd: null });
  });

  it('aman untuk data kosong/aneh', () => {
    expect(pickDefaultSchedule(null, 'SERVING_DAY')).toEqual({ timeStart: null, timeEnd: null });
    expect(pickDefaultSchedule([{ label: 'x', time: '' }], 'SERVING_DAY')).toEqual({ timeStart: null, timeEnd: null });
  });
});

describe('eventDefaultsFromProfile', () => {
  it('mengisi tempat, WA, dan jam dari profil', () => {
    const d = eventDefaultsFromProfile(
      { name: 'GMIM Eben Haezer Cikarang', whatsappGroupUrl: 'https://chat.whatsapp.com/abc', schedules: [{ label: 'Ibadah Pemuda', time: '13.00' }] },
      'SERVING_DAY',
    );
    expect(d.venueName).toBe('GMIM Eben Haezer Cikarang');
    expect(d.whatsappGroupUrl).toBe('https://chat.whatsapp.com/abc');
    expect(d.timeStart).toBe('13:00');
  });

  it('fallback saat profil kosong', () => {
    const d = eventDefaultsFromProfile(null, 'SERVING_DAY');
    expect(d.venueName).toBe(FALLBACK_VENUE);
    expect(d.whatsappGroupUrl).toBeNull();
    expect(d.timeStart).toBe(FALLBACK_TIME_START);
    expect(d.timeEnd).toBe(FALLBACK_TIME_END);
  });
});
