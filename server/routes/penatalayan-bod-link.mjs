/**
 * Tautan BOD penatalayan — satu link per event, pengisian per role.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { pushToUsers } from '../lib/notify.mjs';
import { resolveWorshipEventByDate } from '../lib/service-events.mjs';
import { rolesForPattern, resolveRoleKey, buildResponsibleGroupCaption } from '../lib/serving-role-catalog.mjs';
import { canManageBodLink, canFillBodLink, canAccessDivisionInbox } from '../lib/penatalayan-bod-access.mjs';
import { listRequests } from '../lib/penatalayan-requests.mjs';
import { buildSlotBoard, inferEventEndAt, progressFromSlots } from '../lib/penatalayan-bod-session.mjs';
import {
  createRequestRow,
  divisionLeadIds,
  hasActiveSchedule,
  hasPendingRequest,
} from '../lib/penatalayan-requests.mjs';
import { isScopedMentor, assertMentorAssignScope } from '../lib/mentor-assign.mjs';

const uid = (p) => `${p}-${crypto.randomUUID()}`;

function tokenSlug() {
  return crypto.randomBytes(24).toString('base64url');
}

function dateOnly(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

async function loadLink(prisma, token) {
  return prisma.penatalayanBodLink.findUnique({ where: { token: String(token) } }).catch(() => null);
}

async function loadSession(prisma, link) {
  const event = link?.eventId
    ? await prisma.eventProgram.findUnique({
      where: { id: String(link.eventId) },
      select: { id: true, name: true, eventDate: true, metadata: true, serviceType: true },
    }).catch(() => null)
    : null;
  const serviceDate = link?.serviceDate
    ? dateOnly(link.serviceDate)
    : (event?.eventDate ? dateOnly(event.eventDate) : null);
  const patternCode = String(link?.patternCode || 'CREATIVE_LAB').toUpperCase();
  const roles = await prisma.serviceRole.findMany({ where: { isActive: true }, take: 200 }).catch(() => []);
  const dateObj = serviceDate ? new Date(`${serviceDate}T00:00:00.000Z`) : null;
  const [schedules, requests] = dateObj
    ? await Promise.all([
      prisma.serviceSchedule.findMany({
        where: { date: dateObj },
        include: { user: { select: { id: true, name: true } }, serviceRole: true },
        take: 200,
      }).catch(() => []),
      prisma.$queryRawUnsafe(
        `SELECT id, service_role_id AS serviceRoleId, status, requester_id AS requesterId
         FROM service_role_requests WHERE date = ? AND status = 'PENDING' LIMIT 200`,
        serviceDate,
      ).catch(() => []),
    ])
    : [[], []];
  const eventEndAt = inferEventEndAt(event);
  const slots = buildSlotBoard({
    patternCode,
    roles,
    schedules,
    requests,
    eventEndAt,
  });
  return {
    link,
    event,
    serviceDate,
    patternCode,
    slots,
    progress: progressFromSlots(slots),
    eventEndAt: eventEndAt ? eventEndAt.toISOString() : null,
  };
}

export function registerPenatalayanBodLinkRoutes(app, { wrap }) {
  app.post(
    '/api/penatalayan/bod-links',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!(await canManageBodLink(req.authUser))) {
        return res.status(403).json({ error: 'Hanya BOD Tim Kerja / Komisi yang dapat membuat tautan.' });
      }
      const { eventId, patternCode, hostGroupId, responsibleGroupId } = req.body || {};
      if (!eventId) return res.status(400).json({ error: 'eventId wajib.' });
      const event = await prisma.eventProgram.findUnique({ where: { id: String(eventId) } }).catch(() => null);
      if (!event) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const serviceDate = event.eventDate ? new Date(event.eventDate) : new Date();
      const existing = await prisma.penatalayanBodLink.findUnique({ where: { eventId: String(eventId) } }).catch(() => null);
      if (existing) {
        return res.json({
          link: existing,
          url: `/#/portal/mentor/penatalayan-tautan?token=${existing.token}`,
          reused: true,
        });
      }
      const token = tokenSlug();
      const row = await prisma.penatalayanBodLink.create({
        data: {
          id: uid('pbl'),
          token,
          eventId: String(eventId),
          serviceDate,
          patternCode: String(patternCode || 'CREATIVE_LAB').toUpperCase().slice(0, 32),
          hostGroupId: hostGroupId ? String(hostGroupId) : null,
          responsibleGroupId: responsibleGroupId ? String(responsibleGroupId) : null,
          createdById: req.authUser?.id || 'unknown',
        },
      });
      res.status(201).json({
        link: row,
        url: `/#/portal/mentor/penatalayan-tautan?token=${token}`,
      });
    }),
  );

  app.get(
    '/api/penatalayan/bod-links/token/:token',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const link = await loadLink(prisma, req.params.token);
      if (!link) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      if (!(await canFillBodLink(req.authUser, prisma, link))) {
        return res.status(403).json({ error: 'Anda tidak memiliki akses mengisi tautan ini.' });
      }
      const session = await loadSession(prisma, link);
      const canManage = await canManageBodLink(req.authUser);
      res.json({ ...session, canManage, patternRoles: rolesForPattern(session.patternCode) });
    }),
  );

  app.post(
    '/api/penatalayan/bod-links/token/:token/assign',
    requireRole('MENTOR', 'CO_MENTOR', 'COMMITTEE', 'KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const link = await loadLink(prisma, req.params.token);
      if (!link) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      if (!(await canFillBodLink(req.authUser, prisma, link))) {
        return res.status(403).json({ error: 'Tidak boleh mengisi tautan ini.' });
      }
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ error: 'Minimal 1 penugasan.' });
      const serviceDate = dateOnly(link.serviceDate);
      const eventId = link.eventId ? String(link.eventId) : await resolveWorshipEventByDate(prisma, serviceDate).catch(() => null);
      const created = [];
      const skipped = [];
      const userIds = [...new Set(items.map((i) => String(i.userId || '')).filter(Boolean))];
      if (isScopedMentor(req.authUser)) {
        try { await assertMentorAssignScope(prisma, req.authUser, userIds); }
        catch (e) { return res.status(e.status || 403).json({ error: e.message }); }
      }
      for (const it of items.slice(0, 40)) {
        const roleKey = String(it.roleKey || '');
        let serviceRoleId = it.serviceRoleId ? String(it.serviceRoleId) : null;
        if (!serviceRoleId && roleKey) {
          const byKey = await prisma.serviceRole.findFirst({ where: { roleKey } }).catch(() => null);
          if (byKey) serviceRoleId = byKey.id;
          else {
            const all = await prisma.serviceRole.findMany({ where: { isActive: true }, take: 200 }).catch(() => []);
            const hit = all.find((r) => resolveRoleKey(r.name) === roleKey);
            if (hit) serviceRoleId = hit.id;
          }
        }
        const userId = String(it.userId || '');
        if (!serviceRoleId || !userId) {
          skipped.push({ ...it, reason: 'roleKey/serviceRoleId & userId wajib.' });
          continue;
        }
        if (await hasActiveSchedule(prisma, serviceRoleId, serviceDate)) {
          skipped.push({ ...it, reason: 'Role sudah terisi.' });
          continue;
        }
        const schedule = await prisma.serviceSchedule.create({
          data: {
            id: uid('ss'),
            serviceRoleId,
            userId,
            eventId,
            date: new Date(`${serviceDate}T00:00:00.000Z`),
            status: 'SCHEDULED',
            notes: it.note ? String(it.note).slice(0, 500) : null,
          },
        });
        created.push(schedule);
      }
      res.status(201).json({ created, skipped });
    }),
  );

  app.post(
    '/api/penatalayan/bod-links/token/:token/request-division',
    requireRole('MENTOR', 'CO_MENTOR', 'COMMITTEE', 'KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const link = await loadLink(prisma, req.params.token);
      if (!link) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      if (!(await canFillBodLink(req.authUser, prisma, link))) {
        return res.status(403).json({ error: 'Tidak boleh meminta divisi dari tautan ini.' });
      }
      const { roleKey, serviceRoleId, note } = req.body || {};
      let rid = serviceRoleId ? String(serviceRoleId) : null;
      if (!rid && roleKey) {
        const byKey = await prisma.serviceRole.findFirst({ where: { roleKey: String(roleKey) } }).catch(() => null);
        rid = byKey?.id || null;
      }
      if (!rid) return res.status(400).json({ error: 'roleKey atau serviceRoleId wajib.' });
      const serviceDate = dateOnly(link.serviceDate);
      if (await hasPendingRequest(prisma, rid, serviceDate)) {
        return res.status(409).json({ error: 'Permintaan untuk role ini masih menunggu.' });
      }
      const role = await prisma.serviceRole.findUnique({ where: { id: rid } }).catch(() => null);
      if (!role) return res.status(404).json({ error: 'Komponen tidak ditemukan.' });
      const eventId = link.eventId ? String(link.eventId) : await resolveWorshipEventByDate(prisma, serviceDate).catch(() => null);
      const rec = await createRequestRow(prisma, {
        id: uid('prr'),
        serviceRoleId: rid,
        eventId,
        date: serviceDate,
        requesterId: req.authUser?.id || 'unknown',
        note: note ? String(note).slice(0, 500) : 'Diminta via tautan BOD',
      });
      const leads = await divisionLeadIds(prisma, { eventId, division: role.division }).catch(() => []);
      await pushToUsers(prisma, leads, {
        title: `Butuh ${role.name} — ${serviceDate}`,
        message: `${req.authUser?.name || 'Koordinator'} meminta divisi ${role.division} menyiapkan ${role.name}.`,
        href: '#/portal',
        category: 'penatalayan',
        priority: 'TASK',
      }).catch(() => 0);
      res.status(201).json({ request: rec });
    }),
  );

  app.get(
    '/api/penatalayan/bod-links/token/:token/caption',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const link = await loadLink(prisma, req.params.token);
      if (!link) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      if (!(await canManageBodLink(req.authUser))) {
        return res.status(403).json({ error: 'Hanya BOD yang dapat menyalin caption ringkasan.' });
      }
      const session = await loadSession(prisma, link);
      const dateLabel = session.serviceDate
        ? new Date(`${session.serviceDate}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        : '—';
      let hostGroup = null;
      let responsibleGroup = null;
      if (link.hostGroupId || link.responsibleGroupId) {
        const ids = [link.hostGroupId, link.responsibleGroupId].filter(Boolean);
        const groups = ids.length
          ? await prisma.group.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
          : [];
        hostGroup = groups.find((g) => g.id === link.hostGroupId)?.name || null;
        responsibleGroup = groups.find((g) => g.id === link.responsibleGroupId)?.name || null;
      }
      const text = buildResponsibleGroupCaption({
        dateLabel,
        hostGroup,
        responsibleGroup,
        patternCode: session.patternCode,
      });
      res.json({ caption: text, progress: session.progress });
    }),
  );

  app.get(
    '/api/penatalayan/bod-links/division-inbox',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const division = String(req.query.division || '').toUpperCase();
      if (!division) return res.status(400).json({ error: 'division wajib.' });
      if (!(await canAccessDivisionInbox(req.authUser, prisma, division))) {
        return res.status(403).json({ error: 'Hanya koordinator penatalayan atau kepala divisi terkait.' });
      }
      const status = String(req.query.status || 'PENDING').toUpperCase();
      const rows = await listRequests(prisma, {
        division,
        status: status === 'ALL' ? 'ALL' : status,
        limit: 80,
      });
      res.json({ requests: rows });
    }),
  );
}
