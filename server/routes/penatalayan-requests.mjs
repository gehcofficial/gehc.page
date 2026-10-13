/**
 * Penatalayan — antrean request lowongan role ke divisi.
 *
 * POST /api/penatalayan/requests {serviceRoleId, date, eventId?, note?}
 * POST /api/penatalayan/requests/:id/fulfill {userId, timeStart?, timeEnd?, notes?}
 * POST /api/penatalayan/requests/:id/cancel {note?}
 * GET  /api/penatalayan/requests?division=&status=&from=&to=
 *
 * Fulfill = koordinator tunjuk nama → ServiceSchedule SCHEDULED otomatis.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { pushToUsers } from '../lib/notify.mjs';
import { approverUserIdsForService } from '../lib/service-approvers.mjs';
import {
  canTransitionRequest,
  createRequestRow,
  divisionLeadIds,
  getRequest,
  hasActiveSchedule,
  hasPendingRequest,
  listRequests,
  setRequestStatus,
  toDbDate,
} from '../lib/penatalayan-requests.mjs';

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'];
const COORD_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

function ownedRoles(authUser) {
  return (authUser?.roles || []).map((r) => r.role);
}

function isCoord(authUser) {
  return ownedRoles(authUser).some((r) => COORD_ROLES.includes(r));
}

async function isDivisionHeadOf(prisma, userId, division) {
  if (!userId || !division) return false;
  try {
    const row = await prisma.eventDivisionMember.findFirst({
      where: { userId, role: { in: ['LEAD', 'CO_LEAD'] }, division: { division: String(division).toUpperCase() } },
      select: { id: true },
    });
    return !!row;
  } catch {
    return false;
  }
}

async function notifyUsers(prisma, userIds, { title, message, type }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((memberId) => ({
        id: `ntf-${crypto.randomUUID()}`,
        type,
        memberId,
        title: String(title || '').slice(0, 190),
        message: message || null,
        payload: { href: '#/portal', category: 'tugas' },
        category: 'tugas',
        status: 'OPEN',
      })),
    }).catch(() => null);
    await pushToUsers(prisma, ids, { title, message, href: '#/portal', category: 'tugas', priority: 'TASK' }).catch(() => {});
  } catch { /* notifikasi opsional */ }
}

export function registerPenatalayanRequestRoutes(app, { wrap }) {
  // ---------- Antrean request ----------
  app.get('/api/penatalayan/requests', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { division, status, from, to } = req.query || {};
    const rows = await listRequests(prisma, { division, status, from, to });
    const coord = isCoord(req.authUser);
    const headDivs = new Set();
    if (!coord && req.authUser?.id) {
      try {
        const heads = await prisma.eventDivisionMember.findMany({
          where: { userId: req.authUser.id, role: { in: ['LEAD', 'CO_LEAD'] } },
          include: { division: { select: { division: true } } },
          take: 20,
        });
        heads.forEach((h) => h.division?.division && headDivs.add(String(h.division.division).toUpperCase()));
      } catch { /* abaikan */ }
    }
    res.json({
      requests: rows.map((r) => ({
        ...r,
        canFulfill: r.status === 'PENDING' && (coord || headDivs.has(String(r.roleDivision || '').toUpperCase())),
        canCancel: r.status === 'PENDING' && (coord || headDivs.has(String(r.roleDivision || '').toUpperCase()) || r.requesterId === req.authUser?.id),
      })),
    });
  }));

  // ---------- Minta divisi (role wajib yang kosong) ----------
  app.post('/api/penatalayan/requests', requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { serviceRoleId, date, eventId, note } = req.body || {};
    const dateStr = toDbDate(date);
    if (!serviceRoleId || !dateStr) return res.status(400).json({ error: 'serviceRoleId & date (YYYY-MM-DD) wajib.' });
    const role = await prisma.serviceRole.findUnique({ where: { id: String(serviceRoleId) } }).catch(() => null);
    if (!role || role.isActive === false) return res.status(404).json({ error: 'Role tidak ditemukan / nonaktif.' });
    if (role.isRequired === false) return res.status(400).json({ error: 'Role opsional tidak perlu di-request.' });
    if (await hasActiveSchedule(prisma, role.id, dateStr)) {
      return res.status(409).json({ error: 'Role sudah terisi pada tanggal itu.' });
    }
    if (await hasPendingRequest(prisma, role.id, dateStr)) {
      return res.status(409).json({ error: 'Sudah ada request menunggu untuk role & tanggal itu.' });
    }
    const id = `prr-${crypto.randomUUID()}`;
    const created = await createRequestRow(prisma, {
      id,
      serviceRoleId: role.id,
      eventId: eventId ? String(eventId) : null,
      date: dateStr,
      requesterId: req.authUser?.id || 'unknown',
      note: note ? String(note).slice(0, 500) : null,
    });
    let leads = await divisionLeadIds(prisma, { eventId: eventId || null, division: role.division });
    if (!leads.length) {
      try {
        const all = await approverUserIdsForService(prisma);
        leads = (all || []).filter((x) => x && x !== req.authUser?.id);
      } catch { /* abaikan */ }
    }
    await notifyUsers(prisma, leads, {
      type: 'APPROVAL_ITEM',
      title: `Butuh ${role.name} — ${dateStr}`,
      message: `${req.authUser?.name || 'Koordinator'} meminta divisi ${role.division} menyiapkan ${role.name} untuk ${dateStr}${note ? `: ${note}` : ''}.`,
    });
    res.status(201).json({ request: created });
  }));

  // ---------- Penuhi request (tunjuk nama → SCHEDULED otomatis) ----------
  app.post('/api/penatalayan/requests/:id/fulfill', requireRole(...COORD_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const row = await getRequest(prisma, req.params.id);
    if (!row) return res.status(404).json({ error: 'Request tidak ditemukan.' });
    if (row.status !== 'PENDING') return res.status(409).json({ error: `Request sudah ${row.status}.` });
    if (!canTransitionRequest('PENDING', 'FULFILLED')) return res.status(400).json({ error: 'Transisi tidak sah.' });
    const okHead = isCoord(req.authUser) || (await isDivisionHeadOf(prisma, req.authUser?.id, row.roleDivision));
    if (!okHead) return res.status(403).json({ error: 'Hanya koordinator / kepala divisi terkait.' });
    const { userId, timeStart, timeEnd, notes } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId wajib.' });
    const person = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true } }).catch(() => null);
    if (!person) return res.status(404).json({ error: 'Orang tidak ditemukan.' });
    const schedule = await prisma.serviceSchedule.create({
      data: {
        id: `ss-${crypto.randomUUID()}`,
        serviceRoleId: row.serviceRoleId,
        userId: person.id,
        eventId: row.eventId,
        date: new Date(`${row.date}T00:00:00.000Z`),
        timeStart: timeStart ? String(timeStart) : null,
        timeEnd: timeEnd ? String(timeEnd) : null,
        notes: notes ? String(notes).slice(0, 500) : null,
      },
    });
    const done = await setRequestStatus(prisma, row.id, 'FULFILLED', {
      decidedById: req.authUser?.id || null,
      fulfilledScheduleId: schedule.id,
    });
    await notifyUsers(prisma, [row.requesterId, person.id], {
      type: 'ROLE_ASSIGNED',
      title: `${row.roleName} ${row.date} terpenuhi`,
      message: `${req.authUser?.name || 'Koordinator'} menunjuk ${person.id === row.requesterId ? 'Anda' : 'petugas'} untuk ${row.roleName} (${row.date}). Status: Dijadwalkan.`,
    });
    res.json({ request: done, scheduleId: schedule.id });
  }));

  // ---------- Batalkan request ----------
  app.post('/api/penatalayan/requests/:id/cancel', requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const row = await getRequest(prisma, req.params.id);
    if (!row) return res.status(404).json({ error: 'Request tidak ditemukan.' });
    if (row.status !== 'PENDING') return res.status(409).json({ error: `Request sudah ${row.status}.` });
    const mine = row.requesterId && row.requesterId === req.authUser?.id;
    const okHead = isCoord(req.authUser) || (await isDivisionHeadOf(prisma, req.authUser?.id, row.roleDivision));
    if (!mine && !okHead) return res.status(403).json({ error: 'Hanya peminta / koordinator.' });
    const { note } = req.body || {};
    const done = await setRequestStatus(prisma, row.id, 'CANCELLED', { decidedById: req.authUser?.id || null });
    if (row.requesterId !== req.authUser?.id) {
      await notifyUsers(prisma, [row.requesterId], {
        type: 'APPROVAL_ITEM',
        title: `Request ${row.roleName} ${row.date} dibatalkan`,
        message: note ? String(note).slice(0, 300) : 'Request dibatalkan koordinator.',
      });
    }
    res.json({ request: done });
  }));
}
