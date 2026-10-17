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
import { resolveWorshipEventByDate } from '../lib/service-events.mjs';
import { approverUserIdsForService } from '../lib/service-approvers.mjs';
import {
  canTransitionRequest,
  createRequestRow,
  divisionLeadIds,
  getRequest,
  hasActiveSchedule,
  hasActiveScheduleForUser,
  hasPendingProposalForUser,
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
    const { division, divisions, status, from, to, mine, batchId, requesterId } = req.query || {};
    const mineId = String(mine || '') === '1' ? req.authUser?.id : (requesterId ? String(requesterId) : undefined);
    const rows = await listRequests(prisma, { division, divisions, status, from, to, requesterId: mineId, batchId });
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

  // ---------- Minta divisi (role wajib yang kosong / usulan nama mentor) ----------
  app.post('/api/penatalayan/requests', requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { serviceRoleId, date, eventId, note, proposedUserId } = req.body || {};
    const dateStr = toDbDate(date);
    if (!serviceRoleId || !dateStr) return res.status(400).json({ error: 'serviceRoleId & date (YYYY-MM-DD) wajib.' });
    const role = await prisma.serviceRole.findUnique({ where: { id: String(serviceRoleId) } }).catch(() => null);
    if (!role || role.isActive === false) return res.status(404).json({ error: 'Role tidak ditemukan / nonaktif.' });
    const proposed = proposedUserId ? String(proposedUserId) : null;
    if (!proposed && role.isRequired === false) return res.status(400).json({ error: 'Role opsional tidak perlu di-request.' });
    // Jalur mentor dengan nama usulan: scope binaan + komponen UNIT.
    if (proposed) {
      if (String(role.scope || 'UNIT').toUpperCase() !== 'UNIT') {
        const { isScopedMentor } = await import('../lib/mentor-assign.mjs');
        if (isScopedMentor(req.authUser)) return res.status(403).json({ error: 'Mentor hanya mengusulkan komponen unit pemuda.' });
      }
      const { isScopedMentor, assertMentorAssignScope } = await import('../lib/mentor-assign.mjs');
      if (isScopedMentor(req.authUser)) {
        try { await assertMentorAssignScope(prisma, req.authUser, [proposed]); }
        catch (e) { return res.status(e.status || 403).json({ error: e.message }); }
      }
      const person = await prisma.user.findUnique({ where: { id: proposed }, select: { id: true } }).catch(() => null);
      if (!person) return res.status(404).json({ error: 'Orang usulan tidak ditemukan.' });
      if (await hasActiveScheduleForUser(prisma, role.id, dateStr, proposed)) {
        return res.status(409).json({ error: 'Orang itu sudah terjadwal pada role & tanggal itu.' });
      }
      if (await hasPendingProposalForUser(prisma, role.id, dateStr, proposed)) {
        return res.status(409).json({ error: 'Usulan yang sama masih menunggu.' });
      }
    } else {
      if (await hasActiveSchedule(prisma, role.id, dateStr)) {
        return res.status(409).json({ error: 'Role sudah terisi pada tanggal itu.' });
      }
      if (await hasPendingRequest(prisma, role.id, dateStr)) {
        return res.status(409).json({ error: 'Sudah ada request menunggu untuk role & tanggal itu.' });
      }
    }
    const effectiveEventId = eventId ? String(eventId) : await resolveWorshipEventByDate(prisma, dateStr).catch(() => null);
    const id = `prr-${crypto.randomUUID()}`;
    const created = await createRequestRow(prisma, {
      id,
      serviceRoleId: role.id,
      eventId: effectiveEventId,
      date: dateStr,
      requesterId: req.authUser?.id || 'unknown',
      note: note ? String(note).slice(0, 500) : null,
      proposedUserId: proposed,
    });
    let leads = await divisionLeadIds(prisma, { eventId: effectiveEventId, division: role.division });
    if (!leads.length) {
      try {
        const all = await approverUserIdsForService(prisma);
        leads = (all || []).filter((x) => x && x !== req.authUser?.id);
      } catch { /* abaikan */ }
    }
    await notifyUsers(prisma, leads, {
      type: 'APPROVAL_ITEM',
      title: proposed ? `Usulan ${role.name} — ${dateStr}` : `Butuh ${role.name} — ${dateStr}`,
      message: proposed
        ? `${req.authUser?.name || 'Mentor'} mengusulkan petugas untuk ${role.name} (${role.division}) pada ${dateStr}${note ? `: ${note}` : ''}.`
        : `${req.authUser?.name || 'Koordinator'} meminta divisi ${role.division} menyiapkan ${role.name} untuk ${dateStr}${note ? `: ${note}` : ''}.`,
    });
    res.status(201).json({ request: created });
  }));

  // ---------- Usulan bulk mentor (multi-role x multi-people, 1 tanggal) ----------
  // Body: { date, eventId?, items: [{ serviceRoleId, userId, note? }] }
  // Hasil per-item (best standard): created / skipped (exists/outOfScope) — tidak all-or-nothing.
  app.post('/api/penatalayan/proposals/bulk', requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { normalizeProposalItems, MAX_PROPOSAL_ITEMS } = await import('../lib/penatalayan-proposals.mjs');
    const norm = normalizeProposalItems(req.body || {});
    if (!norm.ok) return res.status(400).json({ error: norm.errors[0], errors: norm.errors });
    const { date: dateStr, eventId, rows } = norm;
    const effectiveEventId = eventId ? String(eventId) : await resolveWorshipEventByDate(prisma, dateStr).catch(() => null);
    const roleIds = [...new Set(rows.map((r) => r.serviceRoleId))];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const [roles, users] = await Promise.all([
      prisma.serviceRole.findMany({ where: { id: { in: roleIds } } }).catch(() => []),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } }).catch(() => []),
    ]);
    const roleById = new Map((roles || []).map((r) => [String(r.id), r]));
    const validUsers = new Set((users || []).map((u) => String(u.id)));
    const { isScopedMentor, assertMentorAssignScope } = await import('../lib/mentor-assign.mjs');
    const scoped = isScopedMentor(req.authUser);
    if (scoped) {
      const nonUnit = (roles || []).find((r) => String(r.scope || 'UNIT').toUpperCase() !== 'UNIT');
      if (nonUnit) return res.status(403).json({ error: 'Mentor hanya mengusulkan komponen unit pemuda.' });
      try { await assertMentorAssignScope(prisma, req.authUser, userIds); }
      catch (e) { return res.status(e.status || 403).json({ error: e.message }); }
    }
    const batchId = `pb-${crypto.randomUUID()}`;
    const created = [];
    const skipped = [];
    const notifyDivisions = new Set();
    for (const row of rows) {
      const role = roleById.get(String(row.serviceRoleId));
      if (!role || role.isActive === false) { skipped.push({ ...row, reason: 'Role tidak ditemukan / nonaktif.' }); continue; }
      if (!validUsers.has(String(row.userId))) { skipped.push({ ...row, reason: 'Orang tidak ditemukan.' }); continue; }
      if (await hasActiveScheduleForUser(prisma, role.id, dateStr, row.userId)) { skipped.push({ ...row, reason: 'Sudah terjadwal.' }); continue; }
      if (await hasPendingProposalForUser(prisma, role.id, dateStr, row.userId)) { skipped.push({ ...row, reason: 'Usulan sama masih menunggu.' }); continue; }
      const id = `prr-${crypto.randomUUID()}`;
      const rec = await createRequestRow(prisma, {
        id, serviceRoleId: role.id, eventId: effectiveEventId, date: dateStr,
        requesterId: req.authUser?.id || 'unknown', note: row.note,
        proposedUserId: row.userId, batchId,
      });
      created.push(rec);
      if (role.division) notifyDivisions.add(String(role.division).toUpperCase());
    }
    try {
      const leadLists = await Promise.all([...notifyDivisions].map((d) => divisionLeadIds(prisma, { eventId: effectiveEventId, division: d }).catch(() => [])));
      let leads = [...new Set(leadLists.flat())].filter((x) => x && x !== req.authUser?.id);
      if (!leads.length) {
        try {
          const all = await approverUserIdsForService(prisma);
          leads = (all || []).filter((x) => x && x !== req.authUser?.id);
        } catch { /* abaikan */ }
      }
      await notifyUsers(prisma, leads, {
        type: 'APPROVAL_ITEM',
        title: `Usulan penatalayan (${created.length}) — ${dateStr}`,
        message: `${req.authUser?.name || 'Mentor'} mengusulkan ${created.length} petugas untuk ${dateStr} (batch ${created.length} dibuat, ${skipped.length} dilewati).`,
      });
    } catch { /* notifikasi opsional */ }
    res.status(201).json({ ok: true, batchId, created, skipped, total: rows.length, maxItems: MAX_PROPOSAL_ITEMS });
  }));

  // ---------- Penuhi request (setujui usulan / tunjuk nama → SCHEDULED otomatis) ----------
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
    const finalUserId = userId ? String(userId) : (row.proposedUserId ? String(row.proposedUserId) : null);
    if (!finalUserId) return res.status(400).json({ error: 'userId wajib (atau setujui usulan yang sudah ada namanya).' });
    const person = await prisma.user.findUnique({ where: { id: String(finalUserId) }, select: { id: true } }).catch(() => null);
    if (!person) return res.status(404).json({ error: 'Orang tidak ditemukan.' });
    const scheduleEventId = row.eventId ? String(row.eventId) : await resolveWorshipEventByDate(prisma, row.date).catch(() => null);
    const schedule = await prisma.serviceSchedule.create({
      data: {
        id: `ss-${crypto.randomUUID()}`,
        serviceRoleId: row.serviceRoleId,
        userId: person.id,
        eventId: scheduleEventId,
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
