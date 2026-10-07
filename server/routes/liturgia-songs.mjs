/**
 * Liturgia — Pustaka Lagu + Setlist Ibadah per event (lintas unit).
 *
 * Pustaka (`songs`) = referensi GLOBAL: metadata himne KJ/NKB/NNBT/PKJ/KLIK
 * + tautan sumber (alkitab.app/SABDA), lagu kontemporer (copyright/CCLI),
 * lagu sekuler (metadata + tautan saja, momen bebas/bedah-lagu),
 * lagu kontemporer (copyright/CCLI), dan ChordPro milik tim.
 * Setlist (`service_songs`) = pemakaian per event/sesi: urutan + bagian
 * terpilih + transpose/capo + momen. Ekspor siap FreeShow (.show/ChordPro).
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { requireDivision } from '../lib/division-access.mjs';
import {
  WRITE_ROLES,
  assertSecularMoment,
  buildChordProExport,
  buildFreeShowPayload,
  buildQuickLyrics,
  normalizeServiceSongInput,
  normalizeSongInput,
  parseSections,
  serializeServiceSong,
  serializeSong,
  validateArrangementSections,
} from '../lib/liturgy-songs.mjs';

const uid = (p) => `${p}-${crypto.randomUUID()}`;
const SOURCES = ['HIMNE_KJ', 'HIMNE_NKB', 'HIMNE_NNBT', 'HIMNE_PKJ', 'KLIK', 'KONTEMPORER', 'LOKAL', 'SEKULER'];

function missingTable(e) {
  const msg = String(e?.message || e || '');
  return /does not exist|doesn't exist|Unknown table|P2021/i.test(msg);
}

async function ensureEvent(prisma, eventId) {
  try {
    const ev = await prisma.eventProgram.findUnique({ where: { id: String(eventId) }, select: { id: true, name: true } });
    return ev || null;
  } catch {
    return { id: String(eventId), name: null };
  }
}

async function loadSetlist(prisma, eventId) {
  const rows = await prisma.serviceSong.findMany({
    where: { eventId: String(eventId) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const songIds = [...new Set(rows.map((r) => r.songId))];
  const songs = songIds.length
    ? await prisma.song.findMany({ where: { id: { in: songIds } } })
    : [];
  const byId = new Map(songs.map((s) => [s.id, s]));
  return rows.map((r) => serializeServiceSong(r, byId.get(r.songId) || null));
}

export function registerLiturgiaSongsRoutes(app, { wrap }) {
  // ---------------- Pustaka ----------------

  app.get(
    '/api/songs',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const q = String(req.query.q || '').trim();
        const source = String(req.query.source || '').toUpperCase();
        const onlyActive = String(req.query.active || '') !== '0';
        const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
        const where = {};
        if (onlyActive) where.isActive = true;
        if (SOURCES.includes(source)) where.source = source;
        if (q) {
          where.OR = [
            { title: { contains: q } },
            { sourceRef: { contains: q } },
            { authors: { contains: q } },
            { ccli: { contains: q } },
          ];
        }
        const rows = await prisma.song.findMany({ where, orderBy: [{ title: 'asc' }], take: limit });
        res.json({ songs: rows.map(serializeSong) });
      } catch (e) {
        if (missingTable(e)) {
          return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        }
        throw e;
      }
    }),
  );

  app.post(
    '/api/songs',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const data = normalizeSongInput(req.body || {});
        if (data.sourceRef) {
          const dup = await prisma.song.findFirst({ where: { source: data.source, sourceRef: data.sourceRef, isActive: true } });
          if (dup) return res.status(409).json({ error: 'Lagu referensi itu sudah ada di pustaka.', song: serializeSong(dup) });
        }
        const created = await prisma.song.create({
          data: { id: uid('sng'), ...data, createdById: req.authUser?.id || null },
        });
        res.status(201).json({ song: serializeSong(created) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  app.put(
    '/api/songs/:id',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.song.findUnique({ where: { id: String(req.params.id) } });
        if (!found) return res.status(404).json({ error: 'Lagu tidak ditemukan.' });
        const data = normalizeSongInput(req.body || {}, found);
        const updated = await prisma.song.update({ where: { id: found.id }, data });
        res.json({ song: serializeSong(updated) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  app.delete(
    '/api/songs/:id',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.song.findUnique({ where: { id: String(req.params.id) } });
        if (!found) return res.status(404).json({ error: 'Lagu tidak ditemukan.' });
        const used = await prisma.serviceSong.count({ where: { songId: found.id } });
        if (used > 0) {
          const updated = await prisma.song.update({ where: { id: found.id }, data: { isActive: false } });
          return res.json({ ok: true, archived: true, song: serializeSong(updated) });
        }
        await prisma.song.delete({ where: { id: found.id } });
        res.json({ ok: true, archived: false });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  // ---------------- Setlist per event ----------------

  app.get(
    '/api/events/:eventId/songs',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        res.json({ eventId: ev.id, items: await loadSetlist(prisma, ev.id) });
      } catch (e) {
        if (missingTable(e)) return res.json({ eventId: String(req.params.eventId), items: [] });
        throw e;
      }
    }),
  );

  app.post(
    '/api/events/:eventId/songs',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        const songId = String(req.body?.songId || '');
        if (!songId) return res.status(400).json({ error: 'songId wajib.' });
        const song = await prisma.song.findUnique({ where: { id: songId } });
        if (!song) return res.status(404).json({ error: 'Lagu tidak ditemukan di pustaka.' });
        const norm = normalizeServiceSongInput(req.body || {});
        assertSecularMoment(song.source, norm.moment);
        if (norm.sections) {
          validateArrangementSections(norm.sections, parseSections(song.lyricsChordPro || '').map((s) => s.name));
        }
        const count = await prisma.serviceSong.count({ where: { eventId: ev.id } });
        const created = await prisma.serviceSong.create({
          data: {
            id: uid('ssvc'),
            eventId: ev.id,
            sessionId: String(req.body?.sessionId || '').trim().slice(0, 64) || null,
            songId: song.id,
            sortOrder: norm.sortOrder ?? count + 1,
            sections: norm.sections || [],
            baseKey: norm.baseKey || song.defaultKey || null,
            transpose: norm.transpose,
            capo: norm.capo,
            moment: norm.moment,
            note: norm.note,
            createdById: req.authUser?.id || null,
          },
        });
        res.status(201).json({ item: serializeServiceSong(created, song) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  app.put(
    '/api/events/:eventId/songs/:itemId',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.serviceSong.findUnique({ where: { id: String(req.params.itemId) } });
        if (!found || String(found.eventId) !== String(req.params.eventId)) {
          return res.status(404).json({ error: 'Lagu setlist tidak ditemukan.' });
        }
        const norm = normalizeServiceSongInput(req.body || {});
        const needSong = req.body?.moment !== undefined || req.body?.sections !== undefined;
        const songForCheck = needSong
          ? await prisma.song.findUnique({ where: { id: found.songId } })
          : null;
        if (req.body?.moment !== undefined) {
          assertSecularMoment(songForCheck?.source, norm.moment);
        }
        if (req.body?.sections !== undefined && norm.sections) {
          validateArrangementSections(
            norm.sections,
            parseSections(songForCheck?.lyricsChordPro || '').map((s) => s.name),
          );
        }
        const data = {};
        if (req.body?.sections !== undefined) data.sections = norm.sections || [];
        if (req.body?.baseKey !== undefined) data.baseKey = norm.baseKey;
        if (req.body?.transpose !== undefined) data.transpose = norm.transpose;
        if (req.body?.capo !== undefined) data.capo = norm.capo;
        if (req.body?.moment !== undefined) data.moment = norm.moment;
        if (req.body?.note !== undefined) data.note = norm.note;
        if (req.body?.sessionId !== undefined) {
          data.sessionId = String(req.body.sessionId || '').trim().slice(0, 64) || null;
        }
        if (req.body?.sortOrder !== undefined && norm.sortOrder !== null) data.sortOrder = norm.sortOrder;
        const updated = await prisma.serviceSong.update({ where: { id: found.id }, data });
        const song = await prisma.song.findUnique({ where: { id: updated.songId } });
        res.json({ item: serializeServiceSong(updated, song) });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  app.delete(
    '/api/events/:eventId/songs/:itemId',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const found = await prisma.serviceSong.findUnique({ where: { id: String(req.params.itemId) } });
        if (!found || String(found.eventId) !== String(req.params.eventId)) {
          return res.status(404).json({ error: 'Lagu setlist tidak ditemukan.' });
        }
        await prisma.serviceSong.delete({ where: { id: found.id } });
        res.json({ ok: true });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  app.post(
    '/api/events/:eventId/songs/reorder',
    requireDivision('LITURGIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ids = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map((s) => String(s)).slice(0, 100) : [];
        if (!ids.length) return res.status(400).json({ error: 'orderedIds wajib.' });
        await prisma.$transaction(
          ids.map((id, i) => prisma.serviceSong.updateMany({ where: { id, eventId: String(req.params.eventId) }, data: { sortOrder: i + 1 } })),
        );
        res.json({ ok: true, items: await loadSetlist(prisma, String(req.params.eventId)) });
      } catch (e) {
        if (missingTable(e)) return res.status(503).json({ error: 'Tabel lagu belum ada — jalankan npm run db:migrate:liturgy-songs.' });
        throw e;
      }
    }),
  );

  // ---------------- Ekspor FreeShow ----------------

  app.get(
    '/api/events/:eventId/songs/export',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const ev = await ensureEvent(prisma, req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        const items = await loadSetlist(prisma, ev.id);
        const onlyId = String(req.query.itemId || '');
        const picked = onlyId ? items.filter((i) => i.id === onlyId) : items;
        if (onlyId && !picked.length) return res.status(404).json({ error: 'Lagu setlist tidak ditemukan.' });

        // asMe=1: terapkan transpose/capo personal pemusik (fallback default item).
        let forMe = new Map();
        const me = req.authUser?.id || null;
        if (String(req.query.asMe || '') === '1' && me && picked.length) {
          try {
            const rows = await prisma.serviceSongSetting.findMany({
              where: { userId: me, serviceSongId: { in: picked.map((i) => i.id) } },
            });
            forMe = new Map(rows.map((r) => [r.serviceSongId, r]));
          } catch { forMe = new Map(); }
        }
        const usageOf = (item) => {
          const s = forMe.get(item.id);
          if (!s) return item;
          return {
            ...item,
            transpose: s.transpose ?? item.transpose ?? 0,
            capo: s.capo !== undefined && s.capo !== null ? s.capo : (item.capo ?? null),
          };
        };

        const download = String(req.query.download || '');
        const first = picked[0] ? usageOf(picked[0]) : null;
        if (download === 'quicklyrics' && first?.song) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${first.song.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 50) || 'lagu'}.txt"`);
          return res.send(buildQuickLyrics(first.song, first));
        }
        if (download === 'chordpro' && first?.song) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${first.song.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 50) || 'lagu'}.chordpro"`);
          return res.send(buildChordProExport(first.song, first));
        }
        if (download === 'show' && first?.song) {
          const built = buildFreeShowPayload(first.song, first);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${built.fileName}"`);
          return res.json(built.show);
        }

        res.json({
          eventId: ev.id,
          count: picked.length,
          apiHint: 'POST tiap shows[].show ke http://localhost:5506 (FreeShow → Connections → aktifkan API), atau File → Import → ChordPro.',
          items: picked.map((item) => {
            const u = usageOf(item);
            return {
              ...item,
              myTranspose: u.transpose !== item.transpose ? u.transpose : undefined,
              myCapo: u.capo !== item.capo ? u.capo : undefined,
              quickLyrics: item.song ? buildQuickLyrics(item.song, u) : null,
              chordPro: item.song ? buildChordProExport(item.song, u) : null,
              freeshow: item.song ? buildFreeShowPayload(item.song, u) : null,
            };
          }),
        });
      } catch (e) {
        if (missingTable(e)) return res.json({ eventId: String(req.params.eventId), count: 0, items: [] });
        throw e;
      }
    }),
  );
}
