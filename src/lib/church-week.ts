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

/** Satu baris override pekan (bentuk respons GET /api/service-overrides). */
export type WeekOverride = {
  eventDate?: string | null;
  newEventDate?: string | null;
  condition?: string | null;
};

const dayOnly = (v: unknown): string => {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/**
 * Balikkan tanggal TARGET geser ke tanggal asalnya (17 Okt → 18 Okt).
 * Kebalikan `effectiveDate` server: materi (ringkasan khotbah + RHB) selalu
 * ikut origin week, bukan minggu kalender tanggal baru.
 */
export function originDateForEvent(dayIso: string, overrides?: WeekOverride[] | null): string {
  const base = dayOnly(dayIso);
  if (!base || !Array.isArray(overrides)) return base;
  for (const ov of overrides) {
    const origin = dayOnly(ov?.eventDate);
    if (String(ov?.condition || '').toUpperCase() === 'GESER'
      && dayOnly(ov?.newEventDate) === base
      && origin && origin !== base) return origin;
  }
  return base;
}

/**
 * {ym, weekIndex} untuk tanggal event — menghormati GESER.
 * Event geseran 18→17 Okt me-resolve ke 2026-10/W3 (bukan W2).
 */
export function weekForEventDate(
  iso?: string | Date | null,
  overrides?: WeekOverride[] | null,
): { ym: string; weekIndex: number } {
  const day = dayOnly(iso instanceof Date ? iso.toISOString() : iso);
  if (!day) return { ym: '', weekIndex: 1 };
  const origin = originDateForEvent(day, overrides) || day;
  // Pertahankan komponen jam untuk yearMonthWib (batas bulan WIB).
  const withTime = iso instanceof Date ? iso.toISOString() : String(iso || '');
  const probe = /T/.test(withTime) ? origin + withTime.slice(10) : origin;
  return { ym: yearMonthWib(probe), weekIndex: weekIndexForDateWib(probe) };
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
