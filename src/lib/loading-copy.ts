/**
 * Kontrak waktu standar loading global GEHC.page (anti-flash & anti-bosan):
 * - overlay baru muncul setelah APPEAR_DELAY_MS (fetch cepat tak berkedip),
 * - mode playful (pesan bergilir) setelah FUN_DELAY_MS,
 * - spinner abadi dilarang — pemanggil wajib timeout + retry.
 */

export const LOADING_APPEAR_DELAY_MS = 300;
export const LOADING_FUN_DELAY_MS = 3000;
export const LOADING_MESSAGE_ROTATE_MS = 2500;
export const LOADING_DEFAULT_TIMEOUT_MS = 20000;

/** Overlay boleh tampil? */
export function shouldShowOverlay(elapsedMs: number): boolean {
  return elapsedMs >= LOADING_APPEAR_DELAY_MS;
}

/** Mode pesan playful aktif? */
export function isFunMode(elapsedMs: number): boolean {
  return elapsedMs >= LOADING_FUN_DELAY_MS;
}

/** Sudah melewati batas tunggu? */
export function isTimedOut(elapsedMs: number, timeoutMs: number = LOADING_DEFAULT_TIMEOUT_MS): boolean {
  return elapsedMs >= timeoutMs;
}

/** Indeks pesan berikutnya (berputar). */
export function nextMessageIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}
