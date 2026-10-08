/**
 * Liturgia — Tata Ibadah Live + Transpose Pemusik.
 *
 * - Order (`service_order_items`): susunan tata ibadah per event.
 *   Tulis = Liturgia + KOMISI/COMMITTEE/SUPERADMIN; baca = login.
 * - Live (`service_live_state`): pointer momen + bait aktif.
 *   Baca = login ATAU kode proyektor (?code=); tulis = Liturgia + tulis.
 * - Setting (`service_song_settings`): transpose/capo personal per akun.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { requireDivision } from '../lib/division-access.mjs';
import { WRITE_ROLES, serializeServiceSong, serializeSong } from '../lib/liturgy-songs.mjs';
import {
  effectiveTranspose,
  normalizeLiveStateInput,
  normalizeOrderItemInput,
  normalizeSongSettingInput,
  orderBoundaryWarnings,
  randomAccessCode,
  readWeekPericope,
  resolveLyrics,
  serializeLiveState,
  serializeOrderItem,
  serializeSongSetting,
} from '../lib/liturgy-live.mjs';

const uid = (p) => `${p}-${crypto.randomUUID()}`;

function missingTable(e) {
  const msg = String(e?.message || e || '');
  return /does not exist|doesn't exist|Unknown table|P2021/i.test(msg);
}

async function ensureEvent(prisma, eventId) {
  const select = { id: true, name: true, slug: true, eventDate: true };
  try {
    const byId = await prisma.eventProgram.findUnique({ where: { id: String(eventId) }, select });
    if (byId) return byId;
    const bySlug = await prisma.eventProgram.findFirst({ where: { slug: String(eventId) }, select });
    return bySlug || null;
  } catch {
    return { id: String(eventId), name: null, slug: null, eventDate: null };
  }
}

async function loadOrder(prisma, eventId, pericope = null) {
  const rows = await prisma.serviceOrderItem.findMany({
    where: { eventId: String(eventId) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const ssIds = [...new Set(rows.map((r) => r.serviceSongId).filter(Boolean))];
  let songByItemId = new Map();
  if (ssIds.length) {
    const ssRows = await prisma.serviceSong.findMany({ where: { id: { in: ssIds } } });
    const songIds = [...new Set(ssRows.map((r) => r.songId))];
    const songs = songIds.length ? await prisma.song.findMany({ where: { id: { in: songIds } } }) : [];
    const songById = new Map(songs.map((s) => [s.id, s]));
    songByItemId = new Map(ssRows.map((r) => [r.id, serializeServiceSong(r, songById.get(r.songId) || null)]));
  }
  return rows.map((r) => {
    const item = serializeOrderItem(r, (r.serviceSongId && songByItemId.get(r.serviceSongId)) || null);
    item.display = resolveLyrics(item, item.serviceSong?.song || null, item.serviceSong || null, pericope);
    return item;
  });
}

async function loadPericope(prisma, ev) {
  try {
    const d = ev?.eventDate ? new Date(ev.eventDate) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return await readWeekPericope(prisma, d.toISOString());
  } catch {
    return null;
  }
}

export function registerLiturgiaLiveRoutes(app, { wrap }) {
  // ---------------- Susunan tata ibadah ----------------

  app.get(
    '/api/events/:eventId/order',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        const items = await loadOrder(prisma, ev.id, await loadPericope(prisma, ev));
        res.json({ eventId: ev.id, items, warnings: orderBoundaryWarnings(items) });
      } catch (e) {
        if (missingTable(e)) return res.json({ eventId: String(req.params.eventId), items: [] });
        throw e;
      }
    }),
  );

  app.post(
    '/api/events/:eventId/order',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        const data = normalizeOrderItemInput(req.body || {});
        if (data.kind === 'lagu' && data.serviceSongId) {
          const ss = await prisma.serviceSong.findUnique({ where: { id: data.serviceSongId } });
          if (!ss || String(ss.eventId) !== String(ev.id)) {
            return res.status(400).json({ error: 'Lagu setlist tidak cocok dengan event ini.' });
          }
        }
        const count = await prisma.serviceOrderItem.count({ where: { eventId: ev.id } });
        const created = await prisma.serviceOrderItem.create({
          data: {
            id: uid('sord'),
            eventId: ev.id,
            sortOrder: data.sortOrder ?? count + 1,
            kind: data.kind || 'lagu',
            serviceSongId: data.serviceSongId || null,
            segmentKey: data.segmentKey || null,
            phaseNo: data.phaseNo ?? null,
            title: data.title || null,
            body: data.body || null,
            owner: data.owner || null,
            minutes: data.minutes ?? null,
            note: data.note || null,
            createdById: req.authUser?.id || null,
          },
        });
        res.status(201).json({ item: serializeOrderItem(created) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel tata ibadah belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );

  app.put(
    '/api/events/:eventId/order/:itemId',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.serviceOrderItem.findUnique({ where: { id: String(req.params.itemId) } });
        if (!found || String(found.eventId) !== String(req.params.eventId)) {
          return res.status(404).json({ error: 'Momen tidak ditemukan.' });
        }
        const data = normalizeOrderItemInput(req.body || {}, found);
        if (data.serviceSongId) {
          const ss = await prisma.serviceSong.findUnique({ where: { id: data.serviceSongId } });
          if (!ss || String(ss.eventId) !== String(found.eventId)) {
            return res.status(400).json({ error: 'Lagu setlist tidak cocok dengan event ini.' });
          }
        }
        const patch = {};
        for (const k of ['kind', 'serviceSongId', 'segmentKey', 'phaseNo', 'title', 'body', 'owner', 'minutes', 'note', 'sortOrder']) {
          if (data[k] !== undefined) patch[k] = data[k];
        }
        const updated = await prisma.serviceOrderItem.update({ where: { id: found.id }, data: patch });
        res.json({ item: serializeOrderItem(updated) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel tata ibadah belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );

  app.delete(
    '/api/events/:eventId/order/:itemId',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.serviceOrderItem.findUnique({ where: { id: String(req.params.itemId) } });
        if (!found || String(found.eventId) !== String(req.params.eventId)) {
          return res.status(404).json({ error: 'Momen tidak ditemukan.' });
        }
        await prisma.serviceOrderItem.delete({ where: { id: found.id } });
        res.json({ ok: true });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel tata ibadah belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );

  app.post(
    '/api/events/:eventId/order/reorder',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ids = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map((s) => String(s)).slice(0, 200) : [];
        if (!ids.length) return res.status(400).json({ error: 'orderedIds wajib.' });
        await prisma.$transaction(
          ids.map((id, i) => prisma.serviceOrderItem.updateMany({ where: { id, eventId: String(req.params.eventId) }, data: { sortOrder: i + 1 } })),
        );
                const ev = await ensureEvent(prisma, req.params.eventId);
        const items = await loadOrder(prisma, String(req.params.eventId), await loadPericope(prisma, ev));
        res.json({ ok: true, items, warnings: orderBoundaryWarnings(items) });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel tata ibadah belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );

  // ---------------- Bulk: bangun kerangka dari segmen pola ----------------

  app.post(
    '/api/events/:eventId/order/bulk',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        const list = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
        if (!list.length) return res.status(400).json({ error: 'items wajib (maks 100).' });
        const norms = list.map((b) => normalizeOrderItemInput(b || {}));
        for (const n of norms) {
          if (n.kind === 'lagu' && n.serviceSongId) {
            const ss = await prisma.serviceSong.findUnique({ where: { id: n.serviceSongId } });
            if (!ss || String(ss.eventId) !== String(ev.id)) {
              return res.status(400).json({ error: 'Lagu setlist tidak cocok dengan event ini.' });
            }
          }
        }
        const base = await prisma.serviceOrderItem.count({ where: { eventId: ev.id } });
        await prisma.$transaction(
          norms.map((n, i) => prisma.serviceOrderItem.create({
            data: {
              id: uid('sord'),
              eventId: ev.id,
              sortOrder: n.sortOrder ?? base + i + 1,
              kind: n.kind || 'lagu',
              serviceSongId: n.serviceSongId || null,
              segmentKey: n.segmentKey || null,
              phaseNo: n.phaseNo ?? null,
              title: n.title || null,
              body: n.body || null,
              owner: n.owner || null,
              minutes: n.minutes ?? null,
              note: n.note || null,
              createdById: req.authUser?.id || null,
            },
          })),
        );
        const items = await loadOrder(prisma, ev.id, await loadPericope(prisma, ev));
        res.status(201).json({ ok: true, count: items.length, items, warnings: orderBoundaryWarnings(items) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel tata ibadah belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );

  // ---------------- Live: baca (login ATAU kode proyektor) ----------------

  app.get(
    '/api/events/:eventId/liturgy-live',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        let state = null;
        try {
          state = await prisma.serviceLiveState.findUnique({ where: { eventId: String(ev.id) } });
        } catch (e) {
          if (!missingTable(e)) throw e;
        }
        const code = String(req.query.code || '').toUpperCase();
        const codeOk = !!state && !!code && String(state.accessCode).toUpperCase() === code;
        if (!req.authUser && !codeOk) {
          return res.status(401).json({ error: 'Butuh login atau kode proyektor.', needCode: true });
        }
        const items = await loadOrder(prisma, ev.id, await loadPericope(prisma, ev));
        res.setHeader('Cache-Control', 'no-store');
        res.json({
          eventId: ev.id,
          eventName: ev.name,
          state: serializeLiveState(state),
          items,
        });
      } catch (e) {
        if (missingTable(e)) return res.json({ eventId: String(req.params.eventId), state: null, items: [] });
        throw e;
      }
    }),
  );

  // ---------------- Live: tulis (operator Liturgia) ----------------

  app.put(
    '/api/events/:eventId/liturgy-live',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        const data = normalizeLiveStateInput(req.body || {});
        let state = await prisma.serviceLiveState.findUnique({ where: { eventId: String(ev.id) } });
        if (!state) {
          state = await prisma.serviceLiveState.create({
            data: {
              id: uid('slive'),
              eventId: String(ev.id),
              accessCode: randomAccessCode(),
              status: data.status || 'DRAFT',
              currentItemId: data.currentItemId || null,
              sectionIndex: data.sectionIndex ?? 0,
              updatedById: req.authUser?.id || null,
            },
          });
        } else {
          const patch = { updatedById: req.authUser?.id || null };
          if (data.status !== undefined) patch.status = data.status;
          if (data.currentItemId !== undefined) patch.currentItemId = data.currentItemId;
          if (data.sectionIndex !== undefined) patch.sectionIndex = data.sectionIndex;
          if (req.body?.rotateCode) patch.accessCode = randomAccessCode();
          if (data.currentItemId) {
            const ok = await prisma.serviceOrderItem.findFirst({
              where: { id: data.currentItemId, eventId: String(ev.id) },
              select: { id: true },
            });
            if (!ok) return res.status(400).json({ error: 'Momen tidak cocok dengan event ini.' });
          }
          state = await prisma.serviceLiveState.update({ where: { id: state.id }, data: patch });
        }
        res.json({ state: { ...serializeLiveState(state), accessCode: state.accessCode } });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel live belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );

  // ---------------- Transpose personal pemusik ----------------

  app.get(
    '/api/events/:eventId/songs/:itemId/mysetting',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.serviceSong.findUnique({ where: { id: String(req.params.itemId) } });
        if (!found || String(found.eventId) !== String(req.params.eventId)) {
          return res.status(404).json({ error: 'Lagu setlist tidak ditemukan.' });
        }
        const me = req.authUser?.id || null;
        const row = me
          ? await prisma.serviceSongSetting.findUnique({
              where: { serviceSongId_userId: { serviceSongId: found.id, userId: me } },
            })
          : null;
        res.json({ item: serializeServiceSong(found, null), setting: serializeSongSetting(row) });
      } catch (e) {
        if (missingTable(e)) return res.json({ setting: null });
        throw e;
      }
    }),
  );

  app.put(
    '/api/events/:eventId/songs/:itemId/mysetting',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const me = req.authUser?.id || null;
        if (!me) return res.status(401).json({ error: 'Butuh login.' });
        const found = await prisma.serviceSong.findUnique({ where: { id: String(req.params.itemId) } });
        if (!found || String(found.eventId) !== String(req.params.eventId)) {
          return res.status(404).json({ error: 'Lagu setlist tidak ditemukan.' });
        }
        const norm = normalizeSongSettingInput(req.body || {});
        const row = await prisma.serviceSongSetting.upsert({
          where: { serviceSongId_userId: { serviceSongId: found.id, userId: me } },
          create: { id: uid('sset'), serviceSongId: found.id, userId: me, ...norm, createdById: me },
          update: { ...norm },
        });
        res.json({ setting: serializeSongSetting(row), effective: effectiveTranspose(found, row) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel setting belum ada — jalankan npm run db:migrate:liturgy-live.' });
        throw e;
      }
    }),
  );
}
