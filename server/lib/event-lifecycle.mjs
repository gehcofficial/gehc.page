/**
 * Siklus hidup event berbasis tanggal WIB (dipakai cron harian + tombol manual).
 * - eventDate < hari ini (WIB) dan status PLANNING/ACTIVE → DONE.
 * - status DONE dan eventDate < hari ini - 7 → ARCHIVED (+ notifikasi Komisi).
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86400000;

/** Kunci hari YYYY-MM-DD dalam WIB. */
export function wibDayKey(d) {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayWibKey(now = new Date()) {
  return wibDayKey(now);
}

/** YYYY-MM-DD minus N hari (perbandingan string aman karena format ISO). */
export function shiftDayKey(dayKey, deltaDays) {
  const t = Date.parse(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(t)) return '';
  return new Date(t + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Tentukan aksi lifecycle untuk satu event.
 * Return 'done' | 'archive' | null.
 */
export function lifecycleAction({ status, eventDate }, now = new Date()) {
  const day = eventDate ? wibDayKey(eventDate) : '';
  if (!day) return null;
  const today = todayWibKey(now);
  if ((status === 'PLANNING' || status === 'ACTIVE') && day < today) return 'done';
  if (status === 'DONE' && day < shiftDayKey(today, -7)) return 'archive';
  return null;
}
