/**
 * Tanggal efektif sesi mingguan — SATU sumber kebenaran tanggal di alur
 * Didaskalia (katalog → draft → kontrol).
 *
 * Prioritas: `event.eventDate` (sudah termasuk geser, mis. 18 → 17 Okt),
 * fallback tanggal pekan, terakhir yearMonth. Selalu hari kalender WIB agar
 * tidak meleset sehari (instant 02:00Z = 09:00 WIB hari yang sama).
 */

export function wibDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const t = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(t.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(t);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fallback di bawah */
  }
  return null;
}

export function effectiveSessionDay(
  eventDate: string | Date | null | undefined,
  weekDate: string | null | undefined,
  ym: string | null | undefined,
): string {
  return (
    wibDayKey(eventDate) ||
    String(weekDate || '').slice(0, 10) ||
    String(ym || '')
  );
}

/** Slug stem sesi baru: `sesi-<tgl>` (Monolog) atau `sesi-<tgl>-<pola>` agar unik & jelas. */
export function sessionSlugStem(day: string, patternCode: string): string {
  const code = String(patternCode || 'MONOLOG').toUpperCase();
  const suffix = code === 'MONOLOG' ? '' : `-${code.toLowerCase().replace(/_/g, '-')}`;
  return `sesi-${String(day || '').slice(0, 10)}${suffix}`;
}
