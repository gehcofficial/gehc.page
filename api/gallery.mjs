import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole, attachUser } from '../server/auth.mjs';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[gallery] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

const ALLOWED_MEDIA_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT'];

// ---------- Event Gallery ----------
app.get('/api/gallery', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { eventId, division, status } = req.query;
  const where = {};
  if (eventId) where.eventId = eventId;
  if (division) where.division = division.toUpperCase();
  if (status) where.status = status.toUpperCase();

  const gallery = await prisma.eventGallery.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ gallery });
}));

app.get('/api/gallery/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const g = await prisma.eventGallery.findUnique({ where: { id: req.params.id } });
  if (!g) return res.status(404).json({ error: 'Galeri tidak ditemukan.' });
  res.json({ gallery: g });
}));

app.post('/api/gallery', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MARTURIA'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { eventId, title, description, mediaUrl, mediaType, thumbUrl, division, driveFileId, sortOrder } = req.body || {};
  if (!eventId || !title || !mediaUrl || !mediaType) {
    return res.status(400).json({ error: 'eventId, title, mediaUrl, mediaType wajib diisi.' });
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType.toUpperCase())) {
    return res.status(400).json({ error: 'mediaType tidak valid.' });
  }

  const gallery = await prisma.eventGallery.create({
    data: {
      id: `eg-${crypto.randomUUID()}`,
      eventId,
      title,
      description: description ?? null,
      mediaUrl,
      mediaType: mediaType.toUpperCase(),
      thumbUrl: thumbUrl ?? null,
      uploadedById: req.authUser.id,
      division: division?.toUpperCase() ?? null,
      status: 'PENDING',
      driveFileId: driveFileId ?? null,
      sortOrder: Number(sortOrder) ?? 0,
    },
  });

  try {
    const { notifyNewGallery } = await import('../server/push.mjs');
    await notifyNewGallery(gallery.id, gallery.title);
  } catch { /* ignore */ }

  res.json({ ok: true, gallery });
}));

app.patch('/api/gallery/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MARTURIA'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { title, description, mediaUrl, mediaType, thumbUrl, division, driveFileId, sortOrder } = req.body || {};
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (mediaUrl !== undefined) data.mediaUrl = mediaUrl;
  if (mediaType !== undefined) {
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType.toUpperCase())) return res.status(400).json({ error: 'mediaType tidak valid.' });
    data.mediaType = mediaType.toUpperCase();
  }
  if (thumbUrl !== undefined) data.thumbUrl = thumbUrl;
  if (division !== undefined) data.division = division?.toUpperCase() ?? null;
  if (driveFileId !== undefined) data.driveFileId = driveFileId;
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

  const gallery = await prisma.eventGallery.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, gallery });
}));

app.delete('/api/gallery/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.eventGallery.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Approval ----------
app.post('/api/gallery/:id/approve', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { action, reason } = req.body || {};
  if (!['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: 'action harus APPROVE atau REJECT.' });
  }

  const gallery = await prisma.eventGallery.findUnique({ where: { id: req.params.id } });
  if (!gallery) return res.status(404).json({ error: 'Galeri tidak ditemukan.' });
  if (gallery.status !== 'PENDING') {
    return res.status(400).json({ error: 'Hanya item PENDING yang bisa di-approve/reject.' });
  }

  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const updated = await prisma.eventGallery.update({
    where: { id: req.params.id },
    data: {
      status: newStatus,
      approvedById: req.authUser.id,
      approvedAt: new Date(),
      rejectReason: action === 'REJECT' ? (reason ?? null) : null,
    },
  });
  res.json({ ok: true, gallery: updated });
}));

export default app;