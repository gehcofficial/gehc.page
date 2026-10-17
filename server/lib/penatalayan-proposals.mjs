/**
 * Usulan penatalayan Mentor/Co-mentor (multi-role x multi-people).
 * Murni (tanpa DB) agar mudah diuji — validasi DB (scope binaan, jadwal
 * aktif) tetap di route via mentor-assign + penatalayan-requests.
 *
 * Kontrak: POST /api/penatalayan/proposals/bulk
 *   { date: 'YYYY-MM-DD', eventId?, items: [{ serviceRoleId, userId, note? }] }
 */

export const MAX_PROPOSAL_ITEMS = 50;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kunci dedupe: role + orang + tanggal. */
export const proposalRowKey = (serviceRoleId, userId, date) =>
  `${String(serviceRoleId)}|${String(userId)}|${String(date).slice(0, 10)}`;

/**
 * Normalisasi + validasi ringan body usulan.
 * @returns {{ ok: boolean, date?: string, eventId?: string|null, rows: Array, errors: string[] }}
 */
export function normalizeProposalItems(body = {}) {
  const errors = [];
  const dateStr = String(body.date || body.serviceDate || '').slice(0, 10);
  if (!DATE_RE.test(dateStr)) errors.push('Tanggal tidak valid (YYYY-MM-DD).');
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) errors.push('Minimal 1 usulan (role x orang).');
  if (items.length > MAX_PROPOSAL_ITEMS) {
    return { ok: false, rows: [], errors: [`Terlalu banyak: ${items.length} usulan. Maksimal ${MAX_PROPOSAL_ITEMS} sekali kirim.`] };
  }
  const seen = new Set();
  const rows = [];
  for (const [i, it] of items.entries()) {
    const serviceRoleId = String(it?.serviceRoleId || '').trim();
    const userId = String(it?.userId || it?.proposedUserId || '').trim();
    if (!serviceRoleId || !userId) {
      errors.push(`Baris ${i + 1}: serviceRoleId & userId wajib.`);
      continue;
    }
    const key = proposalRowKey(serviceRoleId, userId, dateStr);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      serviceRoleId,
      userId,
      note: it?.note ? String(it.note).slice(0, 500) : null,
    });
  }
  if (!rows.length && !errors.length) errors.push('Tidak ada usulan valid.');
  return {
    ok: errors.length === 0,
    date: dateStr,
    eventId: body.eventId ? String(body.eventId) : null,
    rows,
    errors,
  };
}
