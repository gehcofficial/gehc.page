/**
 * Aturan upload foto jemaat (galeri acara):
 * - jendela H-1..H+7 dari tanggal event,
 * - maks 5 foto/orang/event, maks 8MB/foto.
 */

export const JEMAAT_PHOTO_MAX_PER_USER = 5;
export const JEMAAT_PHOTO_MAX_BYTES = 8_000_000;
/** Batas mentah sebelum kompres otomatis (HEIC/JPG HP) — hasil akhir dikecilkan ke ~900KB. */
export const JEMAAT_PHOTO_RAW_MAX_BYTES = 15 * 1024 * 1024;
/** Batas base64 string sebelum decode (15MB biner ≈ 20MB base64). */
export const JEMAAT_PHOTO_RAW_MAX_BASE64 = 20_000_000;
export const JEMAAT_UPLOAD_WINDOW = { beforeDays: 1, afterDays: 7 };

/** Dalam jendela H-1..H+7? Tanpa tanggal event → boleh (diatur call-site). */
export function isWithinUploadWindow(eventDate, nowMs = Date.now()) {
  if (!eventDate) return true;
  const day = new Date(eventDate).getTime();
  if (!Number.isFinite(day)) return true;
  return nowMs >= day - JEMAAT_UPLOAD_WINDOW.beforeDays * 86400000
    && nowMs <= day + JEMAAT_UPLOAD_WINDOW.afterDays * 86400000;
}

/** Sisa kuota upload orang ini (0 bila habis). */
export function remainingQuota(uploadedCount) {
  return Math.max(0, JEMAAT_PHOTO_MAX_PER_USER - (Number(uploadedCount) || 0));
}
