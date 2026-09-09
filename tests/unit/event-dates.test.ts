import { describe, it, expect } from 'vitest';
import { eventDayState, todayWibKey, wibDayKey } from '../../src/lib/event-dates';
import { lifecycleAction, shiftDayKey } from '../../server/lib/event-lifecycle.mjs';

const NOW = new Date('2026-09-09T10:00:00+07:00'); // Rabu 9 Sep 2026 WIB

describe('wibDayKey', () => {
  it('batas hari ikut WIB bukan UTC', () => {
    // 02:00 WIB 9 Sep = 19:00 UTC 8 Sep → tetap 9 Sep WIB.
    expect(wibDayKey(new Date('2026-09-08T19:00:00Z'))).toBe('2026-09-09');
    expect(todayWibKey(NOW)).toBe('2026-09-09');
  });
});

describe('eventDayState', () => {
  it('today untuk tanggal yang sama (WIB)', () => {
    expect(eventDayState('2026-09-09T00:33:00+07:00', NOW)).toBe('today');
    expect(eventDayState('2026-09-09', NOW)).toBe('today');
  });

  it('future dan past', () => {
    expect(eventDayState('2026-09-12T15:00:00+07:00', NOW)).toBe('future');
    expect(eventDayState('2026-09-06T00:00:00Z', NOW)).toBe('past');
  });

  it('unknown untuk kosong/rusak', () => {
    expect(eventDayState(null, NOW)).toBe('unknown');
    expect(eventDayState('ngaco', NOW)).toBe('unknown');
  });
});

describe('lifecycleAction', () => {
  it('ACTIVE lewat hari → done', () => {
    expect(lifecycleAction({ status: 'ACTIVE', eventDate: '2026-09-06T00:00:00Z' }, NOW)).toBe('done');
    expect(lifecycleAction({ status: 'PLANNING', eventDate: '2026-09-08T10:00:00Z' }, NOW)).toBe('done');
  });

  it('hari ini / akan datang → null', () => {
    expect(lifecycleAction({ status: 'ACTIVE', eventDate: '2026-09-09T00:33:00+07:00' }, NOW)).toBeNull();
    expect(lifecycleAction({ status: 'ACTIVE', eventDate: '2026-09-12T15:00:00+07:00' }, NOW)).toBeNull();
  });

  it('DONE >7 hari → archive; DONE baru → null', () => {
    expect(lifecycleAction({ status: 'DONE', eventDate: '2026-08-30T00:00:00Z' }, NOW)).toBe('archive');
    expect(lifecycleAction({ status: 'DONE', eventDate: '2026-09-05T00:00:00Z' }, NOW)).toBeNull();
  });

  it('tanpa tanggal / ARCHIVED → null', () => {
    expect(lifecycleAction({ status: 'ACTIVE', eventDate: null }, NOW)).toBeNull();
    expect(lifecycleAction({ status: 'ARCHIVED', eventDate: '2026-08-01T00:00:00Z' }, NOW)).toBeNull();
  });

  it('shiftDayKey mundur 7 hari', () => {
    expect(shiftDayKey('2026-09-09', -7)).toBe('2026-09-02');
  });
});
