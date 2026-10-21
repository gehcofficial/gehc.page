import { beforeEach, describe, expect, it } from 'vitest';
import {
  ATTENDANCE_CLOSE_AFTER_MS,
  ATTENDANCE_OPEN_BEFORE_MS,
  EVENT_QR_PREFIX,
  QR_SLOT_MS,
  attendanceLogCode,
  attendanceWindow,
  buildEventQrToken,
  isSelfScanCode,
  pinForSlot,
  slotAt,
  verifyEventPin,
  verifyEventQrToken,
} from '../../server/lib/event-qr-token.mjs';
import { clearRateLimits, rateLimit, resetRateLimit } from '../../server/lib/rate-limit.mjs';

const EVENT = 'evt-debat-1';
const AT = new Date('2026-10-21T10:00:00.000Z').getTime();

describe('event-qr-token: QR event berputar', () => {
  it('token round-trip untuk event yang sama', () => {
    const { token, pin, slot } = buildEventQrToken(EVENT, { now: AT });
    expect(token.startsWith(`${EVENT_QR_PREFIX}|${EVENT}|${slot}|`)).toBe(true);
    expect(pin).toMatch(/^\d{6}$/);
    expect(verifyEventQrToken(token, { eventId: EVENT, now: AT })).toEqual({ ok: true, slot });
  });

  it('menolak token untuk event lain', () => {
    const { token } = buildEventQrToken(EVENT, { now: AT });
    expect(verifyEventQrToken(token, { eventId: 'evt-lain', now: AT })).toEqual({ ok: false, reason: 'EVENT' });
  });

  it('toleran satu slot (±30 dtk) tapi menolak setelahnya', () => {
    const { token } = buildEventQrToken(EVENT, { now: AT });
    expect(verifyEventQrToken(token, { eventId: EVENT, now: AT + QR_SLOT_MS }).ok).toBe(true);
    expect(verifyEventQrToken(token, { eventId: EVENT, now: AT + QR_SLOT_MS * 3 })).toMatchObject({ ok: false, reason: 'EXPIRED' });
  });

  it('menolak signature yang diubah / format rusak', () => {
    const { token } = buildEventQrToken(EVENT, { now: AT });
    const parts = token.split('|');
    const tampered = [...parts.slice(0, 3), 'AAAAAAAAAAAA'].join('|');
    expect(verifyEventQrToken(tampered, { eventId: EVENT, now: AT })).toMatchObject({ ok: false, reason: 'SIGNATURE' });
    expect(verifyEventQrToken('GEHC-EV|rusak', { eventId: EVENT, now: AT })).toMatchObject({ ok: false, reason: 'FORMAT' });
  });

  it('PIN cocok untuk slot sekarang dan berganti tiap slot', () => {
    const { pin, slot } = buildEventQrToken(EVENT, { now: AT });
    expect(pin).toBe(pinForSlot(EVENT, slot));
    expect(verifyEventPin(pin, { eventId: EVENT, now: AT })).toEqual({ ok: true, slot });
    expect(verifyEventPin('000000', { eventId: EVENT, now: AT }).ok).toBe(pin === '000000');
    expect(pinForSlot(EVENT, slot)).not.toBe(pinForSlot(EVENT, slot + 1));
  });

  it('PIN dari event lain tidak berlaku', () => {
    const { pin } = buildEventQrToken(EVENT, { now: AT });
    expect(verifyEventPin(pin, { eventId: 'evt-lain', now: AT }).ok).toBe(false);
  });
});

describe('event-qr-token: jendela absensi', () => {
  const eventDate = '2026-10-21T10:00:00.000Z';
  const base = new Date(eventDate).getTime();

  it('buka H-2 jam dan tutup +6 jam', () => {
    expect(attendanceWindow(eventDate, { now: base - ATTENDANCE_OPEN_BEFORE_MS + 1000 }).open).toBe(true);
    expect(attendanceWindow(eventDate, { now: base + ATTENDANCE_CLOSE_AFTER_MS - 1000 }).open).toBe(true);
    expect(attendanceWindow(eventDate, { now: base - ATTENDANCE_OPEN_BEFORE_MS - 1000 })).toMatchObject({ open: false, reason: 'NOT_YET' });
    expect(attendanceWindow(eventDate, { now: base + ATTENDANCE_CLOSE_AFTER_MS + 1000 })).toMatchObject({ open: false, reason: 'CLOSED' });
  });

  it('event tanpa tanggal tidak pernah otomatis terbuka', () => {
    expect(attendanceWindow(null, { now: base })).toMatchObject({ open: false, reason: 'NO_DATE' });
  });

  it('menyertakan batas jendela untuk ditampilkan', () => {
    const win = attendanceWindow(eventDate, { now: base });
    expect(win.validFrom).toBe(new Date(base - ATTENDANCE_OPEN_BEFORE_MS).toISOString());
    expect(win.validTo).toBe(new Date(base + ATTENDANCE_CLOSE_AFTER_MS).toISOString());
  });
});

describe('event-qr-token: penanda audit', () => {
  it('kode log tidak membawa signature dan dikenali sebagai absensi mandiri', () => {
    const code = attendanceLogCode('qr', 123456);
    expect(code).toBe('EVENT-QR|123456');
    expect(isSelfScanCode(code)).toBe(true);
    expect(isSelfScanCode(attendanceLogCode('pin', 123456))).toBe(true);
    expect(isSelfScanCode('WALK-IN|Budi|0812')).toBe(false);
    expect(isSelfScanCode('MENTOR:usr-1')).toBe(false);
  });

  it('slot dihitung per 30 detik', () => {
    expect(slotAt(0)).toBe(0);
    expect(slotAt(QR_SLOT_MS - 1)).toBe(0);
    expect(slotAt(QR_SLOT_MS)).toBe(1);
  });
});

describe('rate-limit: penahan brute-force PIN', () => {
  beforeEach(() => clearRateLimits());

  it('mengizinkan sampai batas lalu menolak', () => {
    const opts = { limit: 3, windowMs: 60_000, now: 1_000_000 };
    expect(rateLimit('u1', opts).allowed).toBe(true);
    expect(rateLimit('u1', opts).allowed).toBe(true);
    expect(rateLimit('u1', opts).allowed).toBe(true);
    const blocked = rateLimit('u1', opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('jendela bergulir — hit lama tidak lagi dihitung', () => {
    const opts = { limit: 2, windowMs: 60_000 };
    expect(rateLimit('u2', { ...opts, now: 0 }).allowed).toBe(true);
    expect(rateLimit('u2', { ...opts, now: 1 }).allowed).toBe(true);
    expect(rateLimit('u2', { ...opts, now: 2 }).allowed).toBe(false);
    expect(rateLimit('u2', { ...opts, now: 61_000 }).allowed).toBe(true);
  });

  it('kunci terpisah per user dan bisa direset', () => {
    const opts = { limit: 1, windowMs: 60_000, now: 5_000 };
    expect(rateLimit('a', opts).allowed).toBe(true);
    expect(rateLimit('b', opts).allowed).toBe(true);
    resetRateLimit('a');
    expect(rateLimit('a', opts).allowed).toBe(true);
  });
});
