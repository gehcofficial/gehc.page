import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole } from '../server/auth.mjs';

const app = express();
app.use(express.json({ limit: '2mb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[mentor-transitions] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

// GET: List mentor transitions for a group
app.get('/api/groups/:id/mentor-transitions', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const transitions = await prisma.mentorTransition.findMany({
    where: { groupId: req.params.id },
    orderBy: { effectiveDate: 'desc' },
    include: {
      outgoingUser: { select: { id: true, name: true, email: true, avatar: true } },
      incomingUser: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  res.json({ transitions });
}));

// POST: Create mentor transition (resignation, batch change, etc.)
app.post('/api/groups/:id/mentor-transitions', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { outgoingUserId, incomingUserId, outgoingRole, incomingRole, effectiveDate, reason, note } = req.body || {};
  if (!outgoingUserId || !outgoingRole || !effectiveDate) {
    return res.status(400).json({ error: 'outgoingUserId, outgoingRole, dan effectiveDate wajib diisi.' });
  }

  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Grup tidak ditemukan.' });

  const outgoingUser = await prisma.user.findUnique({ where: { id: outgoingUserId } });
  if (!outgoingUser) return res.status(404).json({ error: 'Outgoing user tidak ditemukan.' });

  let incomingUser = null;
  if (incomingUserId) {
    incomingUser = await prisma.user.findUnique({ where: { id: incomingUserId } });
    if (!incomingUser) return res.status(404).json({ error: 'Incoming user tidak ditemukan.' });
  }

  const transition = await prisma.mentorTransition.create({
    data: {
      id: `mt-${crypto.randomUUID()}`,
      groupId: req.params.id,
      outgoingUserId,
      incomingUserId: incomingUserId ?? null,
      outgoingRole,
      incomingRole: incomingRole ?? null,
      effectiveDate: new Date(effectiveDate),
      reason: reason ?? null,
      note: note ?? null,
      createdById: req.authUser.id,
    },
    include: {
      outgoingUser: { select: { id: true, name: true, email: true, avatar: true } },
      incomingUser: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!incomingUserId) {
    await prisma.strukturMember.updateMany({
      where: { userId: outgoingUserId, role: outgoingRole },
      data: { role: 'MENTEE', roleOrder: 99 },
    });
  }

  if (incomingUserId && incomingRole) {
    await prisma.strukturMember.upsert({
      where: { id: `sm-${incomingUserId}-${req.params.id}` },
      create: {
        id: `sm-${incomingUserId}-${req.params.id}`,
        userId: incomingUserId,
        name: incomingUser.name,
        position: incomingRole === 'MENTOR' ? 'Mentor' : 'Co-Mentor',
        division: 'MENTOR',
        subdivision: group.name,
        role: incomingRole,
        roleOrder: incomingRole === 'MENTOR' ? 10 : 20,
        isDoubleRole: false,
        groupId: req.params.id,
      },
      update: {
        role: incomingRole,
        roleOrder: incomingRole === 'MENTOR' ? 10 : 20,
        groupId: req.params.id,
      },
    });
  }

  res.json({ ok: true, transition });
}));

// PATCH: Update mentor transition
app.patch('/api/mentor-transitions/:transitionId', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { incomingUserId, incomingRole, effectiveDate, reason, note } = req.body || {};
  const transition = await prisma.mentorTransition.update({
    where: { id: req.params.transitionId },
    data: {
      incomingUserId: incomingUserId ?? undefined,
      incomingRole: incomingRole ?? undefined,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      reason: reason ?? undefined,
      note: note ?? undefined,
    },
    include: {
      outgoingUser: { select: { id: true, name: true, email: true, avatar: true } },
      incomingUser: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  res.json({ ok: true, transition });
}));

// POST: Resign mentor/co-mentor (convenience endpoint)
app.post('/api/groups/:id/mentor-resign', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { userId, effectiveDate, reason } = req.body || {};
  if (!userId || !effectiveDate) {
    return res.status(400).json({ error: 'userId dan effectiveDate wajib diisi.' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const sm = await prisma.strukturMember.findFirst({
    where: { userId, groupId: req.params.id, role: { in: ['MENTOR', 'CO_MENTOR'] } },
  });
  const outgoingRole = sm?.role || 'MENTOR';

  const transition = await prisma.mentorTransition.create({
    data: {
      id: `mt-${crypto.randomUUID()}`,
      groupId: req.params.id,
      outgoingUserId: userId,
      incomingUserId: null,
      outgoingRole,
      incomingRole: null,
      effectiveDate: new Date(effectiveDate),
      reason: reason ?? 'Pengunduran diri',
      note: null,
      createdById: req.authUser.id,
    },
  });

  await prisma.strukturMember.updateMany({
    where: { userId, groupId: req.params.id, role: { in: ['MENTOR', 'CO_MENTOR'] } },
    data: { role: 'MENTEE', roleOrder: 99 },
  });

  res.json({ ok: true, transition });
}));

// DELETE: Delete mentor transition
app.delete('/api/mentor-transitions/:transitionId', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  await prisma.mentorTransition.delete({ where: { id: req.params.transitionId } });
  res.json({ ok: true });
}));

export default app;