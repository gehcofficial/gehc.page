/**
 * Status slot penatalayan per role × tanggal (UI + BOD link).
 * Selesai otomatis event end + 6 jam (dihitung saat baca, tanpa cron berat).
 */

export const SLOT_STATUS = {
  KOSONG: 'KOSONG',
  MINTA_DIVISI: 'MINTA_DIVISI',
  DIJADWALKAN: 'DIJADWALKAN',
  DIKONFIRMASI: 'DIKONFIRMASI',
  SELESAI: 'SELESAI',
};

const SIX_H_MS = 6 * 60 * 60 * 1000;

/**
 * @param {Date|string|null|undefined} eventEndAt
 * @returns {number|null}
 */
export function eventEndPlusSixMs(eventEndAt) {
  if (!eventEndAt) return null;
  const d = eventEndAt instanceof Date ? eventEndAt : new Date(eventEndAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime() + SIX_H_MS;
}

/**
 * Status efektif jadwal (termasuk auto-DONE +6h).
 * @param {{ status?: string }} schedule
 * @param {Date|string|null} eventEndAt
 */
export function effectiveScheduleStatus(schedule, eventEndAt) {
  const raw = String(schedule?.status || 'SCHEDULED').toUpperCase();
  if (raw === 'DONE' || raw === 'CANCELLED') return raw;
  const deadline = eventEndPlusSixMs(eventEndAt);
  if (deadline != null && Date.now() >= deadline) return 'DONE';
  return raw;
}

/**
 * @param {{
 *   schedule?: { status?: string; userId?: string }|null;
 *   pendingRequest?: { status?: string }|null;
 *   eventEndAt?: Date|string|null;
 * }}
 */
export function computeSlotStatus({ schedule, pendingRequest, eventEndAt }) {
  if (schedule && String(schedule.userId || '')) {
    const eff = effectiveScheduleStatus(schedule, eventEndAt);
    if (eff === 'DONE') return SLOT_STATUS.SELESAI;
    if (eff === 'CONFIRMED') return SLOT_STATUS.DIKONFIRMASI;
    if (eff === 'SCHEDULED') return SLOT_STATUS.DIJADWALKAN;
  }
  if (pendingRequest && String(pendingRequest.status || '').toUpperCase() === 'PENDING') {
    return SLOT_STATUS.MINTA_DIVISI;
  }
  return SLOT_STATUS.KOSONG;
}

export function slotStatusLabel(code) {
  const map = {
    KOSONG: 'Kosong',
    MINTA_DIVISI: 'Diminta ke divisi',
    DIJADWALKAN: 'Dijadwalkan',
    DIKONFIRMASI: 'Dikonfirmasi',
    SELESAI: 'Selesai',
  };
  return map[String(code || '').toUpperCase()] || code;
}
