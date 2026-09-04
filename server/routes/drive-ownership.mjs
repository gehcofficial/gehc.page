/**
 * Drive ownership: slot visual, cover kelompok, album, arsip acara, BZP, kesaksian.
 */
import { getPrisma } from '../db.mjs';
import { requireRole, isSuperadminEmail } from '../auth.mjs';
import { getDriveMode, getFolderChain } from '../gdrive.mjs';
import { resolveAccess } from '../gdrive-policy.mjs';
import { decodeImageUpload, toJpegBuffer } from '../lib/drive-jpeg.mjs';
import {
  assertSlotWrite,
  houseStem,
  isMentorOfGroup,
  isMemberOfGroup,
  isMarturiaStory,
  isMarturiaDocs,
  isBzpStaff,
  newEntityId,
} from '../lib/drive-ownership.mjs';
import { isKomisiOrSuperadmin as komisiGate } from '../division-rbac.mjs';
import { replaceVisualStem, backupToOpsFolder, scheduleVisualsPublish } from '../lib/visual-slot-write.mjs';
import {
  requireUserDrive,
  ensureNamedFolder,
  uploadJpegToFolder,
  listFolderFiles,
  setPublicReader,
  driveThumbUrl,
  driveViewUrl,
  albumFolderName,
  isImageFile,
} from '../lib/drive-folders.mjs';
import {
  ensureGroupTree,
  ensureBzpProductFolder,
  ensureBzpOrderFolder,
  ensureTestimonialInbox,
  ensureEventArchiveFolder,
} from '../lib/drive-ensure.mjs';
import { slugifyName } from '../lib/website-visuals.mjs';

const PHOTO_KINDS = new Set(['PA', 'WORSHIP', 'ADHOC']);

function previewList(ids) {
  const arr = Array.isArray(ids) ? ids : [];
  return arr.slice(0, 5).filter(Boolean).map((id) => ({
    id,
    thumbnailUrl: driveThumbUrl(id),
    webViewLink: driveViewUrl(id),
  }));
}

async function jpegFromBody(body, { square = false, maxWidth = 1600 } = {}) {
  const decoded = decodeImageUpload(body || {});
  return toJpegBuffer(decoded.buffer, { square, maxWidth });
}

function serializeAlbum(row, { includeDrive = false } = {}) {
  const previews = previewList(row.previewFileIds);
  return {
    id: row.id,
    groupId: row.groupId,
    title: row.title,
    kind: row.kind,
    occurredOn: row.occurredOn,
    location: row.location,
    eventId: row.eventId,
    coverUrl: row.coverDriveFileId ? driveThumbUrl(row.coverDriveFileId) : previews[0]?.thumbnailUrl || null,
    previews,
    driveFolderId: includeDrive ? row.driveFolderId : undefined,
    driveUrl: includeDrive && row.driveFolderId
      ? `https://drive.google.com/drive/folders/${row.driveFolderId}`
      : undefined,
  };
}

export function registerEventArchivePublicRoute(app, { wrap }) {
  app.get(
    '/api/events/public-archive',
    wrap(async (_req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ events: [] });
      const rows = await prisma.eventProgram.findMany({
        where: {
          OR: [{ status: 'ARCHIVED' }, { status: 'DONE' }, { archiveFolderId: { not: null } }],
        },
        orderBy: { startDate: 'desc' },
        take: 40,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          startDate: true,
          eventDate: true,
          archiveFolderId: true,
          previewFileIds: true,
        },
      });
      res.json({
        events: rows.map((e) => {
          const when = e.eventDate || e.startDate;
          const iso = when ? new Date(when).toISOString() : '';
          const mmYyyy = iso ? `${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '';
          return {
            id: e.id,
            name: e.name,
            slug: e.slug,
            status: e.status,
            period: mmYyyy,
            previews: previewList(e.previewFileIds),
            hasArchive: Boolean(e.archiveFolderId),
          };
        }),
      });
    }),
  );
}

export function registerDriveOwnershipRoutes(app, { wrap }) {
  app.post(
    '/api/media/slots/:folder/:stem',
    requireRole(),
    wrap(async (req, res) => {
      const folder = decodeURIComponent(String(req.params.folder || ''));
      const stem = decodeURIComponent(String(req.params.stem || ''));
      const extra = { groupId: req.body?.groupId, userId: req.authUser.id };
      await assertSlotWrite(req.authUser, folder, stem, extra);
      const jpeg = await jpegFromBody(req.body, { square: folder === 'kelompok' || folder === 'panca' });
      const written = await replaceVisualStem({ folder, stem, jpegBuffer: jpeg });
      if (req.body?.opsFolderId) {
        await backupToOpsFolder({
          folderId: req.body.opsFolderId,
          jpegBuffer: jpeg,
          filename: `${stem}-${Date.now()}.jpg`,
        });
      }
      res.json({ ok: true, ...written });
    }),
  );

  app.post(
    '/api/drive/ops/upload',
    requireRole(),
    wrap(async (req, res) => {
      const folderId = String(req.body?.folderId || '').trim();
      if (!folderId) return res.status(400).json({ error: 'folderId wajib.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      const chain = await getFolderChain(folderId);
      const verdict = await resolveAccess(chain, req.authUser);
      if (!verdict.allowed) return res.status(403).json({ error: verdict.reason });
      const jpeg = await jpegFromBody(req.body, { square: Boolean(req.body?.square) });
      const drive = await requireUserDrive();
      const filename = String(req.body?.filename || `foto-${Date.now()}.jpg`).replace(/\.[^.]+$/, '') + '.jpg';
      const file = await uploadJpegToFolder(drive, folderId, jpeg, {
        filename,
        publicReader: Boolean(req.body?.publicReader),
      });
      res.json({
        ok: true,
        fileId: file.id,
        name: file.name,
        thumbnailUrl: driveThumbUrl(file.id),
        webViewLink: file.webViewLink,
      });
    }),
  );

  app.post(
    '/api/groups/:id/cover',
    requireRole('SUPERADMIN', 'KOMISI', 'MENTOR', 'CO_MENTOR'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const group = await prisma.group.findUnique({ where: { id: req.params.id } });
      if (!group) return res.status(404).json({ error: 'Kelompok tidak ditemukan.' });
      await assertSlotWrite(req.authUser, 'kelompok', houseStem(group.name), { groupId: group.id });
      const jpeg = await jpegFromBody(req.body, { square: true, maxWidth: 1400 });
      const written = await replaceVisualStem({
        folder: 'kelompok',
        stem: houseStem(group.name),
        jpegBuffer: jpeg,
      });
      let backup = null;
      try {
        const tree = await ensureGroupTree(group.name);
        backup = await backupToOpsFolder({
          folderId: tree.folders.Cover?.id,
          jpegBuffer: jpeg,
          filename: `${houseStem(group.name)}-${Date.now()}.jpg`,
        });
      } catch (err) {
        console.warn('[group-cover] backup:', err.message);
      }
      res.json({ ok: true, ...written, backup });
    }),
  );

  app.get(
    '/api/groups/:id/albums',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ albums: [] });
      const group = await prisma.group.findUnique({ where: { id: req.params.id } });
      if (!group) return res.status(404).json({ error: 'Kelompok tidak ditemukan.' });
      const rows = await prisma.groupAlbum.findMany({
        where: { groupId: group.id },
        orderBy: { occurredOn: 'desc' },
      });
      const includeDrive = Boolean(req.authUser) && isMemberOfGroup(req.authUser, group.id);
      res.json({ albums: rows.map((r) => serializeAlbum(r, { includeDrive })) });
    }),
  );

  app.post(
    '/api/groups/:id/albums',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const group = await prisma.group.findUnique({ where: { id: req.params.id } });
      if (!group) return res.status(404).json({ error: 'Kelompok tidak ditemukan.' });
      if (!isMentorOfGroup(req.authUser, group.id) && !komisiGate(req.authUser)) {
        return res.status(403).json({ error: 'Hanya mentor/co rumah ini yang boleh membuat album.' });
      }
      const title = String(req.body?.title || '').trim();
      const occurredOn = String(req.body?.occurredOn || '').slice(0, 10);
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
        return res.status(400).json({ error: 'Judul dan tanggal (YYYY-MM-DD) wajib.' });
      }
      const kind = PHOTO_KINDS.has(String(req.body?.kind || '').toUpperCase())
        ? String(req.body.kind).toUpperCase()
        : 'ADHOC';
      const tree = await ensureGroupTree(group.name);
      const foto = tree.folders['Foto Kegiatan'];
      const albumFolder = await ensureNamedFolder(tree.drive, foto.id, albumFolderName(occurredOn, title));
      const row = await prisma.groupAlbum.create({
        data: {
          id: newEntityId('alb'),
          groupId: group.id,
          title,
          kind,
          occurredOn: new Date(`${occurredOn}T00:00:00.000Z`),
          location: req.body?.location ? String(req.body.location).trim() : null,
          eventId: req.body?.eventId || null,
          driveFolderId: albumFolder.id,
          createdById: req.authUser.id,
        },
      });
      res.status(201).json({ album: serializeAlbum(row, { includeDrive: true }) });
    }),
  );

  app.post(
    '/api/groups/:id/albums/:albumId/photos',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const album = await prisma.groupAlbum.findUnique({ where: { id: req.params.albumId } });
      if (!album || album.groupId !== req.params.id) return res.status(404).json({ error: 'Album tidak ditemukan.' });
      if (!isMemberOfGroup(req.authUser, album.groupId)) {
        return res.status(403).json({ error: 'Hanya anggota rumah ini yang boleh unggah.' });
      }
      if (!album.driveFolderId) return res.status(400).json({ error: 'Folder Drive album belum ada.' });
      const jpeg = await jpegFromBody(req.body);
      const drive = await requireUserDrive();
      const file = await uploadJpegToFolder(drive, album.driveFolderId, jpeg, {
        filename: `${Date.now()}-${req.authUser.id.slice(0, 8)}.jpg`,
        publicReader: false,
      });
      res.json({
        ok: true,
        fileId: file.id,
        thumbnailUrl: driveThumbUrl(file.id),
        webViewLink: file.webViewLink,
      });
    }),
  );

  app.patch(
    '/api/groups/:id/albums/:albumId/previews',
    requireRole('SUPERADMIN', 'KOMISI', 'MENTOR', 'CO_MENTOR'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const album = await prisma.groupAlbum.findUnique({ where: { id: req.params.albumId } });
      if (!album || album.groupId !== req.params.id) return res.status(404).json({ error: 'Album tidak ditemukan.' });
      if (!isMentorOfGroup(req.authUser, album.groupId)) {
        return res.status(403).json({ error: 'Hanya mentor/co yang menyematkan preview.' });
      }
      const ids = (Array.isArray(req.body?.previewFileIds) ? req.body.previewFileIds : [])
        .map(String)
        .filter(Boolean)
        .slice(0, 5);
      const drive = await requireUserDrive();
      for (const id of ids) await setPublicReader(drive, id);
      const coverDriveFileId = ids[0] || album.coverDriveFileId;
      const updated = await prisma.groupAlbum.update({
        where: { id: album.id },
        data: { previewFileIds: ids, coverDriveFileId },
      });
      res.json({ album: serializeAlbum(updated, { includeDrive: true }) });
    }),
  );

  app.get(
    '/api/groups/:id/albums/:albumId/files',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const album = await prisma.groupAlbum.findUnique({ where: { id: req.params.albumId } });
      if (!album || album.groupId !== req.params.id) return res.status(404).json({ error: 'Album tidak ditemukan.' });
      if (!isMemberOfGroup(req.authUser, album.groupId)) {
        return res.status(403).json({ error: 'Login sebagai anggota untuk melihat isi Drive.' });
      }
      if (!album.driveFolderId) return res.json({ files: [], driveUrl: null });
      const drive = await requireUserDrive().catch(() => null);
      const files = drive
        ? (await listFolderFiles(drive, album.driveFolderId)).filter(isImageFile).map((f) => ({
            id: f.id,
            name: f.name,
            thumbnailUrl: driveThumbUrl(f.id),
            webViewLink: f.webViewLink,
          }))
        : [];
      res.json({
        files,
        driveUrl: `https://drive.google.com/drive/folders/${album.driveFolderId}`,
      });
    }),
  );

  app.post(
    '/api/me/testimonial',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const quote = String(req.body?.quote || '').trim();
      if (!quote) return res.status(400).json({ error: 'Kutipan wajib.' });
      let inboxDriveFileId = null;
      let photoUrl = req.authUser.avatar || null;
      if (req.body?.data) {
        const jpeg = await jpegFromBody(req.body);
        const inbox = await ensureTestimonialInbox(req.authUser.id);
        const file = await uploadJpegToFolder(inbox.drive, inbox.folder.id, jpeg, {
          filename: `draft-${Date.now()}.jpg`,
          publicReader: false,
        });
        inboxDriveFileId = file.id;
        photoUrl = driveThumbUrl(file.id);
      }
      const item = await prisma.testimonial.create({
        data: {
          id: newEntityId('tst'),
          tenantId: 'tenant-youth',
          authorName: req.authUser.name || 'Jemaat',
          groupName: req.body?.groupName || null,
          quote,
          photoUrl,
          userId: req.authUser.id,
          isPublished: false,
          status: 'DRAFT',
          inboxDriveFileId,
        },
      });
      res.status(201).json({ item });
    }),
  );

  app.get(
    '/api/me/testimonials',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ items: [] });
      const items = await prisma.testimonial.findMany({
        where: { userId: req.authUser.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ items });
    }),
  );

  app.patch(
    '/api/testimonials/:id/review',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!(await isMarturiaStory(req.authUser)) && !komisiGate(req.authUser)) {
        return res.status(403).json({ error: 'Hanya Marturia Kesaksian atau Komisi.' });
      }
      const prisma = getPrisma();
      const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Tidak ditemukan.' });
      if (existing.isPublished) return res.status(400).json({ error: 'Sudah terbit — sunting lewat CMS.' });
      const data = { status: 'REVIEW' };
      if (req.body?.quote) data.quote = String(req.body.quote).trim();
      if (req.body?.groupName !== undefined) data.groupName = req.body.groupName || null;
      if (req.body?.authorName) data.authorName = String(req.body.authorName).trim();
      const item = await prisma.testimonial.update({ where: { id: existing.id }, data });
      res.json({ item });
    }),
  );

  app.post(
    '/api/testimonials/:id/publish',
    requireRole('SUPERADMIN', 'KOMISI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Tidak ditemukan.' });
      const stem = slugifyName(existing.authorName) || existing.id;
      if (existing.inboxDriveFileId || req.body?.data) {
        let jpeg;
        if (req.body?.data) jpeg = await jpegFromBody(req.body);
        if (jpeg) {
          await replaceVisualStem({ folder: 'testimoni', stem, jpegBuffer: jpeg });
        }
      }
      const item = await prisma.testimonial.update({
        where: { id: existing.id },
        data: { isPublished: true, status: 'PUBLISHED' },
      });
      scheduleVisualsPublish('testimoni');
      res.json({ item });
    }),
  );

  app.get(
    '/api/events/:id/archive-link',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const ev = await prisma.eventProgram.findUnique({ where: { id: req.params.id } });
      if (!ev?.archiveFolderId) return res.status(404).json({ error: 'Arsip Drive belum didaftarkan.' });
      res.json({ driveUrl: `https://drive.google.com/drive/folders/${ev.archiveFolderId}` });
    }),
  );

  app.post(
    '/api/events/:id/archive',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!(await isMarturiaDocs(req.authUser)) && !komisiGate(req.authUser)) {
        return res.status(403).json({ error: 'Hanya Marturia Dokumentasi atau Komisi.' });
      }
      const prisma = getPrisma();
      const ev = await prisma.eventProgram.findUnique({ where: { id: req.params.id } });
      if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const occurred = ev.eventDate || ev.startDate || new Date();
      const iso = new Date(occurred).toISOString().slice(0, 10);
      const { folder } = await ensureEventArchiveFolder(iso, ev.name);
      const ids = (Array.isArray(req.body?.previewFileIds) ? req.body.previewFileIds : [])
        .map(String)
        .filter(Boolean)
        .slice(0, 5);
      if (ids.length) {
        const drive = await requireUserDrive();
        for (const id of ids) await setPublicReader(drive, id);
      }
      const updated = await prisma.eventProgram.update({
        where: { id: ev.id },
        data: { archiveFolderId: folder.id, previewFileIds: ids.length ? ids : ev.previewFileIds },
      });
      res.json({
        event: {
          id: updated.id,
          archiveFolderId: updated.archiveFolderId,
          previews: previewList(updated.previewFileIds),
          driveUrl: `https://drive.google.com/drive/folders/${folder.id}`,
        },
      });
    }),
  );

  app.post(
    '/api/benzar/products/:id/images',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!(await isBzpStaff(req.authUser))) return res.status(403).json({ error: 'Hanya BZP.' });
      const prisma = getPrisma();
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
      const jpeg = await jpegFromBody(req.body);
      const dest = await ensureBzpProductFolder(product.category, product.id);
      const file = await uploadJpegToFolder(dest.drive, dest.folder.id, jpeg, {
        filename: `${Date.now()}.jpg`,
        publicReader: true,
      });
      const images = Array.isArray(product.images) ? [...product.images] : [];
      images.push({ driveFileId: file.id, url: driveThumbUrl(file.id) });
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { images },
      });
      res.json({ product: updated });
    }),
  );

  app.post(
    '/api/benzar/orders/:id/payment-proof',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      const staff = await isBzpStaff(req.authUser);
      if (order.userId !== req.authUser.id && !staff && !komisiGate(req.authUser)) {
        return res.status(403).json({ error: 'Bukan pesanan Anda.' });
      }
      const jpeg = await jpegFromBody(req.body);
      const dest = await ensureBzpOrderFolder(order.orderCode);
      const file = await uploadJpegToFolder(dest.drive, dest.folder.id, jpeg, {
        filename: `bukti-tf-${Date.now()}.jpg`,
        publicReader: false,
      });
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { paymentProofDriveFileId: file.id, status: order.status === 'PENDING' ? 'PAID' : order.status },
      });
      res.json({
        order: {
          id: updated.id,
          status: updated.status,
          paymentProofDriveFileId: updated.paymentProofDriveFileId,
        },
      });
    }),
  );

  app.get(
    '/api/benzar/orders/:id/files',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      const staff = await isBzpStaff(req.authUser);
      if (order.userId !== req.authUser.id && !staff && !komisiGate(req.authUser)) {
        return res.status(403).json({ error: 'Bukan pesanan Anda.' });
      }
      res.json({
        paymentProofUrl: order.paymentProofDriveFileId ? driveViewUrl(order.paymentProofDriveFileId) : null,
        invoiceUrl: order.invoiceDriveFileId ? driveViewUrl(order.invoiceDriveFileId) : null,
      });
    }),
  );

  app.get(
    '/api/portal/birthdays/upcoming',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ birthdays: [] });
      const days = Math.min(14, Math.max(1, Number(req.query.days || 7)));
      const users = await prisma.user.findMany({
        where: { birthDate: { not: null }, accountStatus: 'ACTIVE' },
        select: { id: true, name: true, avatar: true, birthDate: true },
        take: 400,
      });
      const now = new Date();
      const list = users
        .map((u) => {
          const b = new Date(u.birthDate);
          const next = new Date(Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
          if (next < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) {
            next.setUTCFullYear(next.getUTCFullYear() + 1);
          }
          const diff = Math.round((next - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
          return { id: u.id, name: u.name, avatar: u.avatar, daysToBirthday: diff };
        })
        .filter((u) => u.daysToBirthday >= 0 && u.daysToBirthday <= days)
        .sort((a, b) => a.daysToBirthday - b.daysToBirthday)
        .slice(0, 24);
      res.json({ birthdays: list });
    }),
  );

  app.get(
    '/api/portal/calendar',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ layers: {} });
      const year = Number(req.query.year) || new Date().getFullYear();
      const from = new Date(`${year}-01-01T00:00:00.000Z`);
      const to = new Date(`${year}-12-31T23:59:59.000Z`);
      const roles = (req.authUser.roles || []).map((r) => r.role);
      const pengurus = roles.some((r) => ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'].includes(r))
        || isSuperadminEmail(req.authUser.email);

      const churchWhere = pengurus
        ? { startDate: { gte: from, lte: to } }
        : { startDate: { gte: from, lte: to }, isPublic: true };
      const church = await prisma.churchCalendarEntry.findMany({
        where: churchWhere,
        orderBy: { startDate: 'asc' },
        take: 300,
      });
      const toISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
      const churchEntries = church.map((e) => ({
        id: e.id,
        startDate: toISO(e.startDate),
        endDate: toISO(e.endDate),
        name: e.name,
        layer: e.source === 'LITURGICAL' ? 'liturgis' : e.level === 'SINODE' ? 'sinode' : 'jemaat',
        source: e.source,
        level: e.level,
      }));

      const groupIds = (req.authUser.roles || []).map((r) => r.groupId).filter(Boolean);
      const albumWhere = pengurus
        ? { occurredOn: { gte: from, lte: to } }
        : groupIds.length
          ? { groupId: { in: groupIds }, occurredOn: { gte: from, lte: to } }
          : { id: '__none__' };
      const albums = await prisma.groupAlbum.findMany({
        where: albumWhere,
        include: { group: { select: { name: true } } },
        take: 80,
      }).catch(() => []);

      const events = await prisma.eventProgram.findMany({
        where: {
          OR: [
            { startDate: { gte: from, lte: to } },
            { eventDate: { gte: from, lte: to } },
          ],
        },
        select: { id: true, name: true, startDate: true, eventDate: true, status: true },
        take: 80,
      });

      res.json({
        year,
        layers: {
          sinode: churchEntries.filter((e) => e.layer === 'sinode'),
          jemaat: churchEntries.filter((e) => e.layer === 'jemaat'),
          liturgis: churchEntries.filter((e) => e.layer === 'liturgis'),
          timKerja: events.map((e) => ({
            id: e.id,
            startDate: toISO(e.eventDate || e.startDate),
            name: e.name,
            layer: 'tim-kerja',
          })),
          kelompok: albums.map((a) => ({
            id: a.id,
            startDate: toISO(a.occurredOn),
            name: `${a.group?.name || ''}: ${a.title}`.trim(),
            layer: 'kelompok',
            groupId: a.groupId,
          })),
        },
      });
    }),
  );
}
