import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { getPrisma, isDbConfigured, testConnection } from '../server/db.mjs';
import { attachUser, requireRole, setSessionCookie, clearSessionCookie, loginWithGoogleCredential, loginLocal } from '../server/auth.mjs';

const app = express();

app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? Number(value) : value));

app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[api] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

// ---------- Health & Config ----------
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get('/api/config', wrap(async (req, res) => {
  let dbConnected = false;
  if (isDbConfigured()) {
    try { dbConnected = await testConnection(); } catch { dbConnected = false; }
  }
  res.json({
    driveConfigured: false,
    driveMode: null,
    dbConfigured: isDbConfigured(),
    dbConnected,
    rootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || null,
  });
}));

// ---------- Auth: Google SSO ----------
app.get('/api/auth/config', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    configured: Boolean(process.env.GOOGLE_CLIENT_ID) && isDbConfigured(),
  });
});

app.post('/api/auth/google', wrap(async (req, res) => {
  const credential = req.body?.credential;
  if (!credential) return res.status(400).json({ error: 'credential (ID token Google) wajib dikirim.' });
  try {
    const user = await loginWithGoogleCredential(credential);
    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, accountStatus: user.accountStatus, roles: user.roles } });
  } catch (err) {
    console.error('[auth] login gagal:', err.message);
    res.status(401).json({ error: err.message });
  }
}));

app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const u = req.authUser;
  res.json({ user: { id: u.id, email: u.email, name: u.name, avatar: u.avatar, accountStatus: u.accountStatus, roles: u.roles } });
}));

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/admin-check', requireRole('SUPERADMIN'), (req, res) => {
  res.json({ ok: true, email: req.authUser.email });
});

// ---------- Auth: Local (email + password) ----------
app.post('/api/auth/local', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  try {
    const user = await loginLocal(email, password);
    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, accountStatus: user.accountStatus, roles: user.roles } });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}));

// ---------- Demo personas (STAGING ONLY) ----------
const demoEnabled = () => process.env.ENABLE_DEMO_PERSONAS === 'true';

app.get('/api/demo/personas', wrap(async (req, res) => {
  if (!demoEnabled()) return res.status(404).json({ error: 'Demo personas tidak aktif.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const all = await prisma.user.findMany({
    include: { roles: true, _count: { select: { groupMembers: true } } },
    orderBy: { name: 'asc' },
  });
  const CORE = new Set(['SUPERADMIN', 'BPMJ', 'KOMISI']);
  const users = all
    .filter((u) => u._count.groupMembers > 0 || (u.roles || []).some((r) => CORE.has(r.role)))
    .map(({ _count, ...u }) => u);
  res.json({ users });
}));

app.post('/api/demo/impersonate', wrap(async (req, res) => {
  if (!demoEnabled()) return res.status(404).json({ error: 'Demo personas tidak aktif.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const email = String(req.body?.email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
  if (!user) return res.status(404).json({ error: 'Akun dummy tidak ditemukan.' });
  setSessionCookie(res, { uid: user.id, email: user.email });
  res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, accountStatus: user.accountStatus, roles: user.roles } });
}));

// ---------- Profil diri sendiri ----------
app.patch('/api/me', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const b = req.body || {};
  const data = {};
  for (const k of ['phone', 'address', 'origin', 'gender', 'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone', 'emergencyContactAddress', 'profileReminderDays']) {
    if (b[k] !== undefined) data[k] = String(b[k]).slice(0, 1000);
  }
  if (Array.isArray(b.talents)) data.talents = b.talents;
  if (Array.isArray(b.giftsTop5)) data.giftsTop5 = b.giftsTop5;
  if (b.giftsScores && typeof b.giftsScores === 'object') data.giftsScores = b.giftsScores;
  const u = await prisma.user.update({ where: { id: req.authUser.id }, data });
  res.json({ ok: true, name: u.name });
}));

// ---------- Waitlist ----------
function wlPublic(w) {
  return {
    id: w.id, name: w.name, phone: w.phone, email: w.email, origin: w.origin, address: w.address,
    gender: w.gender, emergencyContactName: w.emergencyContactName, emergencyContactRelation: w.emergencyContactRelation,
    emergencyContactPhone: w.emergencyContactPhone, emergencyContactAddress: w.emergencyContactAddress,
    giftsTop5: w.giftsTop5, talents: w.talents, status: w.status, sourceEventId: w.sourceEventId,
    assignedGroupId: w.assignedGroupId, promoteToken: w.promoteToken, createdAt: w.createdAt,
  };
}

app.post('/api/waitlist', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { name, phone, email, origin, sourceEventId, gender, emergencyContactName, emergencyContactRelation, emergencyContactPhone, emergencyContactAddress } = req.body || {};
  if (!name?.trim() || !phone?.trim() || !gender || !emergencyContactName?.trim() || !emergencyContactRelation || !emergencyContactPhone?.trim() || !emergencyContactAddress?.trim()) {
    return res.status(400).json({ error: 'Nama, WhatsApp, jenis kelamin, dan kontak darurat wajib diisi.' });
  }
  const entry = await prisma.waitlistEntry.create({
    data: {
      id: `wl-${crypto.randomUUID()}`,
      name: String(name).trim().slice(0, 150),
      phone: String(phone).trim().slice(0, 40),
      email: email ? String(email).toLowerCase().trim() : null,
      origin: origin ? String(origin).slice(0, 190) : null,
      status: 'WAITLISTED',
      sourceEventId: sourceEventId ? String(sourceEventId).slice(0, 64) : null,
      promoteToken: crypto.randomBytes(24).toString('hex'),
      gender: gender ? String(gender).slice(0, 20) : null,
      emergencyContactName: emergencyContactName ? String(emergencyContactName).trim().slice(0, 150) : null,
      emergencyContactRelation: emergencyContactRelation ? String(emergencyContactRelation).slice(0, 50) : null,
      emergencyContactPhone: emergencyContactPhone ? String(emergencyContactPhone).trim().slice(0, 40) : null,
      emergencyContactAddress: emergencyContactAddress ? String(emergencyContactAddress).trim() : null,
    },
  });
  res.json({ ok: true, entry: wlPublic(entry) });
}));

app.get('/api/waitlist/by-token/:token', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: req.params.token } });
  if (!w) return res.status(404).json({ error: 'Link tidak valid atau sudah kedaluwarsa.' });
  res.json({ entry: wlPublic(w) });
}));

app.patch('/api/waitlist/by-token/:token', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: req.params.token } });
  if (!w) return res.status(404).json({ error: 'Link tidak valid.' });
  const b = req.body || {};
  const updated = await prisma.waitlistEntry.update({
    where: { id: w.id },
    data: {
      address: b.address ?? w.address,
      origin: b.origin ?? w.origin,
      email: b.email ?? w.email,
      gender: b.gender ?? w.gender,
      emergencyContactName: b.emergencyContactName ?? w.emergencyContactName,
      emergencyContactRelation: b.emergencyContactRelation ?? w.emergencyContactRelation,
      emergencyContactPhone: b.emergencyContactPhone ?? w.emergencyContactPhone,
      emergencyContactAddress: b.emergencyContactAddress ?? w.emergencyContactAddress,
      giftsTop5: b.giftsTop5 ?? undefined,
      giftsScores: b.giftsScores ?? undefined,
      talents: b.talents ?? undefined,
      status: w.status === 'WAITLISTED' && (b.address || b.giftsTop5) ? 'PROFILED' : w.status,
    },
  });
  res.json({ ok: true, entry: wlPublic(updated) });
}));

// ---------- Struktur & Groups ----------
app.get('/api/db/struktur', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.strukturMember.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ members });
}));

app.post('/api/db/sync-struktur', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const list = Array.isArray(req.body?.members) ? req.body.members : [];
  for (const [i, m] of list.entries()) {
    if (!m?.id || !m?.name) continue;
    const data = {
      name: m.name,
      position: m.position ?? null,
      division: m.division ?? null,
      subdivision: m.subdivision ?? null,
      period: m.period ?? null,
      photoUrl: m.photoUrl ?? null,
      bio: m.bio ?? null,
      phone: m.phone ?? null,
      email: m.email ?? null,
      sortOrder: Number.isFinite(m.order) ? m.order : i,
      isOpenRole: Boolean(m.isOpenRole ?? m.is_open_role),
      role: m.role ?? null,
      roleOrder: Number.isFinite(m.roleOrder) ? m.roleOrder : 0,
      isDoubleRole: Boolean(m.isDoubleRole ?? false),
      subRoleId: m.subRoleId ?? null,
      groupId: m.groupId ?? null,
    };
    await prisma.strukturMember.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
  }
  const keepIds = list.map((m) => m.id).filter(Boolean);
  const removed = await prisma.strukturMember.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : {},
  });
  res.json({ synced: list.length, removed: removed.count });
}));

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

app.get('/api/db/groups/:id/batches', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const batches = await prisma.groupBatch.findMany({
    where: { groupId: req.params.id },
    orderBy: { period: 'desc' },
  });
  res.json({ batches });
}));

app.get('/api/db/groups/:id/members', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id, ...(req.query.period ? { batchPeriod: req.query.period } : {}) },
    orderBy: [{ batchPeriod: 'desc' }, { name: 'asc' }],
  });
  res.json({ members });
}));

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
