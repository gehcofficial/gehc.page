import crypto from 'node:crypto';

/**
 * QR kehadiran tingkat event (kebalikan dari QR pribadi peserta).
 *
 * Panitia menampilkan satu QR di layar; peserta memindainya dan kehadirannya
 * dicatat atas nama akun sendiri. Karena QR statis bisa difoto/dibagikan,
 * token diturunkan dari slot waktu 30 detik + HMAC, sehingga screenshot
 * kedaluwarsa ±90 detik kemudian (toleransi 1 slot ke belakang/depan).
 *
 * Format: `GEHC-EV|<eventId>|<slot>|<sig12>`
 * PIN 6 digit diturunkan dari slot yang sama untuk cadangan bila kamera gagal.
 */

export const EVENT_QR_PREFIX = 'GEHC-EV';
export const QR_SLOT_MS = 30_000;
export const QR_SLOT_TOLERANCE = 1;
export const ATTENDANCE_OPEN_BEFORE_MS = 2 * 60 * 60 * 1000;
export const ATTENDANCE_CLOSE_AFTER_MS = 6 * 60 * 60 * 1000;
export const SIG_LENGTH = 12;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Fallback deterministik — sama seperti cookie sesi; produksi wajib SESSION_SECRET.
  return `gehc::${crypto.createHash('sha256').update(process.env.DATABASE_URL || 'no-db').digest('hex')}`;
}

function sign(eventId, slot, kind) {
  return crypto
    .createHmac('sha256', secret())
    .update(`event-qr|${kind}|${eventId}|${slot}`)
    .digest('base64url')
    .slice(0, SIG_LENGTH);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function slotAt(now = Date.now(), slotMs = QR_SLOT_MS) {
  return Math.floor(now / slotMs);
}

/** PIN 6 digit untuk slot ini (ikut berputar, tidak bisa di-share lama). */
export function pinForSlot(eventId, slot) {
  const digest = crypto.createHmac('sha256', secret()).update(`event-pin|${eventId}|${slot}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

export function buildEventQrToken(eventId, { now = Date.now() } = {}) {  const id = String(eventId);
  const slot = slotAt(now);
  return {
    token: `${EVENT_QR_PREFIX}|${id}|${slot}|${sign(id, slot, 'qr')}`,
    pin: pinForSlot(id, slot),
    slot,
    expiresAt: new Date((slot + 1) * QR_SLOT_MS).toISOString(),
    slotMs: QR_SLOT_MS,
  };
}

/**
 * Verifikasi token QR event.
 * @param {string} raw
 * @param {{ eventId?: string, now?: number, tolerance?: number }} [opts]
 * @returns {{ ok: boolean, reason?: string, slot?: number }}
 *   reason: FORMAT | EVENT | SIGNATURE | EXPIRED
 */
export function verifyEventQrToken(raw, { eventId, now = Date.now(), tolerance = QR_SLOT_TOLERANCE } = {}) {
  const code = String(raw || '').trim();
  const parts = code.split('|');
  if (parts.length !== 4) return { ok: false, reason: 'FORMAT' };
  const [prefix, id, slotRaw, sig] = parts;
  if (prefix !== EVENT_QR_PREFIX || !id) return { ok: false, reason: 'FORMAT' };
  if (eventId && id !== String(eventId)) return { ok: false, reason: 'EVENT' };
  const slot = Number(slotRaw);
  if (!Number.isInteger(slot) || slot <= 0) return { ok: false, reason: 'FORMAT' };
  if (!safeEqual(sig, sign(id, slot, 'qr'))) return { ok: false, reason: 'SIGNATURE' };
  if (Math.abs(slotAt(now) - slot) > tolerance) return { ok: false, reason: 'EXPIRED', slot };
  return { ok: true, slot };
}

/**
 * PIN dicek terhadap slot sekarang ± toleransi (sama seperti QR).
 * @param {string} pin
 * @param {{ eventId?: string, now?: number, tolerance?: number }} [opts]
 */
export function verifyEventPin(pin, { eventId, now = Date.now(), tolerance = QR_SLOT_TOLERANCE } = {}) {
  const value = String(pin || '').trim();
  if (!/^\d{6}$/.test(value)) return { ok: false, reason: 'FORMAT' };
  const current = slotAt(now);
  for (let delta = -tolerance; delta <= tolerance; delta += 1) {
    const slot = current + delta;
    if (safeEqual(value, pinForSlot(String(eventId), slot))) return { ok: true, slot };
  }
  return { ok: false, reason: 'EXPIRED' };
}

/**
 * Jendela absensi mandiri: buka 2 jam sebelum `eventDate`, tutup 6 jam sesudahnya.
 * Event tanpa tanggal tidak pernah otomatis terbuka (panitia tetap bisa memakai QR pribadi).
 * @param {Date|string|null|undefined} eventDate
 * @param {{ now?: number, openBeforeMs?: number, closeAfterMs?: number }} [opts]
 */
export function attendanceWindow(eventDate, {
  now = Date.now(),
  openBeforeMs = ATTENDANCE_OPEN_BEFORE_MS,
  closeAfterMs = ATTENDANCE_CLOSE_AFTER_MS,
} = {}) {
  const at = eventDate ? new Date(eventDate).getTime() : NaN;
  if (!Number.isFinite(at)) {
    return { open: false, reason: 'NO_DATE', validFrom: null, validTo: null };
  }
  const from = at - openBeforeMs;
  const to = at + closeAfterMs;
  const open = now >= from && now <= to;
  return {
    open,
    reason: open ? 'OPEN' : (now < from ? 'NOT_YET' : 'CLOSED'),
    validFrom: new Date(from).toISOString(),
    validTo: new Date(to).toISOString(),
  };
}

/** Kode yang aman disimpan di `event_check_ins.code` (tanpa signature). */
export function attendanceLogCode(kind, slot) {
  return `${kind === 'pin' ? 'EVENT-PIN' : 'EVENT-QR'}|${slot}`;
}

/** True bila baris scan berasal dari absensi mandiri peserta (konvensi prefix). */
export function isSelfScanCode(code) {
  return /^EVENT-(QR|PIN)\|/.test(String(code || ''));
}
