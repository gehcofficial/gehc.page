import { describe, expect, it } from 'vitest';
import {
  attendanceHash,
  attendanceResultTitle,
  isAttendancePin,
  isAttendanceToken,
  tokenFromHash,
} from '../../src/lib/event-attendance';
import { parseHashRoute } from '../../src/lib/hash-routes';
import { isAuthHash } from '../../src/lib/host-context';
import { buildEventQrToken } from '../../server/lib/event-qr-token.mjs';

describe('event-attendance: tautan & token', () => {
  it('membangun hash halaman absensi dengan token ter-encode', () => {
    const token = 'GEHC-EV|evt-1|1000|abcdefghijkl';
    expect(attendanceHash('retreat-pemuda', token)).toBe(
      `#/hadir/retreat-pemuda?t=${encodeURIComponent(token)}`,
    );
    expect(attendanceHash('retreat-pemuda')).toBe('#/hadir/retreat-pemuda');
  });

  it('mengambil token dari hash (hash tidak dikirim ke server)', () => {
    const { token } = buildEventQrToken('evt-1', { now: 30_000 });
    const hash = attendanceHash('retreat', token);
    expect(tokenFromHash(hash)).toBe(token);
    expect(tokenFromHash('#/hadir/retreat')).toBeNull();
    expect(tokenFromHash('')).toBeNull();
  });

  it('membedakan token QR dan PIN', () => {
    const { token } = buildEventQrToken('evt-1', { now: 30_000 });
    expect(isAttendanceToken(token)).toBe(true);
    expect(isAttendanceToken('GEHC-EV|rusak')).toBe(false);
    expect(isAttendanceToken('123456')).toBe(false);
    expect(isAttendancePin('123456')).toBe(true);
    expect(isAttendancePin('12345')).toBe(false);
    expect(isAttendancePin('abcdef')).toBe(false);
  });

  it('judul hasil ramah dibaca', () => {
    expect(attendanceResultTitle('OK')).toBe('Kehadiran tercatat');
    expect(attendanceResultTitle('DUPLICATE')).toContain('Sudah');
    expect(attendanceResultTitle('EXPIRED')).toContain('kedaluwarsa');
    expect(attendanceResultTitle('apa-saja')).toBe('Belum bisa dicatat');
  });
});

describe('event-attendance: rute', () => {
  it('parseHashRoute mengenali #/hadir/<slug> + token', () => {
    const parsed = parseHashRoute('#/hadir/retreat-pemuda?t=GEHC-EV%7Cevt-1%7C1000%7Cabcdefghijkl');
    expect(parsed.tab).toBe('attendance-scan');
    expect(parsed.eventSlug).toBe('retreat-pemuda');
    expect(parsed.params.get('t')).toBe('GEHC-EV|evt-1|1000|abcdefghijkl');
  });

  it('hash absensi tetap dirender aplikasi di host hub', () => {
    expect(isAuthHash('#/hadir/retreat-pemuda')).toBe(true);
    expect(isAuthHash('#/hadir/retreat-pemuda?t=x')).toBe(true);
  });
});
