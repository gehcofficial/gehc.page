/**
 * Penatalayan — antrean request lowongan role ke divisi.
 *
 * Akses data via $queryRaw/$executeRaw (disengaja): tabel service_role_requests
 * dibuat oleh migrasi raw-SQL, sehingga route tetap jalan baik dengan Prisma
 * client lama (dev) maupun hasil `prisma generate` terbaru (CI/Vercel).
 *
 * Alur: PENDING (dibuat peminta) → FULFILLED (koordinator tunjuk nama →
 * ServiceSchedule SCHEDULED otomatis) | CANCELLED. Final: FULFILLED, CANCELLED.
 */

export const REQUEST_STATUSES = ['PENDING', 'FULFILLED', 'CANCELLED'];

const FINAL_REQUEST_STATUSES = new Set(['FULFILLED', 'CANCELLED']);

/** Transisi status request yang sah. */
export function canTransitionRequest(from, to) {
  if (from === to) return true;
  if (String(from).toUpperCase() === 'PENDING') {
    return to === 'FULFILLED' || to === 'CANCELLED';
  }
  return false;
}

export function isFinalRequestStatus(status) {
  return FINAL_REQUEST_STATUSES.has(String(status || '').toUpperCase());
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalisasi tanggal ke YYYY-MM-DD atau null. */
export function toDbDate(v) {
  const s = String(v || '').slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

function mapRow(r) {
  if (!r) return null;
  const date = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date || '').slice(0, 10);
  return {
    id: r.id,
    serviceRoleId: r.service_role_id,
    eventId: r.event_id || null,
    date,
    requesterId: r.requester_id,
    requesterName: r.requester_name || null,
    proposedUserId: r.proposed_user_id || null,
    proposedUserName: r.proposed_user_name || null,
    batchId: r.batch_id || null,
    note: r.note || null,
    status: r.status,
    fulfilledScheduleId: r.fulfilled_schedule_id || null,
    decidedById: r.decided_by_id || null,
    decidedAt: r.decided_at || null,
    createdAt: r.created_at || null,
    roleName: r.role_name || null,
    roleDivision: r.role_division || null,
  };
}

/** Daftar request + info role (untuk antrean per divisi). Mendukung division CSV, mine, batchId. */
export async function listRequests(prisma, { division, divisions, status = 'PENDING', from, to, limit = 200, requesterId, mine, batchId } = {}) {
  const st = String(status || '').toUpperCase();
  if (st && st !== 'ALL' && !REQUEST_STATUSES.includes(st)) throw new Error('status tidak valid.');
  const divList = [
    ...(divisions ? String(divisions).split(',') : []),
    ...(division ? String(division).split(',') : []),
  ].map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  const div = divList.length === 1 ? divList[0] : null;
  const cap = Math.min(Number(limit) || 200, 500);
  const mineId = mine ? String(mine) : (requesterId ? String(requesterId) : null);
  const batch = batchId ? String(batchId) : null;
  const baseSelect = `
      SELECT q.*, r.name AS role_name, r.division AS role_division, u.name AS requester_name,
        pu.name AS proposed_user_name
      FROM service_role_requests q
      JOIN service_roles r ON r.id = q.service_role_id
      LEFT JOIN users u ON u.id = q.requester_id
      LEFT JOIN users pu ON pu.id = q.proposed_user_id`;
  let rows;
  if (divList.length > 1) {
    rows = await prisma.$queryRawUnsafe(
      `${baseSelect} WHERE r.division IN (${divList.map(() => '?').join(',')})${st !== 'ALL' ? ' AND q.status = ?' : ''}${mineId ? ' AND q.requester_id = ?' : ''}${batch ? ' AND q.batch_id = ?' : ''} ORDER BY q.date ASC, q.created_at ASC LIMIT ${cap}`,
      ...divList,
      ...(st !== 'ALL' ? [st] : []),
      ...(mineId ? [mineId] : []),
      ...(batch ? [batch] : []),
    );
  } else if (st === 'ALL' && !div) {
    rows = await prisma.$queryRaw`
      SELECT q.*, r.name AS role_name, r.division AS role_division, u.name AS requester_name,
        pu.name AS proposed_user_name
      FROM service_role_requests q
      JOIN service_roles r ON r.id = q.service_role_id
      LEFT JOIN users u ON u.id = q.requester_id
      LEFT JOIN users pu ON pu.id = q.proposed_user_id
      ORDER BY q.date ASC, q.created_at ASC
      LIMIT ${cap}`;
  } else if (st === 'ALL') {
    rows = await prisma.$queryRaw`
      SELECT q.*, r.name AS role_name, r.division AS role_division, u.name AS requester_name,
        pu.name AS proposed_user_name
      FROM service_role_requests q
      JOIN service_roles r ON r.id = q.service_role_id
      LEFT JOIN users u ON u.id = q.requester_id
      LEFT JOIN users pu ON pu.id = q.proposed_user_id
      WHERE r.division = ${div}
      ORDER BY q.date ASC, q.created_at ASC
      LIMIT ${cap}`;
  } else if (!div) {
    rows = await prisma.$queryRaw`
      SELECT q.*, r.name AS role_name, r.division AS role_division, u.name AS requester_name,
        pu.name AS proposed_user_name
      FROM service_role_requests q
      JOIN service_roles r ON r.id = q.service_role_id
      LEFT JOIN users u ON u.id = q.requester_id
      LEFT JOIN users pu ON pu.id = q.proposed_user_id
      WHERE q.status = ${st}
      ORDER BY q.date ASC, q.created_at ASC
      LIMIT ${cap}`;
  } else {
    rows = await prisma.$queryRaw`
      SELECT q.*, r.name AS role_name, r.division AS role_division, u.name AS requester_name,
        pu.name AS proposed_user_name
      FROM service_role_requests q
      JOIN service_roles r ON r.id = q.service_role_id
      LEFT JOIN users u ON u.id = q.requester_id
      LEFT JOIN users pu ON pu.id = q.proposed_user_id
      WHERE r.division = ${div} AND q.status = ${st}
      ORDER BY q.date ASC, q.created_at ASC
      LIMIT ${cap}`;
  }
  const fromD = toDbDate(from);
  const toD = toDbDate(to);
  return (Array.isArray(rows) ? rows : [])
    .map(mapRow)
    .filter((r) => r && (!fromD || r.date >= fromD) && (!toD || r.date <= toD)
      && (!mineId || r.requesterId === mineId) && (!batch || r.batchId === batch));
}

/** Satu request + info role. */
export async function getRequest(prisma, id) {
  const rows = await prisma.$queryRaw`
    SELECT q.*, r.name AS role_name, r.division AS role_division,
      pu.name AS proposed_user_name
    FROM service_role_requests q
    JOIN service_roles r ON r.id = q.service_role_id
    LEFT JOIN users pu ON pu.id = q.proposed_user_id
    WHERE q.id = ${String(id)}
    LIMIT 1`;
  return mapRow(Array.isArray(rows) ? rows[0] : null);
}

/** Ada jadwal aktif (bukan CANCELLED) untuk role+tanggal? */
export async function hasActiveSchedule(prisma, serviceRoleId, dateStr) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM service_schedules
    WHERE service_role_id = ${String(serviceRoleId)} AND date = ${dateStr} AND status <> 'CANCELLED'
    LIMIT 1`;
  return Array.isArray(rows) && rows.length > 0;
}

/** Ada request PENDING untuk role+tanggal? */
export async function hasPendingRequest(prisma, serviceRoleId, dateStr) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM service_role_requests
    WHERE service_role_id = ${String(serviceRoleId)} AND date = ${dateStr} AND status = 'PENDING'
    LIMIT 1`;
  return Array.isArray(rows) && rows.length > 0;
}

/** Ada request PENDING untuk role+tanggal+orang usulan? (dedupe usulan multi-people). */
export async function hasPendingProposalForUser(prisma, serviceRoleId, dateStr, proposedUserId) {
  if (!proposedUserId) return hasPendingRequest(prisma, serviceRoleId, dateStr);
  try {
    const rows = await prisma.$queryRaw`
      SELECT id FROM service_role_requests
      WHERE service_role_id = ${String(serviceRoleId)} AND date = ${dateStr}
        AND proposed_user_id = ${String(proposedUserId)} AND status = 'PENDING'
      LIMIT 1`;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    // Kolom belum ada (migrasi belum jalan) -> fallback cek kasar.
    return hasPendingRequest(prisma, serviceRoleId, dateStr);
  }
}

/** Ada jadwal aktif (bukan CANCELLED) untuk role+tanggal+orang? */
export async function hasActiveScheduleForUser(prisma, serviceRoleId, dateStr, userId) {
  const rows = await prisma.$queryRaw`
    SELECT id FROM service_schedules
    WHERE service_role_id = ${String(serviceRoleId)} AND date = ${dateStr}
      AND user_id = ${String(userId)} AND status <> 'CANCELLED'
    LIMIT 1`;
  return Array.isArray(rows) && rows.length > 0;
}

export async function createRequestRow(prisma, { id, serviceRoleId, eventId, date, requesterId, note, proposedUserId, batchId }) {
  try {
    await prisma.$executeRaw`
      INSERT INTO service_role_requests (id, service_role_id, event_id, date, requester_id, note, status, proposed_user_id, batch_id)
      VALUES (${id}, ${String(serviceRoleId)}, ${eventId || null}, ${date}, ${String(requesterId)}, ${note || null}, 'PENDING', ${proposedUserId ? String(proposedUserId) : null}, ${batchId ? String(batchId) : null})`;
  } catch {
    // Fallback DB lama tanpa kolom usulan.
    await prisma.$executeRaw`
      INSERT INTO service_role_requests (id, service_role_id, event_id, date, requester_id, note, status)
      VALUES (${id}, ${String(serviceRoleId)}, ${eventId || null}, ${date}, ${String(requesterId)}, ${note || null}, 'PENDING')`;
  }
  return getRequest(prisma, id);
}

export async function setRequestStatus(prisma, id, status, { decidedById, fulfilledScheduleId } = {}) {
  await prisma.$executeRaw`
    UPDATE service_role_requests
    SET status = ${String(status).toUpperCase()},
        decided_by_id = ${decidedById || null},
        fulfilled_schedule_id = ${fulfilledScheduleId || null},
        decided_at = CURRENT_TIMESTAMP(3)
    WHERE id = ${String(id)}`;
  return getRequest(prisma, id);
}

/**
 * userId koordinator divisi: LEAD/CO_LEAD pada event+divisi itu bila ada,
 * else LEAD/CO_LEAD mana pun di divisi itu, else [] (pemanggil fallback approver).
 */
export async function divisionLeadIds(prisma, { eventId, division }) {
  const div = String(division || '').toUpperCase();
  if (!div) return [];
  try {
    if (eventId) {
      const rows = await prisma.$queryRaw`
        SELECT m.user_id AS userId FROM event_division_members m
        JOIN event_divisions d ON d.id = m.event_division_id
        WHERE d.event_id = ${String(eventId)} AND d.division = ${div} AND m.role IN ('LEAD','CO_LEAD')
        LIMIT 20`;
      const ids = [...new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId).filter(Boolean))];
      if (ids.length) return ids;
    }
    const rows = await prisma.$queryRaw`
      SELECT m.user_id AS userId FROM event_division_members m
      JOIN event_divisions d ON d.id = m.event_division_id
      WHERE d.division = ${div} AND m.role IN ('LEAD','CO_LEAD')
      LIMIT 20`;
    return [...new Set((Array.isArray(rows) ? rows : []).map((r) => r.userId).filter(Boolean))];
  } catch {
    return [];
  }
}
