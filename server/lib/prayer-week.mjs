/**
 * Bantu Doa Minggu (WIB, Senin–Minggu).
 * Semua perbandingan memakai kunci hari YYYY-MM-DD agar batas tengah malam
 * benar (UTC bisa salah sehari pada 00–07 WIB).
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 86400000;

/** Kunci hari WIB (YYYY-MM-DD) dari Date/ISO. */
export function wibDayKey(value = new Date()) {
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (Number.isNaN(t)) return '';
  return new Date(t + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parse input `YYYY-MM-DD` → Date UTC tengah malam, atau null. */
export function parseDayInput(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Minggu terdekat (termasuk hari ini bila Minggu) dari kunci hari WIB. */
export function upcomingSunday(now = new Date()) {
  const today = wibDayKey(now);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(t)) return today;
  const dow = new Date(t).getUTCDay(); // 0 = Minggu
  const delta = dow === 0 ? 0 : 7 - dow;
  return new Date(t + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Senin dari minggu yang memuat kunci hari. */
export function mondayOf(day) {
  const t = Date.parse(`${String(day)}T00:00:00Z`);
  if (Number.isNaN(t)) return String(day || '');
  const dow = new Date(t).getUTCDay();
  return new Date(t + (dow === 0 ? -6 : 1 - dow) * DAY_MS).toISOString().slice(0, 10);
}

/** Rentang hari (inklusif) Minggu ibadah: Senin s/d Minggu. */
export function weekRange(sunday) {
  const monday = mondayOf(sunday);
  return {
    monday,
    sunday,
    start: new Date(`${monday}T00:00:00.000Z`),
    end: new Date(`${sunday}T00:00:00.000Z`),
  };
}

/**
 * Tandai catatan yang sudah didoakan pada minggu tsb + hitung statistik.
 * notes: [{ id }]; logs: [{ noteId, prayedOn }]
 */
export function decoratePrayerWeek(notes, logs) {
  const prayedSet = new Set((logs || []).map((l) => l.noteId));
  const decorated = (notes || []).map((n) => ({ ...n, prayedThisWeek: prayedSet.has(n.id) }));
  const prayed = decorated.filter((n) => n.prayedThisWeek).length;
  return {
    notes: decorated,
    stats: { total: decorated.length, prayed, notPrayed: decorated.length - prayed },
  };
}

/** Selisih hari pencatatan vs tanggal kejadian (0 bila tidak terlambat). */
export function lateRecordedDays(occurredOn, createdAt) {
  const a = String(occurredOn || '').slice(0, 10);
  const b = String(createdAt || '').slice(0, 10);
  if (!a || !b) return 0;
  const diff = Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}
