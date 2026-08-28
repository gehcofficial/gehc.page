import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole, attachUser } from '../server/auth.mjs';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[events] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

const KOMISION = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
const KOMISION_CORE = ['SUPERADMIN', 'KOMISI'];

// ---------- Event Program CRUD ----------
app.get('/api/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const events = await prisma.eventProgram.findMany({
    where: { tenantId: 'tenant-youth' },
    orderBy: { startDate: 'desc' },
  });
  res.json({ events });
}));

app.post('/api/events', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { slug, name, description, status, startDate, endDate, gmeetLink } = req.body || {};
  if (!slug || !name) return res.status(400).json({ error: 'slug dan name wajib diisi.' });

  const existing = await prisma.eventProgram.findUnique({ where: { slug } });
  if (existing) return res.status(409).json({ error: 'Slug sudah dipakai.' });

  const event = await prisma.eventProgram.create({
    data: {
      id: `evt-${crypto.randomUUID()}`,
      tenantId: 'tenant-youth',
      slug,
      name,
      description: description ?? null,
      status: status ?? 'PLANNING',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      gmeetLink: gmeetLink ?? null,
      createdById: req.authUser.id,
    },
  });
  res.json({ ok: true, event });
}));

app.patch('/api/events/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { name, description, status, startDate, endDate, gmeetLink, driveFolderId } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (gmeetLink !== undefined) data.gmeetLink = gmeetLink;
  if (driveFolderId !== undefined) data.driveFolderId = driveFolderId;

  const event = await prisma.eventProgram.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, event });
}));

app.delete('/api/events/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.eventProgram.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Event Divisions ----------
app.get('/api/events/:eventId/divisions', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const divisions = await prisma.eventDivision.findMany({
    where: { eventId: req.params.eventId },
    include: { members: true, updates: { orderBy: { createdAt: 'desc' }, take: 5 }, approvalLogs: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  res.json({ divisions });
}));

app.post('/api/events/:eventId/divisions', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { division, driveFolderId, extraUserIds } = req.body || {};
  if (!division) return res.status(400).json({ error: 'division wajib diisi.' });

  const existing = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId: req.params.eventId, division: division.toUpperCase() } },
  });
  if (existing) return res.status(409).json({ error: 'Divisi sudah ada di event ini.' });

  const div = await prisma.eventDivision.create({
    data: {
      id: `edv-${crypto.randomUUID()}`,
      eventId: req.params.eventId,
      division: division.toUpperCase(),
      driveFolderId: driveFolderId ?? null,
      extraUserIds: extraUserIds ?? null,
      approvalStatus: 'DRAFT',
    },
  });
  res.json({ ok: true, division: div });
}));

app.patch('/api/events/:eventId/divisions/:div', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { driveFolderId, extraUserIds, approvalStatus, approvedById, approvedAt, rejectReason, publishedAt, contentItemId } = req.body || {};
  const data = {};
  if (driveFolderId !== undefined) data.driveFolderId = driveFolderId;
  if (extraUserIds !== undefined) data.extraUserIds = extraUserIds;
  if (approvalStatus !== undefined) data.approvalStatus = approvalStatus;
  if (approvedById !== undefined) data.approvedById = approvedById;
  if (approvedAt !== undefined) data.approvedAt = approvedAt ? new Date(approvedAt) : null;
  if (rejectReason !== undefined) data.rejectReason = rejectReason;
  if (publishedAt !== undefined) data.publishedAt = publishedAt ? new Date(publishedAt) : null;
  if (contentItemId !== undefined) data.contentItemId = contentItemId;

  const div = await prisma.eventDivision.update({
    where: { eventId_division: { eventId: req.params.eventId, division: req.params.div.toUpperCase() } },
    data,
  });
  res.json({ ok: true, division: div });
}));

// ---------- Event Division Members ----------
app.post('/api/events/:eventId/divisions/:div/members', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { userId, role } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId wajib diisi.' });

  const member = await prisma.eventDivisionMember.upsert({
    where: { eventDivId_userId: { eventDivId: `edv-${req.params.eventId}-${req.params.div.toUpperCase()}`, userId } },
    create: { id: `edm-${crypto.randomUUID()}`, eventDivId: `edv-${req.params.eventId}-${req.params.div.toUpperCase()}`, userId, role: role ?? 'MEMBER' },
    update: { role: role ?? 'MEMBER' },
  });
  res.json({ ok: true, member });
}));

app.delete('/api/events/:eventId/divisions/:div/members/:userId', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.eventDivisionMember.delete({
    where: { eventDivId_userId: { eventDivId: `edv-${req.params.eventId}-${req.params.div.toUpperCase()}`, userId: req.params.userId } },
  });
  res.json({ ok: true });
}));

// ---------- Event Meetings ----------
app.get('/api/events/:eventId/meetings', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const meetings = await prisma.eventMeeting.findMany({
    where: { eventId: req.params.eventId },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({ meetings });
}));

app.post('/api/events/:eventId/meetings', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { division, title, scheduledAt, gmeetLink, notes } = req.body || {};
  if (!title || !scheduledAt) return res.status(400).json({ error: 'title dan scheduledAt wajib diisi.' });

  const meeting = await prisma.eventMeeting.create({
    data: {
      id: `em-${crypto.randomUUID()}`,
      eventId: req.params.eventId,
      division: division?.toUpperCase() ?? null,
      title,
      scheduledAt: new Date(scheduledAt),
      gmeetLink: gmeetLink ?? null,
      notes: notes ?? null,
      createdById: req.authUser?.id ?? 'system',
    },
  });
  res.json({ ok: true, meeting });
}));

// ---------- Event Updates (Discussion) ----------
app.get('/api/events/:eventId/divisions/:div/updates', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const div = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId: req.params.eventId, division: req.params.div.toUpperCase() } },
  });
  if (!div) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const updates = await prisma.eventUpdate.findMany({
    where: { eventDivisionId: div.id, parentUpdateId: null },
    orderBy: { createdAt: 'desc' },
    include: { replies: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, avatar: true } } } }, author: { select: { id: true, name: true, avatar: true } } },
  });
  res.json({ updates });
}));

app.post('/api/events/:eventId/divisions/:div/updates', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const div = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId: req.params.eventId, division: req.params.div.toUpperCase() } },
  });
  if (!div) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const { body, parentUpdateId } = req.body || {};
  if (!body?.trim()) return res.status(400).json({ error: 'body wajib diisi.' });

  const update = await prisma.eventUpdate.create({
    data: {
      id: `eu-${crypto.randomUUID()}`,
      eventDivisionId: div.id,
      authorId: req.authUser.id,
      body: body.trim(),
      parentUpdateId: parentUpdateId ?? null,
    },
    include: { author: { select: { id: true, name: true, avatar: true } } },
  });
  res.json({ ok: true, update });
}));

// ---------- Approval Workflow ----------
app.post('/api/events/:eventId/divisions/:div/approve', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { action, comment } = req.body || {};
  if (!['APPROVE', 'REJECT', 'REVISE'].includes(action)) return res.status(400).json({ error: 'action harus APPROVE, REJECT, atau REVISE.' });

  const div = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId: req.params.eventId, division: req.params.div.toUpperCase() } },
  });
  if (!div) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'DRAFT';
  const updated = await prisma.eventDivision.update({
    where: { id: div.id },
    data: {
      approvalStatus: newStatus,
      approvedById: req.authUser.id,
      approvedAt: new Date(),
      rejectReason: action === 'REJECT' ? (comment ?? null) : null,
    },
  });

  await prisma.eventApprovalLog.create({
    data: {
      id: `eal-${crypto.randomUUID()}`,
      eventDivisionId: div.id,
      action,
      actorId: req.authUser.id,
      actorRole: 'KOMISI',
      comment: comment ?? null,
    },
  });

  res.json({ ok: true, division: updated });
}));

app.post('/api/events/:eventId/divisions/:div/publish', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const div = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId: req.params.eventId, division: req.params.div.toUpperCase() } },
  });
  if (!div) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });
  if (div.approvalStatus !== 'APPROVED') return res.status(400).json({ error: 'Hanya divisi APPROVED yang bisa dipublikasikan.' });

  const updated = await prisma.eventDivision.update({
    where: { id: div.id },
    data: { approvalStatus: 'PUBLISHED', publishedAt: new Date() },
  });
  res.json({ ok: true, division: updated });
}));

export default app;