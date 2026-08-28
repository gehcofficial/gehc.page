import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole, attachUser } from '../server/auth.mjs';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[warta] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

const WARTAL_STATUS_FLOW = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['REVIEWED', 'REJECTED'],
  REVIEWED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PUBLISHED'],
  REJECTED: ['DRAFT'],
  PUBLISHED: [],
};

function canTransition(from, to) {
  return WARTAL_STATUS_FLOW[from]?.includes(to) ?? false;
}

// ---------- Warta Publik ----------
app.get('/api/warta', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { status, eventId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (eventId) where.eventId = eventId;

  const warta = await prisma.wartaPublik.findMany({
    where,
    orderBy: { weekDate: 'desc' },
  });
  res.json({ warta });
}));

app.get('/api/warta/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const w = await prisma.wartaPublik.findUnique({ where: { id: req.params.id } });
  if (!w) return res.status(404).json({ error: 'Warta tidak ditemukan.' });
  res.json({ warta: w });
}));

app.post('/api/warta', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'DIDASKALIA'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { eventId, weekDate, title, contentJson, driveFolderId } = req.body || {};
  if (!weekDate || !title) return res.status(400).json({ error: 'weekDate dan title wajib diisi.' });

  const warta = await prisma.wartaPublik.create({
    data: {
      id: `wp-${crypto.randomUUID()}`,
      eventId: eventId ?? null,
      weekDate: new Date(weekDate),
      title,
      status: 'DRAFT',
      contentJson: contentJson ?? null,
      driveFolderId: driveFolderId ?? null,
      createdById: req.authUser.id,
    },
  });
  res.json({ ok: true, warta });
}));

app.patch('/api/warta/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'DIDASKALIA'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { weekDate, title, contentJson, driveFolderId } = req.body || {};
  const data = {};
  if (weekDate !== undefined) data.weekDate = new Date(weekDate);
  if (title !== undefined) data.title = title;
  if (contentJson !== undefined) data.contentJson = contentJson;
  if (driveFolderId !== undefined) data.driveFolderId = driveFolderId;

  const warta = await prisma.wartaPublik.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, warta });
}));

app.delete('/api/warta/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.wartaPublik.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Status Flow ----------
app.post('/api/warta/:id/transition', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'DIDASKALIA', 'KOINONIA', 'MARTURIA'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { toStatus, reason } = req.body || {};
  if (!toStatus) return res.status(400).json({ error: 'toStatus wajib diisi.' });

  const warta = await prisma.wartaPublik.findUnique({ where: { id: req.params.id } });
  if (!warta) return res.status(404).json({ error: 'Warta tidak ditemukan.' });

  if (!canTransition(warta.status, toStatus)) {
    return res.status(400).json({ error: `Transisi dari ${warta.status} ke ${toStatus} tidak diperbolehkan.` });
  }

  const role = req.authUser.roles?.[0]?.role || '';
  const isDidaskalia = role === 'DIDASKALIA';
  const isKoinonia = role === 'KOINONIA';
  const isMarturia = role === 'MARTURIA';
  const isKomisi = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'].includes(role);

  // Validasi role-based transition
  if (warta.status === 'DRAFT' && toStatus === 'SUBMITTED' && !isDidaskalia) {
    return res.status(403).json({ error: 'Hanya DIDASKALIA yang bisa SUBMIT.' });
  }
  if (warta.status === 'SUBMITTED' && toStatus === 'REVIEWED' && !isKoinonia) {
    return res.status(403).json({ error: 'Hanya KOINONIA yang bisa REVIEW.' });
  }
  if (warta.status === 'REVIEWED' && toStatus === 'APPROVED' && !isMarturia) {
    return res.status(403).json({ error: 'Hanya MARTURIA yang bisa APPROVE.' });
  }
  if (toStatus === 'PUBLISHED' && !isMarturia) {
    return res.status(403).json({ error: 'Hanya MARTURIA yang bisa PUBLISH.' });
  }
  if (toStatus === 'REJECTED' && !isKomisi) {
    return res.status(403).json({ error: 'Hanya KOMISI yang bisa REJECT.' });
  }

  const data = { status: toStatus };
  if (toStatus === 'REJECTED') data.rejectReason = reason ?? null;
  if (toStatus === 'PUBLISHED') data.publishedAt = new Date();
  if (toStatus === 'REVIEWED') data.reviewedById = req.authUser.id;

  const updated = await prisma.wartaPublik.update({
    where: { id: req.params.id },
    data,
  });

  try {
    const { notifyNewWarta } = await import('../server/push.mjs');
    await notifyNewWarta(updated.id, updated.title, toStatus);
  } catch { /* ignore */ }

  res.json({ ok: true, warta: updated });
}));

export default app;