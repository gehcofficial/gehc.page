/**
 * Portal Doa — catatan pastoral privat (bukan lifeStatuses, bukan landing).
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

const KINDS = new Set(['SAKIT', 'DUKA', 'YUDISIUM', 'WISUDA', 'KERJA', 'LAINNYA']);

function expiryFor(kind) {
  const days = kind === 'SAKIT' || kind === 'DUKA' ? 30 : 14;
  return new Date(Date.now() + days * 86400000);
}

function serialize(row) {
  return {
    id: row.id,
    kind: row.kind,
    note: row.note,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    driveFolderId: row.driveFolderId,
    subject: row.subject
      ? { id: row.subject.id, name: row.subject.name, avatar: row.subject.avatar }
      : null,
    reporter: row.reporter
      ? { id: row.reporter.id, name: row.reporter.name }
      : null,
  };
}

async function canSeeNote(authUser, row) {
  if (isKomisiOrSuperadmin(authUser)) return true;
  if (row.reporterUserId === authUser.id || row.subjectUserId === authUser.id) return true;
  if (await isLiturgiaDoa(authUser)) return true;
  if ((row.kind === 'SAKIT' || row.kind === 'DUKA') && (await isDiakoniaCare(authUser))) return true;
  const prisma = getPrisma();
  const subjectRoles = await prisma.userRole.findMany({
    where: { userId: row.subjectUserId },
    select: { groupId: true },
  });
  return subjectRoles.some((r) => r.groupId && isMentorOfGroup(authUser, r.groupId));
}

export function registerPastoralCareRoutes(app, { wrap }) {
  app.get(
    '/api/pastoral-care',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ notes: [] });
      const now = new Date();
      const rows = await prisma.pastoralCareNote.findMany({
        where: {
          status: req.query.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      });
      const liturgia = await isLiturgiaDoa(req.authUser);
      const diakonia = await isDiakoniaCare(req.authUser);
      const admin = isKomisiOrSuperadmin(req.authUser);
      const subjectIds = [...new Set(rows.map((r) => r.subjectUserId))];
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
        if (row.reporterUserId === req.authUser.id || row.subjectUserId === req.authUser.id) return true;
        if (liturgia) return true;
        if ((row.kind === 'SAKIT' || row.kind === 'DUKA') && diakonia) return true;
        return (groupsByUser.get(row.subjectUserId) || []).some((gid) => isMentorOfGroup(req.authUser, gid));
      }).map(serialize);
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
      const note = String(req.body?.note || '').trim();
      if (!KINDS.has(kind) || !subjectUserId || !note) {
        return res.status(400).json({ error: 'Jenis, subjek, dan catatan wajib.' });
      }
      if (subjectUserId === req.authUser.id) {
        return res.status(400).json({ error: 'Laporan ini tentang orang lain, bukan profil sendiri.' });
      }
      const subject = await prisma.user.findUnique({
        where: { id: subjectUserId },
        select: { id: true, name: true },
      });
      if (!subject) return res.status(404).json({ error: 'Jemaat tidak ditemukan.' });

      let driveFolderId = null;
      if (req.body?.data && (kind === 'SAKIT' || kind === 'DUKA')) {
        const jpeg = await toJpegBuffer(decodeImageUpload(req.body).buffer);
        const dest = await ensureCareVisitFolder(subject.name, new Date().toISOString().slice(0, 10));
        await uploadJpegToFolder(dest.drive, dest.folder.id, jpeg, {
          filename: `kunjungan-${Date.now()}.jpg`,
          publicReader: false,
        });
        driveFolderId = dest.visit?.id || dest.folder.id;
      }

      const row = await prisma.pastoralCareNote.create({
        data: {
          id: newEntityId('pcn'),
          subjectUserId,
          reporterUserId: req.authUser.id,
          kind,
          note,
          status: 'OPEN',
          expiresAt: expiryFor(kind),
          driveFolderId,
        },
        include: {
          subject: { select: { id: true, name: true, avatar: true } },
          reporter: { select: { id: true, name: true } },
        },
      });
      res.status(201).json({ note: serialize(row), photoHint: driveFolderId ? driveThumbUrl(null) : null });
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
      const isSubject = row.subjectUserId === req.authUser.id;
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
      res.json({ note: serialize(updated) });
    }),
  );

  app.get(
    '/api/pastoral-care/people',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.json({ people: [] });
      const people = await prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          NOT: { id: req.authUser.id },
          name: { contains: q },
        },
        select: { id: true, name: true, avatar: true },
        take: 12,
      });
      res.json({ people });
    }),
  );
}
