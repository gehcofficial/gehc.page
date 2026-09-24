/**
 * Siklus status penatalayan (ServiceSchedule) — satu sumber kebenaran.
 *
 * Aturan (keputusan pemilik):
 *  - Alur: SCHEDULED → CONFIRMED → DONE. DONE = final (terkunci).
 *  - Petugas boleh: konfirmasi (SCHEDULED→CONFIRMED) & kembalikan (CONFIRMED→SCHEDULED).
 *  - Koordinator (Komisi/Committee/BOD/SUPERADMIN) boleh semua transisi, termasuk Batalkan.
 *  - DONE hanya koordinator + perlu konfirmasi akhir; hanya SUPERADMIN dapat membuka DONE.
 */

export const SERVICE_STATUSES = ['SCHEDULED', 'CONFIRMED', 'DONE', 'CANCELLED'];

const TRANSITIONS = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DONE', 'SCHEDULED', 'CANCELLED'],
  CANCELLED: ['SCHEDULED'],
  DONE: [],
};

export function isTerminal(status) {
  return String(status).toUpperCase() === 'DONE';
}

export function canTransition(from, to) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  if (f === t) return true;
  return (TRANSITIONS[f] || []).includes(t);
}

/**
 * Boleh tidak aktor melakukan transisi ini?
 * @returns {{ ok: boolean; reason?: string; override?: boolean }}
 */
export function canActorTransition(from, to, { isCoordinator = false, isSuperadmin = false } = {}) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  if (!SERVICE_STATUSES.includes(t)) return { ok: false, reason: 'Status tidak valid.' };
  if (f === t) return { ok: true };
  if (f === 'DONE') {
    if (isSuperadmin) return { ok: true, override: true };
    return { ok: false, reason: 'Sudah selesai (final) — tidak dapat diubah.' };
  }
  if (!canTransition(f, t)) return { ok: false, reason: `Transisi ${f} → ${t} tidak diizinkan.` };
  if (t === 'DONE' && !isCoordinator) return { ok: false, reason: 'Hanya koordinator yang dapat menandai Selesai.' };
  if (t === 'CANCELLED' && !isCoordinator) return { ok: false, reason: 'Hanya koordinator yang dapat membatalkan.' };
  if (f === 'CANCELLED' && !isCoordinator) return { ok: false, reason: 'Hanya koordinator yang dapat mengembalikan dari Batal.' };
  return { ok: true };
}

/** Patch audit yang harus ditulis bersama perubahan status. */
export function auditPatch(from, to, userId) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  const now = new Date();
  const patch = {};
  if (t === 'CONFIRMED' && f !== 'CONFIRMED') { patch.confirmedAt = now; patch.confirmedById = userId || null; }
  if (t === 'DONE' && f !== 'DONE') { patch.doneAt = now; patch.doneById = userId || null; }
  if (f === 'CONFIRMED' && t === 'SCHEDULED') { patch.confirmedAt = null; patch.confirmedById = null; }
  if (f === 'DONE' && t !== 'DONE') { patch.doneAt = null; patch.doneById = null; }
  return patch;
}

export function isCoordinatorUser(authUser) {
  const roles = (authUser?.roles || []).map((r) => r.role);
  return roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE');
}

export function isSuperadminUser(authUser) {
  return (authUser?.roles || []).map((r) => r.role).includes('SUPERADMIN');
}
