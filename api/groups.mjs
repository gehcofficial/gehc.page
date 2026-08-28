import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured, testConnection as testDb } from '../server/db.mjs';
import { requireRole } from '../server/auth.mjs';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[groups] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

// Family tree semua grup + batch regenerasi
app.get('/api/db/groups', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: {
      batches: { orderBy: { period: 'desc' } },
      members: { orderBy: [{ batchPeriod: 'desc' }, { name: 'asc' }] },
    },
  });
  res.json({ groups });
}));

// History family tree per grup
app.get('/api/db/groups/:id/batches', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const batches = await prisma.groupBatch.findMany({
    where: { groupId: req.params.id },
    orderBy: { period: 'desc' },
  });
  res.json({ batches });
}));

// Anggota/mentee per grup & batch
app.get('/api/db/groups/:id/members', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id, ...(req.query.period ? { batchPeriod: req.query.period } : {}) },
    orderBy: [{ batchPeriod: 'desc' }, { name: 'asc' }],
  });
  res.json({ members });
}));

// Riwayat absensi grup
app.get('/api/db/groups/:id/attendance', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const where = { groupId: req.params.id };
  if (req.query.date) {
    const d = new Date(String(req.query.date));
    if (!Number.isNaN(d.getTime())) where.date = d;
  } else if (req.query.since) {
    const s = new Date(String(req.query.since));
    if (!Number.isNaN(s.getTime())) where.date = { gte: s };
  }
  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { member: { select: { name: true } }, recorder: { select: { name: true } } },
  });
  res.json({ records });
}));

// Sinkronisasi data family tree dari frontend/portal → TiDB
app.post('/api/db/sync-batches', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const batches = Array.isArray(req.body?.batches) ? req.body.batches : [];
  let synced = 0;
  for (const b of batches) {
    await prisma.groupBatch.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        groupId: b.group_id ?? b.groupId,
        period: b.period,
        batchLabel: b.batchLabel ?? b.batch_label,
        mentorName: b.mentor,
        comentorName: b.comentor,
        theme: b.theme,
        isCurrent: Boolean(b.isCurrent),
      },
      update: {
        batchLabel: b.batchLabel ?? b.batch_label,
        mentorName: b.mentor,
        comentorName: b.comentor,
        theme: b.theme,
        isCurrent: Boolean(b.isCurrent),
      },
    });
    synced += 1;
  }
  res.json({ synced });
}));

export default app;