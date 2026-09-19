/**
 * Tugas penatalayan (ServiceSchedule) — pengelompokan & aturan tampil publik.
 *
 * Privasi: tugas baru boleh tampil di halaman publik bila petugasnya sudah
 * MENYETUJUI, yaitu status CONFIRMED atau DONE (bukan SCHEDULED).
 */

export const PUBLIC_DUTY_STATUSES = ['CONFIRMED', 'DONE'];

export const DUTY_STATUS_LABEL = {
  SCHEDULED: 'Dijadwalkan',
  CONFIRMED: 'Dikonfirmasi',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export function isPublicDuty(row) {
  return PUBLIC_DUTY_STATUSES.includes(String(row?.status || '').toUpperCase());
}

export function filterPublicDuties(rows) {
  return (rows || []).filter(isPublicDuty);
}

export function dayKeyOf(value) {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Kelompokkan tugas per tanggal.
 * rows: [{ date, status, timeStart, timeEnd, serviceRole:{name,division}, user:{name} }]
 * @returns {Record<string, Array<{ role:string, division:string, name:string, timeStart:string|null, timeEnd:string|null, status:string }>>}
 */
export function groupDutiesByDay(rows) {
  const out = {};
  for (const r of rows || []) {
    const day = dayKeyOf(r?.date);
    if (!day) continue;
    const list = out[day] || (out[day] = []);
    list.push({
      role: r?.serviceRole?.name || 'Petugas',
      division: String(r?.serviceRole?.division || '').toUpperCase(),
      name: r?.user?.name || '—',
      timeStart: r?.timeStart || null,
      timeEnd: r?.timeEnd || null,
      status: String(r?.status || 'SCHEDULED').toUpperCase(),
    });
  }
  for (const day of Object.keys(out)) {
    out[day].sort((a, b) => String(a.timeStart || '').localeCompare(String(b.timeStart || '')) || a.role.localeCompare(b.role, 'id'));
  }
  return out;
}
