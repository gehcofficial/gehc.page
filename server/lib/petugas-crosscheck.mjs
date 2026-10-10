/**
 * Crosscheck penatalayan H-1 / H-day (Koinonia) — murni & teruji.
 *
 * - Pencocokan jadwal → event: eventId sama, ATAU eventId null + tanggal
 *   WIB sama (tugas mingguan). TAMPILAN boleh seluas ini; auto-mark
 *   kehadiran (petugas-attendance) tetap ketat butuh eventId.
 * - H-1 = kesiapan konfirmasi (CONFIRMED/SCHEDULED/CANCELLED); H-day =
 *   kehadiran (checkedInAt + sumber scan/otomatis/manual).
 */

const up = (s) => String(s || '').toUpperCase();

/** 'YYYY-MM-DD' WIB dari Date/ISO/epoch; null bila tak valid. */
export function wibDayKey(input) {
  try {
    if (input === null || input === undefined || input === '') return null;
    const t = input instanceof Date ? input.getTime() : new Date(input).getTime();
    if (!Number.isFinite(t)) return null;
    return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Jadwal cocok untuk crosscheck event bila eventId sama, atau eventId null
 * dan tanggal WIB-nya sama dengan tanggal event.
 */
export function scheduleMatchesEvent(event, s) {
  if (!event?.id || !s) return false;
  if (s.eventId && String(s.eventId) === String(event.id)) return true;
  if ((s.eventId === null || s.eventId === undefined) && event.eventDate) {
    const a = wibDayKey(s.date);
    const b = wibDayKey(event.eventDate);
    return Boolean(a && b && a === b);
  }
  return false;
}

/**
 * Ringkas baris petugas [{ status, present, source, division, ... }].
 * missing = butuh konfirmasi (SCHEDULED, bukan CANCELLED/DONE).
 */
export function summarizePetugas(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byStatus = (st) => list.filter((r) => up(r.status) === st);
  const missing = list.filter((r) => up(r.status) === 'SCHEDULED');
  const byDivision = {};
  for (const r of list) {
    const d = up(r.division) || 'LAINNYA';
    byDivision[d] = byDivision[d] || { total: 0, confirmed: 0, present: 0 };
    byDivision[d].total += 1;
    if (up(r.status) === 'CONFIRMED') byDivision[d].confirmed += 1;
    if (r.present) byDivision[d].present += 1;
  }
  return {
    total: list.length,
    confirmed: byStatus('CONFIRMED').length,
    scheduled: byStatus('SCHEDULED').length,
    cancelled: byStatus('CANCELLED').length,
    done: byStatus('DONE').length,
    present: list.filter((r) => r.present).length,
    missing: missing.map((r) => ({
      scheduleId: r.scheduleId || null,
      userId: r.userId || null,
      name: r.name || 'Petugas',
      role: r.role || null,
      division: r.division || null,
    })),
    byDivision,
  };
}
