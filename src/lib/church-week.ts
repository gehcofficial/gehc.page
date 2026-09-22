/** Utilitas minggu gerejawi (Minggu sebagai awal minggu) — dipakai panel divisi & Studio. */

/** Daftar tanggal Minggu dalam bulan `YYYY-MM` (UTC). */
export function sundaysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === m - 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** `YYYY-MM` untuk tanggal ISO dalam zona WIB (UTC+7). */
export function yearMonthWib(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Baris minggu ke-N (1-based) pada grid bulanan yang memuat tanggal ini (WIB).
 * Aturan sama dengan `weekIndexForDate` di server (tanggal sebelum Minggu
 * pertama tetap masuk baris 1).
 */
export function weekIndexForDateWib(iso?: string | null): number {
  const ym = yearMonthWib(iso);
  if (!ym) return 1;
  const d = new Date(iso as string);
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  const dayIso = wib.toISOString().slice(0, 10);
  const sundays = sundaysInMonth(ym);
  let index = 1;
  for (let i = 0; i < sundays.length; i += 1) {
    if (dayIso >= sundays[i]) index = i + 1;
  }
  return Math.min(index, sundays.length || 1);
}
