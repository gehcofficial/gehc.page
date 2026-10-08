/**
 * Koinonia — Timeline Hari per tanggal.
 * Susunan blok acara sehari: blok ibadah (link event Liturgia) + pengumuman /
 * selebrasi / makan / games. Tulis = Koinonia + tulis-role; baca = login.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { requireDivision } from '../lib/division-access.mjs';
import {
  normalizeDay,
  normalizeDayItemInput,
  serializeDayItem,
} from '../lib/day-timeline.mjs';

const uid = (p) => `${p}-${crypto.randomUUID()}`;
const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

function missingTable(e) {
  const msg = String(e?.message || e || '');
  return /does not exist|doesn't exist|Unknown table|P2021/i.test(msg);
}

/** Ringkasan ibadah terkait: nama + tanggal + jumlah momen + status live. */
async function eventSummaries(prisma, eventIds) {
  const out = new Map();
  const ids = [...new Set((eventIds || []).filter(Boolean))];
  if (!ids.length) return out;
  try {
    const [events, counts, lives] = await Promise.all([
      prisma.eventProgram.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, slug: true, eventDate: true, status: true },
      }),
      prisma.serviceOrderItem.groupBy({ by: ['eventId'], where: { eventId: { in: ids } }, _count: true }).catch(() => []),
      prisma.serviceLiveState.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, status: true } }).catch(() => []),
    ]);
    const countBy = new Map(counts.map((c) => [c.eventId, c._count]));
    const liveBy = new Map(lives.map((l) => [l.eventId, l.status]));
    for (const ev of events) {
      out.set(ev.id, {
        id: ev.id,
        name: ev.name,
        slug: ev.slug || null,
        eventDate: ev.eventDate || null,
        status: ev.status || null,
        orderCount: countBy.get(ev.id) || 0,
        liveStatus: liveBy.get(ev.id) || null,
      });
    }
  } catch { /* tabel terkait boleh belum ada — ringkasan kosong */ }
  return out;
}

async function loadDay(prisma, day) {
  const rows = await prisma.dayTimelineItem.findMany({
    where: { day: new Date(`${day}T00:00:00Z`) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const summaries = await eventSummaries(prisma, rows.map((r) => r.eventId));
  return rows.map((r) => serializeDayItem(r, summaries.get(String(r.eventId)) || null));
}

export function registerDayTimelineRoutes(app, { wrap }) {
  app.get(
    '/api/day-timeline',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const day = normalizeDay(req.query.day);
        if (!day) return res.status(400).json({ error: 'Query ?day=YYYY-MM-DD wajib.' });
        res.json({ day, items: await loadDay(prisma, day) });
      } catch (e) {
        if (missingTable(e)) return res.json({ day: String(req.query.day || ''), items: [] });
        throw e;
      }
    }),
  );

  app.post(
    '/api/day-timeline',
    requireDivision('KOINONIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const data = normalizeDayItemInput(req.body || {});
        if (data.kind === 'ibadah-block' && data.eventId) {
          const ev = await prisma.eventProgram.findUnique({ where: { id: data.eventId }, select: { id: true } }).catch(() => null);
          if (!ev) return res.status(400).json({ error: 'Event tidak ditemukan.' });
        }
        const count = await prisma.dayTimelineItem.count({ where: { day: new Date(`${data.day}T00:00:00Z`) } });
        const created = await prisma.dayTimelineItem.create({
          data: {
            id: uid('dtl'),
            tenantId: String(req.body?.tenantId || '').slice(0, 16) || null,
            day: new Date(`${data.day}T00:00:00Z`),
            sortOrder: data.sortOrder ?? count + 1,
            kind: data.kind || 'pengumuman',
            eventId: data.eventId || null,
            title: data.title || null,
            body: data.body || null,
            owner: data.owner || null,
            minutes: data.minutes ?? null,
            note: data.note || null,
            createdById: req.authUser?.id || null,
          },
        });
        res.status(201).json({ item: serializeDayItem(created) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel timeline belum ada — jalankan npm run db:migrate:day-timeline.' });
        throw e;
      }
    }),
  );

  app.put(
    '/api/day-timeline/:id',
    requireDivision('KOINONIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.dayTimelineItem.findUnique({ where: { id: String(req.params.id) } });
        if (!found) return res.status(404).json({ error: 'Blok tidak ditemukan.' });
        const data = normalizeDayItemInput(req.body || {}, found);
        if (data.eventId) {
          const ev = await prisma.eventProgram.findUnique({ where: { id: data.eventId }, select: { id: true } }).catch(() => null);
          if (!ev) return res.status(400).json({ error: 'Event tidak ditemukan.' });
        }
        const patch = {};
        for (const k of ['day', 'kind', 'eventId', 'title', 'body', 'owner', 'minutes', 'note', 'sortOrder']) {
          if (data[k] !== undefined) patch[k] = k === 'day' ? new Date(`${data[k]}T00:00:00Z`) : data[k];
        }
        const updated = await prisma.dayTimelineItem.update({ where: { id: found.id }, data: patch });
        res.json({ item: serializeDayItem(updated) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel timeline belum ada — jalankan npm run db:migrate:day-timeline.' });
        throw e;
      }
    }),
  );

  app.delete(
    '/api/day-timeline/:id',
    requireDivision('KOINONIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.dayTimelineItem.findUnique({ where: { id: String(req.params.id) } });
        if (!found) return res.status(404).json({ error: 'Blok tidak ditemukan.' });
        await prisma.dayTimelineItem.delete({ where: { id: found.id } });
        res.json({ ok: true });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel timeline belum ada — jalankan npm run db:migrate:day-timeline.' });
        throw e;
      }
    }),
  );

  app.post(
    '/api/day-timeline/reorder',
    requireDivision('KOINONIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const day = normalizeDay(req.body?.day);
        if (!day) return res.status(400).json({ error: 'day wajib (YYYY-MM-DD).' });
        const ids = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map((s) => String(s)).slice(0, 200) : [];
        if (!ids.length) return res.status(400).json({ error: 'orderedIds wajib.' });
        const dayDate = new Date(`${day}T00:00:00Z`);
        await prisma.$transaction(
          ids.map((id, i) => prisma.dayTimelineItem.updateMany({ where: { id, day: dayDate }, data: { sortOrder: i + 1 } })),
        );
        res.json({ ok: true, items: await loadDay(prisma, day) });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel timeline belum ada — jalankan npm run db:migrate:day-timeline.' });
        throw e;
      }
    }),
  );
}
