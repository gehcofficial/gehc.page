/**
 * Serving Week — grup WA temporer per Minggu serving (BOD Tim Kerja).
 * Tulis = SUPERADMIN/KOMISI selalu; COMMITTEE hanya bila BOD Tim Kerja.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isBodTimkerja, isKomisiOrSuperadmin } from '../division-rbac.mjs';
import {
  assertTransition,
  buildWeekInviteList,
  parseWeekDate,
  serializeWeekChannel,
  validateWaUrl,
} from '../lib/serving-week.mjs';
import { repDayAgendaText, repDayAttendeesHint, repDayTitle } from '../lib/representative-day.mjs';

const uid = (p) => `${p}-${crypto.randomUUID()}`;

async function canManageWeek(req) {
  if (!req.authUser) return false;
  if (isKomisiOrSuperadmin(req.authUser)) return true;
  const roles = (req.authUser.roles || []).map((r) => r.role);
  if (!roles.includes('COMMITTEE')) return false;
  try {
    return await isBodTimkerja(req.authUser);
  } catch {
    return false;
  }
}

const forbid = (res) => res.status(403).json({ error: 'Hanya BOD Tim Kerja / Komisi yang mengelola grup mingguan.' });

function missingTable(e) {
  return /does not exist|doesn't exist|Unknown table|P2021/i.test(String(e?.message || e || ''));
}

export function registerServingWeekRoutes(app, { wrap }) {
  // GET /api/representative-day/template?date=&eventId= — template agenda siap tempel.
  app.get(
    '/api/representative-day/template',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const date = String(req.query.date || '').slice(0, 10) || null;
      let eventName = '';
      if (req.query.eventId && prisma) {
        const ev = await prisma.eventProgram.findUnique({
          where: { id: String(req.query.eventId) },
          select: { name: true, eventDate: true },
        }).catch(() => null);
        if (ev) {
          eventName = ev.name || '';
        }
      }
      res.json({
        title: repDayTitle(eventName, date || ''),
        agendaText: repDayAgendaText(date || ''),
        attendeesHint: repDayAttendeesHint(),
        isJoint: true,
      });
    }),
  );
  // GET /api/serving-weeks/:date/channel — kanal + daftar undangan pekan itu.
  app.get(
    '/api/serving-weeks/:date/channel',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const date = parseWeekDate(req.params.date);
        const [row, invite] = await Promise.all([
          prisma.servingWeekChannel.findUnique({ where: { eventDate: new Date(`${date}T00:00:00.000Z`) } }).catch(() => null),
          buildWeekInviteList(prisma, date),
        ]);
        res.json({ channel: serializeWeekChannel(row), invite, canManage: await canManageWeek(req) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) {
          return res.status(503).json({ error: 'Tabel grup mingguan belum ada — jalankan npm run db:migrate:serving-week.' });
        }
        throw e;
      }
    }),
  );

  // PUT /api/serving-weeks/:date/channel — simpan link WA + perwakilan + status.
  app.put(
    '/api/serving-weeks/:date/channel',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!(await canManageWeek(req))) return forbid(res);
      try {
        const date = parseWeekDate(req.params.date);
        const b = req.body || {};
        const waUrl = b.waUrl !== undefined ? validateWaUrl(b.waUrl) : undefined;
        let reps = undefined;
        if (b.representativeIds !== undefined && b.representativeIds !== null) {
          if (!Array.isArray(b.representativeIds)) return res.status(400).json({ error: 'representativeIds harus array userId.' });
          reps = [...new Set(b.representativeIds.map((s) => String(s)).filter(Boolean))].slice(0, 60);
        }
        const day = new Date(`${date}T00:00:00.000Z`);
        const found = await prisma.servingWeekChannel.findUnique({ where: { eventDate: day } }).catch(() => null);
        if (b.status !== undefined && b.status !== (found?.status || 'DRAFT')) {
          assertTransition(found?.status || 'DRAFT', b.status);
        }
        // Snapshot pasangan serving agar undangan konsisten walau siklus berubah.
        const invite = await buildWeekInviteList(prisma, date);
        const data = {
          ...(waUrl !== undefined ? { waUrl } : {}),
          ...(reps !== undefined ? { representativeIds: reps } : {}),
          ...(b.status !== undefined ? { status: String(b.status).toUpperCase() } : {}),
          cycleIndex: invite.serving?.cycleIndex ?? found?.cycleIndex ?? null,
          responsibleGroupId: invite.serving?.responsibleGroup?.id || found?.responsibleGroupId || null,
          hostGroupId: invite.serving?.hostGroup?.id || found?.hostGroupId || null,
          eventId: invite.serving?.event?.id || found?.eventId || null,
        };
        if (String(data.status || '').toUpperCase() === 'CLOSED') {
          data.closedAt = new Date();
          data.closedById = req.authUser?.id || null;
        }
        const saved = found
          ? await prisma.servingWeekChannel.update({ where: { id: found.id }, data })
          : await prisma.servingWeekChannel.create({
            data: {
              id: uid('swc'),
              eventDate: day,
              status: data.status || 'DRAFT',
              waUrl: data.waUrl ?? null,
              representativeIds: data.representativeIds ?? [],
              cycleIndex: data.cycleIndex,
              responsibleGroupId: data.responsibleGroupId,
              hostGroupId: data.hostGroupId,
              eventId: data.eventId,
              createdById: req.authUser?.id || null,
            },
          });
        res.json({ channel: serializeWeekChannel(saved) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel grup mingguan belum ada — jalankan npm run db:migrate:serving-week.' });
        throw e;
      }
    }),
  );

  // POST /api/serving-weeks/:date/open|close — transisi cepat untuk BOD.
  for (const action of ['open', 'close']) {
    app.post(
      `/api/serving-weeks/:date/${action}`,
      requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
      wrap(async (req, res) => {
        const prisma = getPrisma();
        if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
        if (!(await canManageWeek(req))) return forbid(res);
        try {
          const date = parseWeekDate(req.params.date);
          const to = action === 'open' ? 'OPEN' : 'CLOSED';
          const day = new Date(`${date}T00:00:00.000Z`);
          const found = await prisma.servingWeekChannel.findUnique({ where: { eventDate: day } }).catch(() => null);
          assertTransition(found?.status || 'DRAFT', to);
          const invite = await buildWeekInviteList(prisma, date);
          const data = {
            status: to,
            cycleIndex: invite.serving?.cycleIndex ?? found?.cycleIndex ?? null,
            responsibleGroupId: invite.serving?.responsibleGroup?.id || found?.responsibleGroupId || null,
            hostGroupId: invite.serving?.hostGroup?.id || found?.hostGroupId || null,
            eventId: invite.serving?.event?.id || found?.eventId || null,
            ...(to === 'CLOSED' ? { closedAt: new Date(), closedById: req.authUser?.id || null } : {}),
          };
          const saved = found
            ? await prisma.servingWeekChannel.update({ where: { id: found.id }, data })
            : await prisma.servingWeekChannel.create({
              data: {
                id: uid('swc'), eventDate: day, status: to, waUrl: null, representativeIds: [],
                cycleIndex: data.cycleIndex, responsibleGroupId: data.responsibleGroupId,
                hostGroupId: data.hostGroupId, eventId: data.eventId,
                createdById: req.authUser?.id || null,
                ...(to === 'CLOSED' ? { closedAt: data.closedAt, closedById: data.closedById } : {}),
              },
            });
          res.json({ channel: serializeWeekChannel(saved) });
        } catch (e) {
          if (e.status) return res.status(e.status).json({ error: e.message });
          if (missingTable(e)) return res.status(503).json({ error: 'Tabel grup mingguan belum ada — jalankan npm run db:migrate:serving-week.' });
          throw e;
        }
      }),
    );
  }
}
