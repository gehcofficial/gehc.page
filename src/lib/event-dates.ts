/** Zona WIB (tanpa dependensi tanggal browser). */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kunci hari YYYY-MM-DD dalam WIB untuk sebuah instant. */
export function wibDayKey(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Kunci hari WIB hari ini (dapat di-override `now` untuk test). */
export function todayWibKey(now: Date = new Date()): string {
  return wibDayKey(now);
}

export type EventDayState = 'today' | 'past' | 'future' | 'unknown';

/**
 * Status hari-H sebuah event dari ISO tanggal (eventDate / event_date).
 * - today: tanggal WIB sama dengan hari ini → "Berlangsung hari ini!"
 * - past: sudah lewat → kartu disembunyikan (DONE)
 * - future: countdown "Akan Datang"
 */
export function eventDayState(iso: string | null | undefined, now: Date = new Date()): EventDayState {
  if (!iso) return 'unknown';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const day = wibDayKey(new Date(t));
  const today = todayWibKey(now);
  if (day === today) return 'today';
  return day < today ? 'past' : 'future';
}
