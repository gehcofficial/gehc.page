/**
 * Portal Doa — catatan pastoral privat (bukan lifeStatuses, bukan landing).
 *
 * Lanjutan: tanggal kejadian (boleh mundur bila baru diketahui), tautan kegiatan,
 * riwayat doa per tanggal (Doa Minggu), dan penanda "sudah didoakan".
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import {
  isDiakoniaCare,
  isLiturgiaDoa,
  isMentorOfGroup,
  newEntityId,
} from '../lib/drive-ownership.mjs';
import { decodeImageUpload, toJpegBuffer } from '../lib/drive-jpeg.mjs';
import { uploadJpegToFolder, driveThumbUrl } from '../lib/drive-folders.mjs';
import { ensureCareVisitFolder } from '../lib/drive-ensure.mjs';
import { sendNotification } from '../lib/notify.mjs';
import {
  DAY_MS,
  WIB_OFFSET_MS,
  decoratePrayerWeek,
  lateRecordedDays,
  parseDayInput,
  upcomingSunday,
  weekRange,
  wibDayKey,
} from '../lib/prayer-week.mjs';

const KINDS = new Set(['SAKIT', 'DUKA', 'YUDISIUM', 'WISUDA', 'KERJA', 'LAINNYA', 'UMUM']);

function expiryFor(kind) {
  const days = kind === 'SAKIT' || kind === 'DUKA' || kind === 'UMUM' ? 30 : 14;
  return new Date(Date.now() + days * DAY_MS);
}

const dayKey = (value) => {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
};

function serialize(row, eventsById = new Map()) {
  const now = Date.now();
  const occurredOn = dayKey(row.occurredOn);
  const createdOn = dayKey(row.createdAt);
  const lateDays = lateRecordedDays(occurredOn, createdOn);
  const ev = row.contextEventId ? eventsById.get(row.contextEventId) : null;
  return {
    id: row.id,
    kind: row.kind,
    note: row.note,
    status: row.status,
    occurredOn,
    createdAt: row.createdAt,
    prayedAt: row.prayedAt || null,
    prayedCount: row.prayedCount || 0,
    lastPrayedOn: dayKey(row.prayedAt),
    expiresAt: row.expiresAt,
    isExpired: Boolean(row.expiresAt && new Date(row.expiresAt).getTime() <= now),
    isGeneral: !row.subjectUserId && !row.subjectName,
    lateRecordedDays: lateDays,
    contextEventId: row.contextEventId || null,
    contextEvent: ev ? { id: ev.id, name: ev.name, slug: ev.slug || null, eventDate: ev.eventDate || null } : null,
    driveFolderId: row.driveFolderId,
    subjectName: row.subjectName || null,
    subject: row.subject
      ? { id: row.subject.id, name: row.subject.name, avatar: row.subject.avatar }
      : row.subjectName
        ? { id: null, name: row.subjectName, avatar: null }
        : null,
    reporter: row.reporter
      ? { id: row.reporter.id, name: row.reporter.name }
      : null,
  };
}

async function eventsByIdMap(prisma, rows) {
  const ids = [...new Set(rows.map((r) => r.contextEventId).filter(Boolean))];
  if (!ids.length) return new Map();
  const events = await prisma.eventProgram
    .findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, eventDate: true },
    })
    .catch(() => []);
  return new Map(events.map((e) => [e.id, e]));
}

async function canSeeNote(authUser, row) {
  if (isKomisiOrSuperadmin(authUser)) return true;
  if (row.reporterUserId === authUser.id) return true;
  if (row.subjectUserId && row.subjectUserId === authUser.id) return true;
  if (await isLiturgiaDoa(authUser)) return true;
  if ((row.kind === 'SAKIT' || row.kind === 'DUKA') && (await isDiakoniaCare(authUser))) return true;
  if (!row.subjectUserId) return false;
  const prisma = getPrisma();
  const subjectRoles = await prisma.userRole.findMany({
    where: { userId: row.subjectUserId },
    select: { groupId: true },
  });
  return subjectRoles.some((r) => r.groupId && isMentorOfGroup(authUser, r.groupId));
}

/** Hitung ulang prayed_at / prayed_count dari log. */
async function recomputePrayerSummary(prisma, noteId) {
  const logs = await prisma.pastoralPrayerLog.findMany({
    where: { noteId },
    select: { prayedOn: true },
  });
  const last = logs.reduce((acc, l) => (!acc || l.prayedOn > acc ? l.prayedOn : acc), null);
  await prisma.pastoralCareNote.update({
    where: { id: noteId },
    data: { prayedAt: last, prayedCount: logs.length },
  });
  return { prayedAt: last, prayedCount: logs.length };
}

export function registerPastoralCareRoutes(app, { wrap }) {
  app.get(
    '/api/pastoral-care',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ notes: [] });
      const now = new Date();
      const statusParam = String(req.query.status || 'OPEN').toUpperCase();
      const status = statusParam === 'ALL' ? null : statusParam === 'RESOLVED' ? 'RESOLVED' : 'OPEN';
      const expiredParam = String(req.query.expired || 'include').toLowerCase();
      const month = String(req.query.month || '').trim();
      const monthMatch = /^(\d{4})-(\d{2})$/.exec(month);

      const where = {};
      if (status) where.status = status;
      if (expiredParam === 'exclude') {
        where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
      } else if (expiredParam === 'only') {
        where.expiresAt = { lte: now };
      }
      if (monthMatch) {
        const y = Number(monthMatch[1]);
        const m = Number(monthMatch[2]);
        const from = new Date(Date.UTC(y, m - 1, 1));
        const to = new Date(Date.UTC(y, m, 1));
        where.occurredOn = { gte: from, lt: to };
      }

      const rows = await prisma.pastoralCareNote.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
      const liturgia = await isLiturgiaDoa(req.authUser);
      const diakonia = await isDiakoniaCare(req.authUser);
      const admin = isKomisiOrSuperadmin(req.authUser);
      const events = await eventsByIdMap(prisma, rows);

      // Filter per kelompok: subjeknya anggota grup tsb (roster Doa Kelompok).
      const groupId = String(req.query.groupId || '').trim();
      if (groupId) {
        const mentorOk = await isMentorOfGroup(req.authUser, groupId);
        if (!admin && !liturgia && !diakonia && !mentorOk) {
          return res.status(403).json({ error: 'Hanya mentor kelompok ini atau Komisi.' });
        }
        const [gm, ur] = await Promise.all([
          prisma.groupMember.findMany({ where: { groupId, status: 'ACTIVE', userId: { not: null } }, select: { userId: true } }).catch(() => []),
          prisma.userRole.findMany({ where: { groupId, role: { in: ['MENTOR', 'CO_MENTOR', 'MENTEE'] } }, select: { userId: true } }).catch(() => []),
        ]);
        const memberIds = new Set([...gm.map((x) => x.userId), ...ur.map((x) => x.userId)].filter(Boolean));
        const groupNotes = rows
          .filter((r) => r.subjectUserId && memberIds.has(r.subjectUserId))
          .map((r) => serialize(r, events));
        return res.json({ notes: groupNotes, groupId });
      }

      const subjectIds = [...new Set(rows.map((r) => r.subjectUserId).filter(Boolean))];
      const roleRows = subjectIds.length
        ? await prisma.userRole.findMany({
            where: { userId: { in: subjectIds } },
            select: { userId: true, groupId: true },
          })
        : [];
      const groupsByUser = new Map();
      for (const r of roleRows) {
        if (!r.groupId) continue;
        const list = groupsByUser.get(r.userId) || [];
        list.push(r.groupId);
        groupsByUser.set(r.userId, list);
      }
      const visible = rows.filter((row) => {
        if (admin) return true;
        if (row.reporterUserId === req.authUser.id) return true;
        if (row.subjectUserId && row.subjectUserId === req.authUser.id) return true;
        if (liturgia) return true;
        if ((row.kind === 'SAKIT' || row.kind === 'DUKA') && diakonia) return true;
        if (!row.subjectUserId) return false;
        return (groupsByUser.get(row.subjectUserId) || []).some((gid) => isMentorOfGroup(req.authUser, gid));
      }).map((row) => serialize(row, events));
      res.json({ notes: visible });
    }),
  );

  app.post(
    '/api/pastoral-care',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const kind = String(req.body?.kind || '').toUpperCase();
      const subjectUserId = String(req.body?.subjectUserId || '').trim();
      const subjectName = String(req.body?.subjectName || '').trim();
      const note = String(req.body?.note || '').trim();
      const isGeneral = kind === 'UMUM' && !subjectUserId && !subjectName;
      if (!KINDS.has(kind) || !note) {
        return res.status(400).json({ error: 'Jenis dan catatan wajib.' });
      }
      if (!subjectUserId && !subjectName && !isGeneral) {
        return res.status(400).json({ error: 'Pilih jemaat, tulis nama manual, atau pilih jenis "Umum".' });
      }
      const occurredRaw = String(req.body?.occurredOn || '').trim();
      const occurredOn = occurredRaw ? parseDayInput(occurredRaw) : new Date(`${wibDayKey()}T00:00:00.000Z`);
      if (occurredRaw && !occurredOn) {
        return res.status(400).json({ error: 'Tanggal kejadian tidak valid (format YYYY-MM-DD).' });
      }
      let contextEventId = String(req.body?.contextEventId || '').trim() || null;
      if (contextEventId) {
        const ev = await prisma.eventProgram
          .findUnique({ where: { id: contextEventId }, select: { id: true } })
          .catch(() => null);
        if (!ev) contextEventId = null;
      }
      if (subjectUserId === req.authUser.id) {
        return res.status(400).json({ error: 'Laporan ini tentang orang lain, bukan profil sendiri.' });
      }
      let subject = null;
      if (subjectUserId) {
        subject = await prisma.user.findUnique({
          where: { id: subjectUserId },
          select: { id: true, name: true },
        });
        if (!subject) return res.status(404).json({ error: 'Jemaat tidak ditemukan.' });
      }

      let driveFolderId = null;
      if (req.body?.data && (kind === 'SAKIT' || kind === 'DUKA')) {
        const jpeg = await toJpegBuffer(decodeImageUpload(req.body).buffer);
        const dest = await ensureCareVisitFolder(
          subject?.name || subjectName || 'manual',
          new Date().toISOString().slice(0, 10),
        );
        await uploadJpegToFolder(dest.drive, dest.folder.id, jpeg, {
          filename: `kunjungan-${Date.now()}.jpg`,
          publicReader: false,
        });
        driveFolderId = dest.visit?.id || dest.folder.id;
      }

      const row = await prisma.pastoralCareNote.create({
        data: {
          id: newEntityId('pcn'),
          subjectUserId: subject ? subject.id : null,
          subjectName: subject ? null : (subjectName || null),
          reporterUserId: req.authUser.id,
          kind,
          note,
          status: 'OPEN',
          occurredOn,
          contextEventId,
          expiresAt: expiryFor(kind),
          driveFolderId,
        },
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
      });
      // Notifikasi privat ke mentor kelompok subjek (tanpa detail sensitif).
      if (subject) {
        try {
          const [gm, ur] = await Promise.all([
            prisma.groupMember.findMany({ where: { userId: subject.id, status: 'ACTIVE' }, select: { groupId: true } }).catch(() => []),
            prisma.userRole.findMany({ where: { userId: subject.id, groupId: { not: null } }, select: { groupId: true } }).catch(() => []),
          ]);
          const gids = [...new Set([...gm.map((g) => g.groupId), ...ur.map((g) => g.groupId)].filter(Boolean))];
          const mentors = gids.length
            ? await prisma.groupMember.findMany({
                where: { groupId: { in: gids }, status: 'ACTIVE', familyRole: { in: ['MENTOR', 'COMENTOR'] } },
                select: { userId: true },
              }).catch(() => [])
            : [];
          const ra = gids.length
            ? await prisma.roleAssignment.findMany({
                where: { groupId: { in: gids }, isActive: true, role: { in: ['MENTOR', 'CO_MENTOR'] } },
                select: { userId: true },
              }).catch(() => [])
            : [];
          const mentorIds = [...new Set([...mentors.map((m) => m.userId), ...ra.map((r) => r.userId)].filter(Boolean))]
            .filter((id) => id !== req.authUser.id);
          if (mentorIds.length) {
            await sendNotification({
              type: 'IDLE_FLAG',
              category: 'pengingat',
              title: 'Catatan doa baru (privat)',
              message: 'Buka Portal Doa untuk detail.',
              href: '/#/portal',
              senderRole: null,
              audience: { type: 'USER', userIds: mentorIds },
              priority: 'TASK',
            });
          }
        } catch { /* notifikasi opsional */ }
      }

      const events = await eventsByIdMap(prisma, [row]);
      res.status(201).json({ note: serialize(row, events), photoHint: driveFolderId ? driveThumbUrl(null) : null });
    }),
  );

  app.patch(
    '/api/pastoral-care/:id/resolve',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const row = await prisma.pastoralCareNote.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Tidak ditemukan.' });
      const mentor = await canSeeNote(req.authUser, row);
      const isSubject = row.subjectUserId && row.subjectUserId === req.authUser.id;
      if (!mentor && !isSubject && !isKomisiOrSuperadmin(req.authUser)) {
        return res.status(403).json({ error: 'Hanya subjek, mentor, atau Komisi yang menutup catatan.' });
      }
      const updated = await prisma.pastoralCareNote.update({
        where: { id: row.id },
        data: { status: 'RESOLVED' },
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
      });
      const events = await eventsByIdMap(prisma, [updated]);
      res.json({ note: serialize(updated, events) });
    }),
  );

  /** Tandai satu catatan sudah didoakan pada tanggal tertentu (idempoten per hari). */
  app.post(
    '/api/pastoral-care/:id/pray',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const row = await prisma.pastoralCareNote.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Tidak ditemukan.' });
      if (!(await canSeeNote(req.authUser, row))) {
        return res.status(403).json({ error: 'Tidak berhak menandai doa catatan ini.' });
      }
      const prayedOn = parseDayInput(req.body?.prayedOn) || parseDayInput(wibDayKey());
      const existing = await prisma.pastoralPrayerLog.findUnique({
        where: { noteId_prayedOn: { noteId: row.id, prayedOn } },
      });
      if (!existing) {
        await prisma.pastoralPrayerLog.create({
          data: {
            id: newEntityId('ppl'),
            noteId: row.id,
            prayedOn,
            serviceEventId: String(req.body?.serviceEventId || '').trim() || null,
            prayedById: req.authUser.id,
          },
        });
      }
      const summary = await recomputePrayerSummary(prisma, row.id);
      const fresh = await prisma.pastoralCareNote.findUnique({
        where: { id: row.id },
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
      });
      const events = await eventsByIdMap(prisma, [fresh]);
      res.json({
        note: serialize(fresh, events),
        alreadyMarked: Boolean(existing),
        prayedAt: summary.prayedAt,
        prayedCount: summary.prayedCount,
      });
    }),
  );

  /** Batalkan penanda doa pada tanggal tertentu. */
  app.delete(
    '/api/pastoral-care/:id/pray',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const row = await prisma.pastoralCareNote.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Tidak ditemukan.' });
      const isReporter = row.reporterUserId === req.authUser.id;
      if (!(await canSeeNote(req.authUser, row)) && !isReporter) {
        return res.status(403).json({ error: 'Tidak berhak mengubah penanda doa catatan ini.' });
      }
      const prayedOn = parseDayInput(req.query.on) || parseDayInput(wibDayKey());
      await prisma.pastoralPrayerLog
        .delete({ where: { noteId_prayedOn: { noteId: row.id, prayedOn } } })
        .catch(() => {});
      const summary = await recomputePrayerSummary(prisma, row.id);
      res.json({ ok: true, prayedAt: summary.prayedAt, prayedCount: summary.prayedCount });
    }),
  );

  /** Tandai banyak catatan sekaligus (pendoa saat ibadah). */
  app.post(
    '/api/pastoral-care/pray-bulk',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const noteIds = [...new Set((req.body?.noteIds || []).map((x) => String(x)).filter(Boolean))].slice(0, 200);
      if (!noteIds.length) return res.status(400).json({ error: 'Tidak ada catatan yang dipilih.' });
      const prayedOn = parseDayInput(req.body?.prayedOn) || parseDayInput(wibDayKey());
      const rows = await prisma.pastoralCareNote.findMany({ where: { id: { in: noteIds } } });
      let marked = 0;
      let skipped = 0;
      const allowedIds = [];
      for (const row of rows) {
        if (!(await canSeeNote(req.authUser, row))) { skipped += 1; continue; }
        allowedIds.push(row.id);
        try {
          await prisma.pastoralPrayerLog.create({
            data: {
              id: newEntityId('ppl'),
              noteId: row.id,
              prayedOn,
              prayedById: req.authUser.id,
            },
          });
          marked += 1;
        } catch {
          skipped += 1; // sudah ditandai pada tanggal itu
        }
      }
      for (const id of allowedIds) await recomputePrayerSummary(prisma, id);
      res.json({ ok: true, marked, skipped, prayedOn: dayKey(prayedOn) });
    }),
  );

  /** Daftar Doa Minggu: konteks aktif (termasuk lampau) + status sudah didoakan minggu ini. */
  app.get(
    '/api/pastoral-care/prayer-list',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ sunday: '', notes: [], stats: { total: 0, prayed: 0, notPrayed: 0 } });
      const requested = parseDayInput(req.query.sunday);
      const sunday = requested ? dayKey(requested) : upcomingSunday();
      const week = weekRange(sunday);
      const sundayEnd = new Date(Date.parse(`${sunday}T00:00:00.000Z`) + DAY_MS);

      const rows = await prisma.pastoralCareNote.findMany({
        where: {
          status: 'OPEN',
          occurredOn: { lt: sundayEnd },
        },
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
        orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
        take: 200,
      });
      const liturgia = await isLiturgiaDoa(req.authUser);
      const diakonia = await isDiakoniaCare(req.authUser);
      const admin = isKomisiOrSuperadmin(req.authUser);
      const subjectIds = [...new Set(rows.map((r) => r.subjectUserId).filter(Boolean))];
      const roleRows = subjectIds.length
        ? await prisma.userRole.findMany({ where: { userId: { in: subjectIds } }, select: { userId: true, groupId: true } })
        : [];
      const groupsByUser = new Map();
      for (const r of roleRows) {
        if (!r.groupId) continue;
        const list = groupsByUser.get(r.userId) || [];
        list.push(r.groupId);
        groupsByUser.set(r.userId, list);
      }
      const visible = rows.filter((row) => {
        if (admin || liturgia) return true;
        if (row.reporterUserId === req.authUser.id) return true;
        if (row.subjectUserId && row.subjectUserId === req.authUser.id) return true;
        if ((row.kind === 'SAKIT' || row.kind === 'DUKA') && diakonia) return true;
        if (!row.subjectUserId) return false;
        return (groupsByUser.get(row.subjectUserId) || []).some((gid) => isMentorOfGroup(req.authUser, gid));
      });

      const logs = visible.length
        ? await prisma.pastoralPrayerLog.findMany({
            where: {
              noteId: { in: visible.map((r) => r.id) },
              prayedOn: { gte: week.start, lte: week.end },
            },
            select: { noteId: true, prayedOn: true },
          })
        : [];
      const events = await eventsByIdMap(prisma, visible);
      const serialized = visible.map((row) => serialize(row, events));
      const list = decoratePrayerWeek(serialized, logs);
      const serviceEvent = await prisma.eventProgram
        .findFirst({
          where: {
            eventDate: {
              gte: week.start.getTime() - WIB_OFFSET_MS,
              lt: sundayEnd.getTime() - WIB_OFFSET_MS,
            },
            kind: 'UMUM',
          },
          select: { id: true, name: true, slug: true, eventDate: true },
          orderBy: { eventDate: 'asc' },
        })
        .catch(() => null);
      res.json({
        sunday,
        weekStart: week.monday,
        serviceEvent,
        notes: list.notes,
        stats: list.stats,
      });
    }),
  );

  /** Riwayat tanggal doa satu catatan. */
  app.get(
    '/api/pastoral-care/:id/prayer-log',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ logs: [] });
      const row = await prisma.pastoralCareNote.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Tidak ditemukan.' });
      if (!(await canSeeNote(req.authUser, row))) {
        return res.status(403).json({ error: 'Tidak berhak melihat riwayat doa catatan ini.' });
      }
      const logs = await prisma.pastoralPrayerLog.findMany({
        where: { noteId: row.id },
        orderBy: { prayedOn: 'desc' },
        take: 60,
        include: { prayedBy: { select: { id: true, name: true } } },
      });
      res.json({
        logs: logs.map((l) => ({
          id: l.id,
          prayedOn: dayKey(l.prayedOn),
          prayedBy: l.prayedBy ? { id: l.prayedBy.id, name: l.prayedBy.name } : null,
        })),
      });
    }),
  );

  /** Cari kegiatan untuk ditautkan ke konteks doa (ringan, tanpa divisions/meetings). */
  app.get(
    '/api/pastoral-care/events',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ events: [] });
      const q = String(req.query.q || '').trim();
      const events = await prisma.eventProgram
        .findMany({
          where: q.length >= 2 ? { name: { contains: q } } : {},
          select: { id: true, name: true, slug: true, eventDate: true, kind: true },
          orderBy: [{ eventDate: 'desc' }, { startDate: 'desc' }],
          take: 20,
        })
        .catch(() => []);
      res.json({ events });
    }),
  );

  app.get(
    '/api/pastoral-care/people',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.json({ people: [] });
      const groupId = String(req.query.groupId || '').trim();
      if (groupId) {
        const ok = isKomisiOrSuperadmin(req.authUser) || await isMentorOfGroup(req.authUser, groupId);
        if (!ok) return res.status(403).json({ error: 'Hanya mentor kelompok ini atau Komisi.' });
      }
      // Diri sendiri tetap tampil di daftar (blokir kirim tentang diri ada di POST).
      const people = await prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          ...(groupId ? { groupMembers: { some: { groupId, status: 'ACTIVE' } } } : {}),
          OR: [
            { name: { contains: q } },
            { givenName: { contains: q } },
            { middleName: { contains: q } },
            { familyName: { contains: q } },
          ],
        },
        select: { id: true, name: true, avatar: true },
        take: 12,
      });
      res.json({ people });
    }),
  );
}
