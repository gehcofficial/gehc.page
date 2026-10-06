/** Pemilihan event default: minggu berjalan, bukan yang terbaru. */

export type SelectableEvent = {
  id: string;
  status?: string | null;
  eventDate?: string | null;
  startDate?: string | null;
};

/**
 * Event minggu berjalan: non-arsip terdekat ≥ hari ini (toleransi −12 jam,
 * agar H-day sore masih kepilih); bila semua lewat, yang terbaru lewat;
 * fallback non-arsip pertama.
 */
export function nearestUpcoming<T extends SelectableEvent>(list: T[], nowMs = Date.now()): T | null {
  const open = (list || []).filter((e) => String(e.status || '').toUpperCase() !== 'ARCHIVED');
  if (!open.length) return list[0] || null;
  const now = nowMs - 12 * 3600 * 1000;
  const withTime = open
    .map((e) => ({ e, t: new Date(String(e.eventDate || e.startDate || '')).getTime() }))
    .filter((x) => Number.isFinite(x.t));
  const upcoming = withTime.filter((x) => x.t >= now).sort((a, b) => a.t - b.t);
  if (upcoming.length) return upcoming[0].e;
  if (withTime.length) return [...withTime].sort((a, b) => b.t - a.t)[0].e;
  return open[0] || null;
}
