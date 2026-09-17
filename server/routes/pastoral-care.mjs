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
import { sendNotification } from '../lib/notify.mjs';

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
        const groupNotes = rows.filter((r) => r.subjectUserId && memberIds.has(r.subjectUserId)).map(serialize);
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
      const subjectName = String(req.body?.subjectName || '').trim();
      const note = String(req.body?.note || '').trim();
      if (!KINDS.has(kind) || !note) {
        return res.status(400).json({ error: 'Jenis dan catatan wajib.' });
      }
      if (!subjectUserId && !subjectName) {
        return res.status(400).json({ error: 'Pilih jemaat atau tulis nama manual.' });
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
