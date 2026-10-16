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

/**
 * Pisahkan judul konten "Tema - 17 Okt 2026" menjadi { theme, dateSuffix }.
 * Tanggal di judul bikin wrap gantung ("17" sendirian), jadi tema (h3)
 * dan tanggal (baris 2) dirender terpisah. Tanpa cocok → dateSuffix null.
 */
export function splitThemeDate(title: string | null | undefined): { theme: string; dateSuffix: string | null } {
  const raw = String(title || '').trim();
  if (!raw) return { theme: '', dateSuffix: null };
  // Pola umum CMS: "Tema - 17 Okt 2026" / "Tema — 17 Oktober 2026" / "Tema: 17 Okt 2026"
  const m = raw.match(/^(.*?)\s*[—–\-:|·]\s*(\d{1,2}\s+[A-Za-z\u00C0-\u024F]{3,9}\s+\d{4})\s*$/);
  if (m) {
    const theme = String(m[1] || '').trim();
    const dateSuffix = String(m[2] || '').trim();
    if (theme) return { theme, dateSuffix };
  }
  return { theme: raw, dateSuffix: null };
}

/** Jam WIB saja ("Pukul 16.00 WIB") — dipakai saat tanggal sudah tampil di baris judul. */
export function fmtTimeWib(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).replace(':', '.');
  return `Pukul ${time} WIB`;
}
