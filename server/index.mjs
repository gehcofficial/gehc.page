import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { getDriveMode, listFolders, listFiles, getFileStream, testConnection as testDrive, getFolderChain, listFolderTree } from './gdrive.mjs';
import { resolveAccess, matrixForUser, parseTag } from './gdrive-policy.mjs';
import { getPrisma, isDbConfigured, testConnection as testDb } from './db.mjs';
import {
  attachUser,
  requireRole,
  setSessionCookie,
  clearSessionCookie,
  loginWithGoogleCredential,
  verifyGoogleCredential,
  hashPassword,
  verifyPassword,
  loginLocal,
  isSuperadminEmail,
} from './auth.mjs';
import {
  getDashboard,
  runScan,
  recommendPlacement,
  executeSplit,
  executeMerge,
  shuffleRole,
  markAlumni,
} from './engine.mjs';
import { narrateDashboard } from './jethro-ai.mjs';

const app = express();
const PORT = Number(process.env.PORT || 8787);

// Prisma memakai BigInt untuk id autoincrement — konversi otomatis ke Number saat serialisasi JSON.
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

// Contoh proteksi endpoint RBAC (dipakai fitur portal lanjutan):
app.get('/api/auth/admin-check', requireRole('SUPERADMIN'), (req, res) => {
  res.json({ ok: true, email: req.authUser.email });
});

// GET /api/users/search?q=... — search users for @mention
app.get('/api/users/search', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });

    // Enrich with division info from struktur_members
    const enriched = await Promise.all(
      users.map(async (u) => {
        let division = null;
        try {
          const sm = await prisma.strukturMember.findFirst({ where: { email: u.email || '' } });
          if (sm?.division) division = sm.division;
        } catch { /* skip */ }
        return { ...u, division };
      })
    );

    res.json({ users: enriched });
  } catch (e) {
    res.json({ users: [] });
  }
}));

// GET /api/users — list all users (for admin panels)
app.get('/api/users', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatar: true, accountStatus: true },
    orderBy: { name: 'asc' },
  });

  res.json({ users });
}));

// ---------- Notifications ----------
// GET /api/notifications — get current user's notifications
app.get('/api/notifications', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    // Get notifications where user is mentioned (payload.authorId != user AND user is mentioned)
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          // MENTION notifications where user was mentioned
          {
            type: 'MENTION',
            status: 'OPEN',
            // Check if the mentioned user ID is in the payload or title contains user name
          },
          // Other notification types
          {
            type: { not: 'MENTION' },
            status: 'OPEN',
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Filter MENTION notifications to only show ones relevant to current user
    const filtered = notifications.filter((n) => {
      if (n.type !== 'MENTION') return true;
      const payload = n.payload || {};
      // Show if user was mentioned (not the author)
      return payload.authorId !== req.authUser.id;
    });

    const unread = filtered.filter((n) => n.status === 'OPEN').length;
    res.json({ notifications: filtered, unread });
  } catch (e) {
    res.json({ notifications: [], unread: 0 });
  }
}));

// PATCH /api/notifications/:id/read — mark as read
app.patch('/api/notifications/:id/read', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { status: 'ACKNOWLEDGED', resolvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal update notifikasi.' });
  }
}));

// POST /api/notifications/read-all — mark all as read
app.post('/api/notifications/read-all', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    await prisma.notification.updateMany({
      where: { status: 'OPEN' },
      data: { status: 'ACKNOWLEDGED', resolvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal update notifikasi.' });
  }
}));

// ---------- Division Analytics ----------
// GET /api/events/:eventId/analytics — get analytics for an event
app.get('/api/events/:eventId/analytics', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId } = req.params;

  try {
    const divisions = await prisma.eventDivision.findMany({
      where: { eventId },
      include: {
        members: true,
        updates: true,
        approvalLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    const meetings = await prisma.eventMeeting.findMany({
      where: { eventId },
    });

    const stats = {
      totalDivisions: divisions.length,
      totalMembers: divisions.reduce((sum, d) => sum + d.members.length, 0),
      totalUpdates: divisions.reduce((sum, d) => sum + d.updates.length, 0),
      totalMeetings: meetings.length,
      statusBreakdown: {
        DRAFT: divisions.filter((d) => d.approvalStatus === 'DRAFT').length,
        IN_REVIEW: divisions.filter((d) => d.approvalStatus === 'IN_REVIEW').length,
        APPROVED: divisions.filter((d) => d.approvalStatus === 'APPROVED').length,
        REJECTED: divisions.filter((d) => d.approvalStatus === 'REJECTED').length,
        PUBLISHED: divisions.filter((d) => d.approvalStatus === 'PUBLISHED').length,
      },
      divisionStats: divisions.map((d) => ({
        division: d.division,
        status: d.approvalStatus,
        members: d.members.length,
        updates: d.updates.length,
        lastActivity: d.updates.length > 0
          ? d.updates[d.updates.length - 1].createdAt
          : d.createdAt,
      })),
      recentActivity: divisions
        .flatMap((d) =>
          d.updates.map((u) => ({
            ...u,
            division: d.division,
          }))
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    };

    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat analytics: ${e.message}` });
  }
}));

// GET /api/events/:eventId/divisions/:div/analytics — get analytics for a specific division
app.get('/api/events/:eventId/divisions/:div/analytics', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;

  try {
    const division = await prisma.eventDivision.findUnique({
      where: { eventId_division: { eventId, division: div.toUpperCase() } },
      include: {
        members: true,
        updates: true,
        approvalLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

    const meetings = await prisma.eventMeeting.findMany({
      where: { eventId, division: div.toUpperCase() },
    });

    const stats = {
      division: div.toUpperCase(),
      status: division.approvalStatus,
      totalMembers: division.members.length,
      totalUpdates: division.updates.length,
      totalMeetings: meetings.length,
      memberRoles: {
        LEAD: division.members.filter((m) => m.role === 'LEAD').length,
        CO_LEAD: division.members.filter((m) => m.role === 'CO_LEAD').length,
        MEMBER: division.members.filter((m) => m.role === 'MEMBER').length,
        VIEWER: division.members.filter((m) => m.role === 'VIEWER').length,
      },
      recentUpdates: division.updates.slice(-5),
      recentApprovals: division.approvalLogs.slice(0, 5),
    };

    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat analytics: ${e.message}` });
  }
}));

// ---------- Demo personas (STAGING ONLY) ----------
// Aktif hanya jika ENABLE_DEMO_PERSONAS=true — JANGAN pernah diaktifkan di produksi.
const demoEnabled = () => process.env.ENABLE_DEMO_PERSONAS === 'true';

app.get('/api/demo/personas', wrap(async (req, res) => {
  if (!demoEnabled()) return res.status(404).json({ error: 'Demo personas tidak aktif.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const all = await prisma.user.findMany({
    include: { roles: true, _count: { select: { groupMembers: true } } },
    orderBy: { name: 'asc' },
  });
  // Ramping: hanya akun inti (L1-L3) + yang ter-link kelompok (mentor/co-mentor/
  // mentee/alumni). PIC sub-divisi & penopang tetap ada di DB namun tak memenuhi UI.
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

// ---------- Health & Config ----------
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get('/api/config', wrap(async (req, res) => {
  let dbConnected = false;
  if (isDbConfigured()) {
    try { dbConnected = await testDb(); } catch { dbConnected = false; }
  }
  res.json({
    driveConfigured: Boolean(getDriveMode()),
    driveMode: getDriveMode(),
    dbConfigured: isDbConfigured(),
    dbConnected,
    rootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || null,
  });
}));

// ---------- Google Drive (role-gated via gdrive-policy) ----------
async function guardDriveFolder(req, res, folderId) {
  if (!getDriveMode()) {
    res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    return null;
  }
  const chain = await getFolderChain(folderId);
  const verdict = await resolveAccess(chain, req.authUser);
  if (!verdict.allowed) {
    res.status(403).json({ error: `Akses ditolak: ${verdict.reason}`, tag: verdict.tag });
    return null;
  }
  return chain;
}

const DRIVE_ROOT = () => process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

app.get('/api/drive/folders', wrap(async (req, res) => {
  const target = req.query.parentId || DRIVE_ROOT();
  try {
    if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    // Listing = discovery: SEMUA folder boleh ditelusuri, tapi anak difilter
    // berdasarkan kebijakan masing-masing (nama folder terlarang tidak bocor).
    // Akses konten tetap ketat di /api/drive/files & /file/:id/content.
    const folders = await listFolders(req.query.parentId);
    const enriched = [];
    for (const f of folders) {
      const childChain = await getFolderChain(f.id);
      const v = await resolveAccess(childChain, req.authUser);
      enriched.push({
        ...f,
        accessAllowed: v.allowed,
        zoneTag: v.tag,
        reason: v.reason,
      });
    }
    // Visibilitas: (a) tag mengizinkan, ATAU (b) user login boleh menelusuri
    // sebagai kontainer untuk menemukan anak ber-scoping ([GROUP:x]).
    // Tamu hanya melihat rantai yang benar-benar publik.
    res.json({ folders: enriched.filter((f) => f.accessAllowed || Boolean(req.authUser)) });
  } catch (err) {
    const s = typeof err?.status === 'number' && err.status >= 400 ? err.status : 502;
    res.status(s).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

app.get('/api/drive/files', wrap(async (req, res) => {
  const target = req.query.folderId || DRIVE_ROOT();
  try {
    // Root tanpa tag: file langsung di root dianggap non-publik (default deny)
    if (!(await guardDriveFolder(req, res, target))) return;
    const files = await listFiles({
      folderId: req.query.folderId,
      query: req.query.q,
      pageSize: Number(req.query.pageSize || 24),
    });
    res.json({ files });
  } catch (err) {
    res.status(502).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

// Galeri grup publik — kurasi khusus: tamu tidak perlu menelusuri parent
// [MENTOR]; policy dievaluasi pada folder tujuan (tag GROUP terdekat menang).
app.get('/api/drive/group-files/:groupName', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  const groupName = String(req.params.groupName || '').trim();
  if (!groupName) return res.status(400).json({ error: 'Nama grup wajib diisi.' });
  try {
    // 1) Folder kontainer "Kelompok Mentoring [MENTOR]" di root.
    const rootFolders = await listFolders();
    const container = rootFolders.find((f) => /^kelompok mentoring/i.test(f.name));
    if (!container) return res.status(404).json({ error: 'Folder Kelompok Mentoring tidak ditemukan.' });

    // 2) Folder grup: tag [GROUP:<NAMA>] atau nama mengandung [nama].
    const kids = await listFolders(container.id);
    const target = kids.find(
      (k) =>
        (parseTag(k.name) || '').toUpperCase() === `GROUP:${groupName.toUpperCase()}` ||
        k.name.toLowerCase().includes(`[${groupName.toLowerCase()}]`)
    );
    if (!target) return res.status(404).json({ error: `Folder galeri untuk grup "${groupName}" belum dibuat.` });

    // 3) Policy pada folder tujuan — nearest tag wins, GROUP mengizinkan tamu baca.
    const chain = await getFolderChain(target.id);
    const verdict = await resolveAccess(chain, req.authUser);
    if (!verdict.allowed) return res.status(403).json({ error: verdict.reason });

    const files = await listFiles({ folderId: target.id, pageSize: 24 });
    res.json({ folder: { id: target.id, name: target.name }, files });
  } catch (err) {
    res.status(502).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

app.get('/api/drive/file/:id/content', wrap(async (req, res) => {
  if (!(await guardDriveFolder(req, res, req.params.id))) return;
  const { meta, stream } = await getFileStream(req.params.id);
  if (meta.mimeType) res.setHeader('Content-Type', meta.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  stream.pipe(res);
}));

app.get('/api/drive/test', wrap(async (req, res) => {
  res.json({ connected: await testDrive(), mode: getDriveMode() });
}));

// Matriks akses zona untuk user saat ini (UI audit ManageIntegrations)
app.get('/api/drive/policy', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  res.json({ matrix: matrixForUser(req.authUser), authenticated: Boolean(req.authUser) });
}));

// Audit sinkronisasi DB ↔ Drive: grup & subdivisi pantatugas vs folder aktual
app.get('/api/drive/audit', requireRole('SUPERADMIN'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const tree = await listFolderTree(3);
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // Warisan tag: anak mewarisi zona induk terdekat (logika sama dgn gdrive-policy)
  const byId = new Map(tree.map((f) => [f.id, f]));
  const inheritedTag = (f) => {
    const own = f.name.match(/\[([A-Z][^\]]*)\]/i)?.[1];
    if (own) return own.toUpperCase();
    let p = f.parentId ? byId.get(f.parentId) : null;
    while (p) {
      const t = p.name.match(/\[([A-Z][^\]]*)\]/i)?.[1];
      if (t) return t.toUpperCase();
      p = p.parentId ? byId.get(p.parentId) : null;
    }
    return null;
  };

  // (a) Grup aktif → folder [GROUP:<nama>]
  const groups = await prisma.group.findMany({ where: { status: 'ACTIVE' }, select: { name: true } });
  const groupFolders = tree.filter((f) => /\[GROUP:[^\]]+\]/i.test(f.name));
  const matchedGroupTokens = new Set(
    groupFolders.map((f) => (f.name.match(/\[GROUP:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase())
  );
  const groupAudit = groups.map((g) => ({
    name: g.name,
    ok: matchedGroupTokens.has(g.name.toLowerCase()),
    hint: `[GROUP:${g.name.toUpperCase()}]`,
  }));
  const extraGroups = groupFolders.filter((f) => {
    const tok = (f.name.match(/\[GROUP:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase();
    return !groups.some((g) => g.name.toLowerCase() === tok);
  }).map((f) => f.name);

  // (b) Subdivisi pantatugas → folder di bawah folder induk bernama <Pillar>
  const subs = await prisma.strukturMember.findMany({
    where: { division: { in: ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] }, NOT: { subdivision: null } },
    select: { division: true, subdivision: true },
  });
  const pillarParents = new Map(); // pillarLabel(lower) → array nama folder anak
  for (const f of tree) {
    const m = f.name.match(/^(.*?)\s*\[[^\]]+\]$/);
    if (!m) continue;
    const base = norm(m[1]);
    for (const p of ['liturgia', 'didaskalia', 'koinonia', 'diakonia', 'marturia']) {
      if (base === p) {
        if (!pillarParents.has(p)) pillarParents.set(p, new Set());
        break;
      }
    }
  }
  for (const f of tree) {
    if (!f.parentId) continue;
    const parent = tree.find((t) => t.id === f.parentId);
    if (!parent) continue;
    const pm = parent.name.match(/^(.*?)\s*\[[^\]]+\]$/);
    if (!pm) continue;
    const key = norm(pm[1]);
    if (pillarParents.has(key)) pillarParents.get(key).add(norm(f.name.replace(/\[[^\]]+\]/g, '').trim()));
  }
  const seen = new Map();
  for (const s of subs) {
    const key = s.division.toLowerCase();
    const set = seen.get(key) || new Set();
    set.add(norm(s.subdivision));
    seen.set(key, set);
  }
  const pillarAudit = [];
  for (const [pillar, expectedSet] of seen.entries()) {
    const actual = pillarParents.get(pillar) || new Set();
    for (const sub of expectedSet) {
      pillarAudit.push({ pillar, name: sub, ok: actual.has(sub) });
    }
  }

  const untagged = tree.filter((f) => !inheritedTag(f)).map((f) => f.name);

  res.json({
    generatedAt: new Date().toISOString(),
    totalFoldersScanned: tree.length,
    groups: { items: groupAudit, missing: groupAudit.filter((g) => !g.ok).length },
    pillars: { items: pillarAudit, missing: pillarAudit.filter((p) => !p.ok).length },
    extraGroupFolders: extraGroups,
    untaggedFolders: untagged.slice(0, 30),
  });
}));

// ---------- TiDB Cloud (Prisma) ----------
app.get('/api/db/status', wrap(async (req, res) => {
  const connected = await testDb();
  res.json({ configured: isDbConfigured(), connected });
}));

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

// Riwayat absensi grup (opsional filter ?date= atau ?since=)
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

// Sinkronisasi data family tree dari frontend/portal → TiDB (upsert per id)
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

// ---------- Division Drive Browser ----------
import { createFolder as gdriveCreateFolder, uploadFile as gdriveUploadFile, deleteFile as gdriveDeleteFile, getFileInfo as gdriveGetFileInfo } from './gdrive.mjs';

// GET /api/events/:eventId/divisions/:div/drive — list files in division's Drive folder
app.get('/api/events/:eventId/divisions/:div/drive', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  if (!division.driveFolderId) {
    return res.json({ files: [], folders: [], folderId: null, message: 'Belum ada folder Drive untuk divisi ini.' });
  }

  try {
    const [files, folders] = await Promise.all([
      listFiles({ folderId: division.driveFolderId, pageSize: 50 }),
      listFolders(division.driveFolderId, 50),
    ]);
    res.json({ files, folders, folderId: division.driveFolderId });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat Drive: ${e.message}` });
  }
}));

// POST /api/events/:eventId/divisions/:div/drive/folder — create subfolder
app.post('/api/events/:eventId/divisions/:div/drive/folder', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  const { eventId, div } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name wajib.' });

  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  if (!division.driveFolderId) {
    return res.status(400).json({ error: 'Divisi belum memiliki folder Drive.' });
  }

  try {
    const folder = await gdriveCreateFolder(division.driveFolderId, name);
    res.status(201).json({ folder });
  } catch (e) {
    res.status(500).json({ error: `Gagal membuat folder: ${e.message}` });
  }
}));

// POST /api/events/:eventId/divisions/:div/drive/upload — upload file
app.post('/api/events/:eventId/divisions/:div/drive/upload', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  if (process.env.GDRIVE_WRITE !== '1') return res.status(403).json({ error: 'Upload belum diaktifkan (GDRIVE_WRITE != 1).' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  if (!division.driveFolderId) {
    return res.status(400).json({ error: 'Divisi belum memiliki folder Drive.' });
  }

  // Expect multipart form data — use multer or manual parse
  // For now, expect JSON with base64 file data
  const { filename, mimetype, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename dan data wajib.' });

  try {
    const buffer = Buffer.from(data, 'base64');
    const file = await gdriveUploadFile(division.driveFolderId, {
      originalname: filename,
      mimetype: mimetype || 'application/octet-stream',
      buffer,
    });
    res.status(201).json({ file });
  } catch (e) {
    res.status(500).json({ error: `Gagal upload: ${e.message}` });
  }
}));

// DELETE /api/drive/files/:fileId — delete file/folder
app.delete('/api/drive/files/:fileId', requireRole('SUPERADMIN', 'KOMISI'), wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  if (process.env.GDRIVE_WRITE !== '1') return res.status(403).json({ error: 'Delete belum diaktifkan (GDRIVE_WRITE != 1).' });

  try {
    await gdriveDeleteFile(req.params.fileId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: `Gagal menghapus: ${e.message}` });
  }
}));

// GET /api/drive/files/:fileId — get file info
app.get('/api/drive/files/:fileId', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  try {
    const info = await gdriveGetFileInfo(req.params.fileId);
    res.json({ file: info });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat info file: ${e.message}` });
  }
}));

// ---------- Event Workspace Migration (ad hoc) ----------
app.post('/api/migrate/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL tidak tersedia.' });

  // Jalankan perintah DDL per baris — aman untuk tabel baru.
  const ddl = [
    "CREATE TABLE IF NOT EXISTS `EventProgram` (`id` VARCHAR(64) NOT NULL,`tenant_id` VARCHAR(16) NOT NULL,`slug` VARCHAR(60) NOT NULL,`name` VARCHAR(160) NOT NULL,`description` TEXT NULL,`status` VARCHAR(16) NOT NULL DEFAULT 'PLANNING',`start_date` DATETIME(3) NULL,`end_date` DATETIME(3) NULL,`drive_folder_id` VARCHAR(128) NULL,`gmeet_link` VARCHAR(512) NULL,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, UNIQUE INDEX `EventProgram_slug_key`(`slug`), INDEX `EventProgram_tenant_id_idx`(`tenant_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventDivision` (`id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NOT NULL,`division` VARCHAR(24) NOT NULL,`drive_folder_id` VARCHAR(128) NULL,`extra_user_ids` JSON NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `EventDivision_event_id_division_key`(`event_id`, `division`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventMeeting` (`id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NOT NULL,`division` VARCHAR(24) NULL,`title` VARCHAR(200) NOT NULL,`scheduled_at` DATETIME(3) NOT NULL,`gmeet_link` VARCHAR(512) NULL,`notes` TEXT NULL,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `EventMeeting_event_id_idx`(`event_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventUpdate` (`id` VARCHAR(64) NOT NULL,`event_division_id` VARCHAR(64) NOT NULL,`author_id` VARCHAR(64) NOT NULL,`body` TEXT NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `EventUpdate_event_division_id_idx`(`event_division_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `EventDivision` ADD CONSTRAINT `EventDivision_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `EventProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `EventMeeting` ADD CONSTRAINT `EventMeeting_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `EventProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `EventUpdate` ADD CONSTRAINT `EventUpdate_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    // Phase 1: Approval workflow columns
    "ALTER TABLE `EventDivision` ADD COLUMN `approval_status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT' AFTER `extra_user_ids`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `approved_by_id` VARCHAR(64) NULL AFTER `approval_status`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `approved_at` DATETIME(3) NULL AFTER `approved_by_id`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `reject_reason` TEXT NULL AFTER `approved_at`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `published_at` DATETIME(3) NULL AFTER `reject_reason`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `content_item_id` VARCHAR(64) NULL AFTER `published_at`, ADD UNIQUE INDEX `EventDivision_content_item_id_key`(`content_item_id`);",
    "ALTER TABLE `EventDivision` ADD INDEX `EventDivision_approval_status_idx`(`approval_status`);",
    // Phase 1: New tables — EventDivisionMember, EventApprovalLog
    "CREATE TABLE IF NOT EXISTS `EventDivisionMember` (`id` VARCHAR(64) NOT NULL,`event_division_id` VARCHAR(64) NOT NULL,`user_id` VARCHAR(64) NOT NULL,`role` VARCHAR(16) NOT NULL DEFAULT 'MEMBER',`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `EventDivisionMember_event_division_id_user_id_key`(`event_division_id`, `user_id`), INDEX `EventDivisionMember_user_id_idx`(`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventApprovalLog` (`id` VARCHAR(64) NOT NULL,`event_division_id` VARCHAR(64) NOT NULL,`action` VARCHAR(20) NOT NULL,`actor_id` VARCHAR(64) NOT NULL,`actor_role` VARCHAR(30) NOT NULL,`comment` TEXT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `EventApprovalLog_event_division_id_idx`(`event_division_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `EventDivisionMember` ADD CONSTRAINT `EventDivisionMember_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `EventApprovalLog` ADD CONSTRAINT `EventApprovalLog_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    // Phase 3: Reply threading for discussions
    "ALTER TABLE `EventUpdate` ADD COLUMN `parent_update_id` VARCHAR(64) NULL AFTER `body`;",
    "ALTER TABLE `EventUpdate` ADD INDEX `EventUpdate_parent_update_id_idx`(`parent_update_id`);",
    // Phase 7: MENTION notification type (enum value added in schema)
    "ALTER TABLE `Notification` MODIFY COLUMN `type` ENUM('IDLE_FLAG','MITOSIS_ALERT','MERGER_SUGGESTION','MENTION') NOT NULL;",
    // Benzarpreneurship E-commerce: Products, Orders, OrderItems
    "CREATE TABLE IF NOT EXISTS `products` (`id` VARCHAR(64) NOT NULL,`name` VARCHAR(200) NOT NULL,`description` TEXT NULL,`price` INT NOT NULL,`stock` INT NOT NULL DEFAULT 0,`images` JSON NULL,`category` VARCHAR(20) NOT NULL,`is_active` BOOLEAN NOT NULL DEFAULT true,`sort_order` INT NOT NULL DEFAULT 0,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `products_category_active_idx`(`category`, `is_active`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `orders` (`id` VARCHAR(64) NOT NULL,`order_code` VARCHAR(20) NOT NULL,`user_id` VARCHAR(64) NOT NULL,`items` JSON NOT NULL,`total` INT NOT NULL,`status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',`shipping` VARCHAR(16) NOT NULL DEFAULT 'PICKUP',`shipping_addr` JSON NULL,`notes` TEXT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `orders_order_code_key`(`order_code`), INDEX `orders_user_id_status_idx`(`user_id`, `status`), INDEX `orders_status_idx`(`status`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `order_items` (`id` VARCHAR(64) NOT NULL,`order_id` VARCHAR(64) NOT NULL,`product_id` VARCHAR(64) NOT NULL,`qty` INT NOT NULL,`price` INT NOT NULL,`name` VARCHAR(200) NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `order_items_order_id_product_id_key`(`order_id`, `product_id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE;",
  ];

  let applied = 0;
  const errors = [];
  for (const stmt of ddl) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      applied++;
    } catch (e) {
      // Tabel/index sudah ada → skip
      if (!String(e.message || '').includes('already exists')) {
        errors.push({ stmt: stmt.slice(0, 80) + '...', error: String(e.message || e).slice(0, 120) });
      } else {
        applied++;
      }
    }
  }
  const result = { applied, errors, total: ddl.length };

  // Auto-seed: jika tabel kosong, buat BAKU TAU 4.0 dengan 6 divisi
  try {
    const count = await prisma.eventProgram.count();
    if (count === 0) {
      const slug = 'baku-tau-4-0';
      const id = 'evt-baku-tau-4-0';
      const ev = await prisma.eventProgram.create({
        data: {
          id,
          tenantId: 'tenant-youth',
          slug,
          name: 'BAKU TAU 4.0',
          description: 'Program Kerja & Event Tahunan GEHC 2026 — 6 divisi, kick-off & diskusi aktif.',
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          createdById: 'usr-tech',
        },
      });
      // 6 divisi: 5 Panca Tugas + Benzarpreneurship
      const divisions = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
      for (const div of divisions) {
        await prisma.eventDivision.create({
          data: {
            id: `evd-${slug}-${div}`,
            eventId: ev.id,
            division: div,
            approvalStatus: 'APPROVED',
            approvedById: 'usr-tech',
            approvedAt: new Date(),
            publishedAt: new Date(),
          },
        });
      }
      // Kick-off meeting
      await prisma.eventMeeting.create({
        data: {
          id: `evtmt-${slug}-kickoff`,
          eventId: ev.id,
          title: 'Kick-Off BAKU TAU 4.0',
          scheduledAt: new Date('2026-01-15T09:00:00+07:00'),
          notes: 'Pertemuan awal seluruh divisi — preview program tahunan.',
          createdById: 'usr-tech',
        },
      });
      result.seeded = { event: ev.id, divisions: divisions.length, meetings: 1 };
    }
  } catch (e) {
    result.seedError = String(e.message || e).slice(0, 120);
  }

  res.json(result);
}));

// POST /api/seed/events — seed BAKU TAU 4.0 via raw SQL (idempotent)
app.post('/api/seed/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    // Cek apakah sudah ada event
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM EventProgram`);
    const cnt = Number(rows[0]?.cnt ?? 0);
    if (cnt > 0) {
      // Show existing
      const existing = await prisma.$queryRawUnsafe(`SELECT id, name, status FROM EventProgram`);
      return res.json({ ok: true, message: `Sudah ada ${cnt} event, skip seed.`, existing });
    }

    // Insert BAKU TAU 4.0
    await prisma.$executeRawUnsafe(
      `INSERT INTO EventProgram (id, tenant_id, slug, name, description, status, start_date, end_date, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      'evt-baku-tau-4-0', 'tenant-youth', 'baku-tau-4-0', 'BAKU TAU 4.0',
      'Program Kerja & Event Tahunan GEHC 2026 — 6 divisi, kick-off & diskusi aktif.',
      'ACTIVE', '2026-01-01', '2026-12-31', 'usr-tech'
    );

    // 6 divisi: 5 Panca Tugas + Benzarpreneurship
    const divisions = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
    for (const div of divisions) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO EventDivision (id, event_id, division, approval_status, approved_by_id, approved_at, published_at, created_at)
         VALUES (?, ?, ?, 'APPROVED', 'usr-tech', NOW(3), NOW(3), NOW(3))`,
        `evd-baku-tau-4-0-${div}`, 'evt-baku-tau-4-0', div
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO EventMeeting (id, event_id, title, scheduled_at, notes, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
      'evtmt-baku-tau-4-0-kickoff', 'evt-baku-tau-4-0',
      'Kick-Off BAKU TAU 4.0', '2026-01-15T09:00:00',
      'Pertemuan awal seluruh divisi — preview program tahunan.', 'usr-tech'
    );

    res.json({ ok: true, seeded: { event: 'evt-baku-tau-4-0', divisions: divisions.length, meetings: 1 } });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}));

// ---------- Event Workspace ----------
// Slug util: lower-case hyphen, max 50 char
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// Helper: divisi yang bisa diakses user berdasarkan struktur_members
async function canSeeEventDivision(authUser, division) {
  if (!authUser) return false;
  const roles = (authUser.roles || []).map((r) => r.role);
  if (roles.includes('SUPERADMIN') || roles.includes('KOMISI')) return true;

  // COMMITTEE — bedakan BOD vs PIC
  if (roles.includes('COMMITTEE')) {
    const prisma = getPrisma();
    const sm = prisma ? await prisma.strukturMember.findFirst({ where: { email: authUser.email || '' } }) : null;
    const smDiv = (sm?.division || '').toUpperCase();
    // BOD = struktur division TIMKERJA (atau kosong) → semua event
    if (!smDiv || smDiv === 'TIMKERJA') return true;
    // PIC → scoped
    return smDiv === division;
  }

  // MENTOR / CO_MENTOR / MENTEE → cek struktur
  const prisma = getPrisma();
  const sm = prisma ? await prisma.strukturMember.findFirst({ where: { email: authUser.email || '' } }) : null;
  return (sm?.division || '').toUpperCase() === division;
}

// GET /api/events — daftar event (filtered by visibility)
app.get('/api/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  let events;
  try {
    events = await prisma.eventProgram.findMany({
      orderBy: { startDate: 'desc' },
      include: { divisions: true, meetings: true },
    });
  } catch (prismaErr) {
    // Fallback: Prisma model belum ada → raw SQL
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT e.*,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('id',d.id,'eventId',d.event_id,'division',d.division,'driveFolderId',d.drive_folder_id,'approvalStatus',d.approval_status,'publishedAt',d.published_at,'createdAt',d.created_at))
           FROM EventDivision d WHERE d.event_id = e.id) as divisions,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('id',m.id,'title',m.title,'scheduledAt',m.scheduled_at,'division',m.division))
           FROM EventMeeting m WHERE m.event_id = e.id) as meetings
         FROM EventProgram e ORDER BY e.start_date DESC`
      );
      events = (rows || []).map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        status: r.status,
        startDate: r.start_date,
        endDate: r.end_date,
        driveFolderId: r.drive_folder_id,
        gmeetLink: r.gmeet_link,
        createdById: r.created_by_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        divisions: Array.isArray(r.divisions) ? r.divisions.map((d) => ({
          id: d.id, eventId: d.eventId, division: d.division, driveFolderId: d.driveFolderId,
          approvalStatus: d.approvalStatus, publishedAt: d.publishedAt, createdAt: d.createdAt,
        })) : [],
        meetings: Array.isArray(r.meetings) ? r.meetings.map((m) => ({
          id: m.id, title: m.title, scheduledAt: m.scheduledAt, division: m.division,
        })) : [],
      }));
    } catch (sqlErr) {
      // Tabel belum ada → return empty (bukan error)
      const msg = String(sqlErr.message || sqlErr);
      if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('Table') || msg.includes('Undefined table')) {
        return res.json({ events: [] });
      }
      return res.status(500).json({ error: `Event query gagal: ${msg.slice(0, 200)}` });
    }
  }

  // Filter berdasarkan role
  const roles = (req.authUser?.roles || []).map((r) => r.role);
  const isKomsaOrBod = roles.includes('SUPERADMIN') || roles.includes('KOMISI');
  let isBodTimkerja = false;
  try {
    isBodTimkerja = roles.includes('COMMITTEE') && await (async () => {
      const sm = await prisma.strukturMember.findFirst({ where: { email: req.authUser?.email || '' } });
      return !(sm?.division) || sm.division.toUpperCase() === 'TIMKERJA';
    })();
  } catch { /* strukturMember query failed, skip */ }

  if (isKomsaOrBod || isBodTimkerja) {
    return res.json({ events });
  }

  // Filter: hanya event yang punya division yang bisa diakses user
  const accessible = [];
  try {
    for (const ev of events) {
      for (const d of ev.divisions) {
        if (await canSeeEventDivision(req.authUser, d.division)) {
          accessible.push(ev);
          break;
        }
      }
    }
  } catch(e) { /* canSeeEventDivision failed, return empty */ }
  res.json({ events: accessible });
}));

// POST /api/events — buat event baru + provision folder
app.post('/api/events', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { name, description, divisions, startDate, endDate } = req.body || {};
  if (!name || !Array.isArray(divisions) || divisions.length === 0) {
    return res.status(400).json({ error: 'name dan divisions[] wajib.' });
  }

  const slug = slugify(name) + '-' + Date.now().toString(36);
  const id = `evt-${slug}`;
  const createdById = req.authUser?.id || 'unknown';

  const ev = await prisma.eventProgram.create({
    data: {
      id,
      tenantId: 'tenant-youth',
      slug,
      name,
      description: description || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdById,
    },
  });

  // Buat divisi + provision folder di Drive
  const provisioned = [];
  for (const div of divisions) {
    const divId = `evd-${slug}-${div}`;
    await prisma.eventDivision.create({
      data: {
        id: divId,
        eventId: ev.id,
        division: div,
      },
    });
    // Provision Drive folder jika write mode aktif
    if (process.env.GDRIVE_WRITE === '1' && process.env.GDRIVE_ROOT_FOLDER_ID) {
      try {
        const { createEventFolder } = await import('./gdrive-events.mjs');
        const fid = await createEventFolder(ev, div);
        if (fid) {
          await prisma.eventDivision.update({ where: { id: divId }, data: { driveFolderId: fid } });
          provisioned.push({ division: div, folderId: fid });
        }
      } catch (e) {
        console.warn(`[event] provisioning ${div} gagal:`, e.message);
      }
    }
  }

  res.status(201).json({ event: ev, provisioned });
}));

// GET /api/events/:id — detail event + divisi
app.get('/api/events/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  let ev;
  try {
    ev = await prisma.eventProgram.findUnique({
      where: { id: req.params.id },
      include: { divisions: true, meetings: { orderBy: { scheduledAt: 'desc' } } },
    });
  } catch (prismaErr) {
    // Fallback: raw SQL
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM EventProgram WHERE id = ?`, req.params.id
      );
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const r = rows[0];
      const divRows = await prisma.$queryRawUnsafe(
        `SELECT * FROM EventDivision WHERE event_id = ?`, r.id
      );
      const mtRows = await prisma.$queryRawUnsafe(
        `SELECT * FROM EventMeeting WHERE event_id = ? ORDER BY scheduled_at DESC`, r.id
      );
      ev = {
        id: r.id, tenantId: r.tenant_id, slug: r.slug, name: r.name, description: r.description,
        status: r.status, startDate: r.start_date, endDate: r.end_date,
        driveFolderId: r.drive_folder_id, gmeetLink: r.gmeet_link,
        createdById: r.created_by_id, createdAt: r.created_at, updatedAt: r.updated_at,
        divisions: (divRows || []).map((d) => ({
          id: d.id, eventId: d.event_id, division: d.division, driveFolderId: d.drive_folder_id,
          extraUserIds: d.extra_user_ids, approvalStatus: d.approval_status,
          approvedById: d.approved_by_id, approvedAt: d.approved_at,
          rejectReason: d.reject_reason, publishedAt: d.published_at,
          contentItemId: d.content_item_id, createdAt: d.created_at,
        })),
        meetings: (mtRows || []).map((m) => ({
          id: m.id, eventId: m.event_id, division: m.division, title: m.title,
          scheduledAt: m.scheduled_at, gmeetLink: m.gmeet_link, notes: m.notes,
          createdById: m.created_by_id, createdAt: m.created_at,
        })),
      };
    } catch (sqlErr) {
      const msg = String(sqlErr.message || sqlErr);
      if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('Table') || msg.includes('Undefined table')) {
        return res.status(404).json({ error: 'Event tidak ditemukan.' });
      }
      return res.status(500).json({ error: `Event detail gagal: ${msg.slice(0, 200)}` });
    }
  }
  if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
  res.json({ event: ev });
}));

// PATCH /api/events/:id — edit meta + divisions
app.patch('/api/events/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { name, description, startDate, endDate, status, divisions } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (status !== undefined) data.status = status;

  const ev = await prisma.eventProgram.update({ where: { id: req.params.id }, data });
  res.json({ event: ev });
}));

// POST /api/events/:id/divisions/:div/updates — tambah diskusi/progres (supports replies)
app.post('/api/events/:id/divisions/:div/updates', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { body: text, parentUpdateId } = req.body || {};
  if (!text) return res.status(400).json({ error: 'body wajib.' });

  const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: req.params.id, division: req.params.div.toUpperCase() } } });
  if (!div) return res.status(404).json({ error: 'Divisi event tidak ditemukan.' });

  const canSee = await canSeeEventDivision(req.authUser, req.params.div.toUpperCase());
  if (!canSee) return res.status(403).json({ error: 'Tidak punya akses ke divisi ini.' });

  // Validate parent if reply
  if (parentUpdateId) {
    const parent = await prisma.eventUpdate.findUnique({ where: { id: parentUpdateId } });
    if (!parent || parent.eventDivisionId !== div.id) {
      return res.status(400).json({ error: 'Parent update tidak valid.' });
    }
  }

  const update = await prisma.eventUpdate.create({
    data: {
      id: `evu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      eventDivisionId: div.id,
      authorId: req.authUser?.id || 'unknown',
      body: text,
      parentUpdateId: parentUpdateId || null,
    },
  });

  // Resolve author name
  let authorName = update.authorId;
  try {
    const user = await prisma.user.findUnique({ where: { id: update.authorId }, select: { name: true } });
    if (user?.name) authorName = user.name;
  } catch { /* skip */ }

  // Extract @mentions and create notifications
  try {
    const mentionRegex = /@(\w[\w\s]*?\w(?=\s|$|[^a-zA-Z0-9]))/g;
    const mentionNames = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionNames.push(match[1].trim());
    }

    if (mentionNames.length > 0) {
      // Find mentioned users by name
      const mentionedUsers = await prisma.user.findMany({
        where: {
          OR: mentionNames.map((name) => ({ name: { contains: name } })),
        },
        select: { id: true, name: true },
      });

      // Create notifications for each mentioned user (skip author)
      for (const mu of mentionedUsers) {
        if (mu.id === update.authorId) continue; // don't notify self

        await prisma.notification.create({
          data: {
            id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'MENTION',
            title: `Anda di-mention oleh ${authorName}`,
            message: `di divisi ${req.params.div.toUpperCase()}: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
            payload: {
              eventId: req.params.id,
              division: req.params.div.toUpperCase(),
              updateId: update.id,
              authorId: update.authorId,
              authorName,
            },
            status: 'OPEN',
          },
        });
      }
    }
  } catch (e) {
    console.error('[MENTION] Failed to create notifications:', e.message);
  }

  res.status(201).json({ update: { ...update, authorName } });
}));

// GET /api/events/:id/divisions/:div/updates — baca diskusi (threaded)
app.get('/api/events/:id/divisions/:div/updates', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const canSee = await canSeeEventDivision(req.authUser, req.params.div.toUpperCase());
  if (!canSee) return res.status(403).json({ error: 'Tidak punya akses ke divisi ini.' });

  const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: req.params.id, division: req.params.div.toUpperCase() } } });
  if (!div) return res.status(404).json({ error: 'Divisi event tidak ditemukan.' });

  const updates = await prisma.eventUpdate.findMany({
    where: { eventDivisionId: div.id },
    orderBy: { createdAt: 'asc' },
  });

  // Resolve author names
  const authorIds = [...new Set(updates.map((u) => u.authorId))];
  const authorMap = new Map();
  for (const aid of authorIds) {
    try {
      const user = await prisma.user.findUnique({ where: { id: aid }, select: { name: true, email: true } });
      authorMap.set(aid, user?.name || user?.email || aid);
    } catch {
      authorMap.set(aid, aid);
    }
  }

  // Build threaded structure
  const enriched = updates.map((u) => ({ ...u, authorName: authorMap.get(u.authorId) || u.authorId }));
  const topLevel = enriched.filter((u) => !u.parentUpdateId);
  const replies = enriched.filter((u) => u.parentUpdateId);
  const threaded = topLevel.map((t) => ({
    ...t,
    replies: replies.filter((r) => r.parentUpdateId === t.id),
  }));

  res.json({ updates: threaded, total: updates.length });
}));

// POST /api/events/:id/meetings — tambah rapat
app.post('/api/events/:id/meetings', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { title, scheduledAt, gmeetLink, notes, division } = req.body || {};
  if (!title || !scheduledAt) return res.status(400).json({ error: 'title dan scheduledAt wajib.' });

  const meeting = await prisma.eventMeeting.create({
    data: {
      id: `evm-${Date.now().toString(36)}`,
      eventId: req.params.id,
      division: division || null,
      title,
      scheduledAt: new Date(scheduledAt),
      gmeetLink: gmeetLink || null,
      notes: notes || null,
      createdById: req.authUser?.id || 'unknown',
    },
  });
  res.status(201).json({ meeting });
}));

// GET /api/events/:id/meetings — daftar rapat
app.get('/api/events/:id/meetings', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const meetings = await prisma.eventMeeting.findMany({ where: { eventId: req.params.id }, orderBy: { scheduledAt: 'desc' } });
  res.json({ meetings });
}));

// GET /api/events/meetings/:mid/ics — generate .ics file
app.get('/api/events/meetings/:mid/ics', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const m = await prisma.eventMeeting.findUnique({ where: { id: req.params.mid } });
  if (!m) return res.status(404).json({ error: 'Meeting tidak ditemukan.' });

  const dtStart = new Date(m.scheduledAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtEnd   = new Date(new Date(m.scheduledAt).getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${m.id}@gehc.page`;

  let ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GEHC//Event\n`;
  ics += `BEGIN:VEVENT\nDTSTART:${dtStart}\nDTEND:${dtEnd}\n`;
  ics += `SUMMARY:${m.title.replace(/\n/g, '\\n')}\n`;
  if (m.notes) ics += `DESCRIPTION:${m.notes.replace(/\n/g, '\\n')}\n`;
  if (m.gmeetLink) ics += `URL:${m.gmeetLink}\nLOCATION:${m.gmeetLink}\n`;
  ics += `UID:${uid}\nEND:VEVENT\nEND:VCALENDAR`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${(m.title || 'meeting').replace(/[^a-zA-Z0-9]/g, '-')}.ics"`);
  res.send(ics);
}));

// ---------- Division Approval Workflow ----------
import {
  canSubmitDivision, canApproveDivision, canPublishDivision,
  canEditDivision, isValidTransition, logApprovalAction,
} from './division-rbac.mjs';

// POST /api/events/:eventId/divisions/:div/submit — submit division for review
app.post('/api/events/:eventId/divisions/:div/submit', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canSubmitDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak submit divisi ini.' });

  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: { approvalStatus: 'IN_REVIEW' },
  });

  await logApprovalAction(division.id, 'SUBMIT', req.authUser, req.body?.comment);
  res.json({ division: updated });
}));

// POST /api/events/:eventId/divisions/:div/approve — approve division
app.post('/api/events/:eventId/divisions/:div/approve', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canApproveDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak approve divisi ini.' });

  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: {
      approvalStatus: 'APPROVED',
      approvedById: req.authUser.id,
      approvedAt: new Date(),
      rejectReason: null,
    },
  });

  await logApprovalAction(division.id, 'APPROVE', req.authUser, req.body?.comment);
  res.json({ division: updated });
}));

// POST /api/events/:eventId/divisions/:div/reject — reject division
app.post('/api/events/:eventId/divisions/:div/reject', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canApproveDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak reject divisi ini.' });

  const reason = req.body?.reason || null;
  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: {
      approvalStatus: 'REJECTED',
      rejectReason: reason,
      approvedById: null,
      approvedAt: null,
    },
  });

  await logApprovalAction(division.id, 'REJECT', req.authUser, reason);
  res.json({ division: updated });
}));

// POST /api/events/:eventId/divisions/:div/publish — publish division to website
app.post('/api/events/:eventId/divisions/:div/publish', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
    include: { event: true },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canPublishDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak publish divisi ini.' });

  // Auto-sync: create/update ContentItem from division
  let contentItemId = division.contentItemId;
  try {
    const contentData = {
      tenantId: division.event.tenantId,
      type: 'ACTIVITY',
      title: `${division.event.name} — ${div}`,
      subtitle: division.event.description || '',
      category: `Program Kerja — ${div}`,
      schedule: division.event.startDate ? new Date(division.event.startDate).toLocaleDateString('id-ID') : '',
      location: 'GEHC Youth Portal',
      targetAudience: 'Seluruh Pemuda & Jemaat',
      tags: [div, division.event.name, 'Program Kerja'],
      isPublished: true,
      author: 'Komisi Pelayanan Pemuda',
      driveFolderId: division.driveFolderId,
    };

    if (contentItemId) {
      // Update existing
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: contentData,
      });
    } else {
      // Create new
      const ci = await prisma.contentItem.create({
        data: { id: `ci-${div.toLowerCase()}-${Date.now()}`, ...contentData },
      });
      contentItemId = ci.id;
    }
  } catch (e) {
    console.error('[PUBLISH] ContentItem sync failed:', e.message);
  }

  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: {
      approvalStatus: 'PUBLISHED',
      publishedAt: new Date(),
      contentItemId,
    },
  });

  await logApprovalAction(division.id, 'PUBLISH', req.authUser, 'Published to website');
  res.json({ division: updated, contentItemId });
}));

// GET /api/events/:eventId/divisions/:div/approval-logs — get approval history
app.get('/api/events/:eventId/divisions/:div/approval-logs', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const logs = await prisma.eventApprovalLog.findMany({
    where: { eventDivisionId: division.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ logs });
}));

// ---------- Division Members ----------
// GET /api/events/:eventId/divisions/:div/members
app.get('/api/events/:eventId/divisions/:div/members', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const members = await prisma.eventDivisionMember.findMany({
    where: { eventDivisionId: division.id },
  });

  res.json({ members });
}));

// POST /api/events/:eventId/divisions/:div/members — add/update member
app.post('/api/events/:eventId/divisions/:div/members', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const roles = (req.authUser.roles || []).map((r) => r.role);
  if (!roles.includes('SUPERADMIN') && !roles.includes('KOMISI') && !roles.includes('COMMITTEE')) {
    return res.status(403).json({ error: 'Hanya Superadmin/Komisi/BOD yang bisa mengelola anggota divisi.' });
  }

  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const { userId, role } = req.body;
  if (!userId || !['LEAD', 'CO_LEAD', 'MEMBER', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'userId dan role valid diperlukan.' });
  }

  const member = await prisma.eventDivisionMember.upsert({
    where: {
      eventDivisionId_userId: { eventDivisionId: division.id, userId },
    },
    create: {
      id: `edm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventDivisionId: division.id,
      userId,
      role,
    },
    update: { role },
  });

  res.json({ member });
}));

// DELETE /api/events/:eventId/divisions/:div/members/:userId — remove member
app.delete('/api/events/:eventId/divisions/:div/members/:userId', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const roles = (req.authUser.roles || []).map((r) => r.role);
  if (!roles.includes('SUPERADMIN') && !roles.includes('KOMISI') && !roles.includes('COMMITTEE')) {
    return res.status(403).json({ error: 'Hanya Superadmin/Komisi/BOD yang bisa mengelola anggota divisi.' });
  }

  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div, userId } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  await prisma.eventDivisionMember.deleteMany({
    where: { eventDivisionId: division.id, userId },
  });

  res.json({ ok: true });
}));

// ---------- Absensi (Parameter 3) ----------
// Mentor/Co-Mentor hanya boleh untuk grup binaannya; L1/L3/L4 bebas.
app.post('/api/db/attendance', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const roles = req.authUser.roles || [];
  const roleNames = roles.map((r) => r.role);
  const groupId = req.body?.groupId;
  const privileged = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'].some((r) => roleNames.includes(r));
  const scopedRole = roles.find((r) => ['MENTOR', 'CO_MENTOR'].includes(r.role));
  const scoped = scopedRole && scopedRole.groupId === groupId;
  if (!privileged && !scoped) {
    return res.status(403).json({ error: 'Hanya Mentor/Co-Mentor grup binaan atau Komisi/Tim Kerja.' });
  }

  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const date = new Date(req.body?.date);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date tidak valid.' });
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  let saved = 0;
  for (const e of entries) {
    if (!e?.groupMemberId || !['HADIR', 'IZIN', 'SAKIT', 'TANPA_KABAR'].includes(e.status)) continue;
    await prisma.attendanceRecord.upsert({
      where: { groupMemberId_date: { groupMemberId: e.groupMemberId, date } },
      create: {
        id: `att-${crypto.randomUUID()}`,
        groupId,
        groupMemberId: e.groupMemberId,
        date,
        status: e.status,
        note: e.note || null,
        recordedById: req.authUser.id,
      },
      update: { status: e.status, note: e.note || null, recordedById: req.authUser.id },
    });
    saved += 1;
  }
  res.json({ saved });
}));

// Struktur organisasi (publik — dipakai landing pohon pantatugas)
app.get('/api/db/struktur', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.strukturMember.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ members });
}));

// Sinkronisasi struktur dari portal (replace-all: upsert semua, hapus yang tidak dikirim)
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
    };
    await prisma.strukturMember.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
  }
  const keepIds = list.map((m) => m.id).filter(Boolean);
  const removed = await prisma.strukturMember.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : {},
  });
  res.json({ synced: list.length, removed: removed.count });
}));

// ---------- Jethro Engine (Dashboard Komisi) ----------
const KOMISION = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

app.get('/api/jethro/dashboard', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  res.json(await getDashboard());
}));

app.post('/api/jethro/scan', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await runScan());
}));

app.get('/api/jethro/narrate', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  try {
    res.json(await narrateDashboard());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}));

app.get('/api/jethro/placement', requireRole(...KOMISION), wrap(async (req, res) => {
  const count = Number(req.query.count || 0);
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    return res.status(400).json({ error: 'query count harus angka 1-500.' });
  }
  res.json(await recommendPlacement(Math.floor(count)));
}));

app.post('/api/jethro/split', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await executeSplit(req.body || {}));
}));

app.post('/api/jethro/merge', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await executeMerge(req.body || {}));
}));

app.patch('/api/jethro/member/:id/role', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await shuffleRole(req.params.id, req.body?.familyRole));
}));

app.patch('/api/jethro/member/:id/alumni', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await markAlumni(req.params.id, req.body?.note));
}));

// Notifikasi: tinjau / tutup
app.get('/api/db/notifications', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const notifications = await prisma.notification.findMany({
    where: req.query.status ? { status: String(req.query.status).toUpperCase() } : {},
    orderBy: { createdAt: 'desc' },
  });
  res.json({ notifications });
}));

app.patch('/api/db/notifications/:id', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const status = String(req.body?.status || '').toUpperCase();
  if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
    return res.status(400).json({ error: "status harus OPEN | ACKNOWLEDGED | RESOLVED." });
  }
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null },
  });
  res.json(updated);
}));

// Login akun lokal (email + password)
app.post('/api/auth/local', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  try {
    const user = await loginLocal(req.body?.email, req.body?.password);
    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status: user.accountStatus,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, roles: user.roles },
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}));

// ---------- Join Flow: Waitlist · Invites · People · GiftTest ----------
const KOMISION_CORE = ['SUPERADMIN', 'KOMISI'];

const wlPublic = (w) => ({
  id: w.id,
  name: w.name,
  phone: w.phone,
  email: w.email,
  origin: w.origin,
  address: w.address,
  giftsTop5: w.giftsTop5,
  talents: w.talents,
  status: w.status,
  sourceEventId: w.sourceEventId,
  assignedGroupId: w.assignedGroupId,
  promoteToken: w.promoteToken,
  createdAt: w.createdAt,
});

// Tahap A — daftar cepat (publik, tanpa login)
app.post('/api/waitlist', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { name, phone, email, origin, sourceEventId } = req.body || {};
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
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
    },
  });
  res.json({ ok: true, entry: wlPublic(entry) });
}));

// Baca satu entri via token rahasia (link pelengkap profil tahap B)
app.get('/api/waitlist/by-token/:token', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: req.params.token } });
  if (!w) return res.status(404).json({ error: 'Link tidak valid atau sudah kedaluwarsa.' });
  res.json({ entry: wlPublic(w) });
}));

// Tahap B — lengkapi profil via token
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
      giftsTop5: b.giftsTop5 ?? undefined,
      giftsScores: b.giftsScores ?? undefined,
      talents: b.talents ?? undefined,
      status: w.status === 'WAITLISTED' && (b.address || b.giftsTop5) ? 'PROFILED' : w.status,
    },
  });
  res.json({ ok: true, entry: wlPublic(updated) });
}));

// Panel: daftar waitlist
app.get('/api/waitlist', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const entries = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ entries: entries.map(wlPublic) });
}));

// Panel: assign ke rumah (mentee baru)
app.post('/api/waitlist/:id/assign', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const groupId = req.body?.groupId;
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return res.status(400).json({ error: 'Grup tujuan tidak ditemukan.' });
  const w = await prisma.waitlistEntry.findUnique({ where: { id: req.params.id } });
  if (!w) return res.status(404).json({ error: 'Entri waitlist tidak ditemukan.' });

  await prisma.groupMember.create({
    data: {
      id: `gm-wl-${w.id.slice(-8)}`,
      groupId,
      name: w.name,
      email: w.email,
      phone: w.phone,
      familyRole: 'MENTEE',
      status: 'ACTIVE',
      batchPeriod: String(new Date().getFullYear()),
    },
  });
  const count = await prisma.groupMember.count({ where: { groupId, status: 'ACTIVE' } });
  await prisma.group.update({ where: { id: groupId }, data: { memberCount: count } });

  // Bila pendaftar ternyata sudah punya akun (pernah SSO), tautkan + beri role MENTEE
  if (w.email) {
    const u = await prisma.user.findUnique({ where: { email: w.email } });
    if (u) {
      await prisma.groupMember.updateMany({ where: { id: `gm-wl-${w.id.slice(-8)}` }, data: { userId: u.id } });
      const has = await prisma.userRole.findFirst({ where: { userId: u.id, role: 'MENTEE' } });
      if (!has) await prisma.userRole.create({ data: { userId: u.id, tenantId: 'tenant-youth', role: 'MENTEE', groupId } });
    }
  }

  const updated = await prisma.waitlistEntry.update({
    where: { id: w.id },
    data: { status: 'ASSIGNED', assignedGroupId: groupId },
  });
  res.json({ ok: true, entry: wlPublic(updated) });
}));

// ---------- Invites ----------
app.get('/api/invites', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const invites = await prisma.inviteCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ invites: invites.map((i) => ({ ...i, maxUses: Number(i.maxUses), uses: Number(i.uses) })) });
}));

app.post('/api/invites', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const type = ['SINGLE', 'TEAM'].includes(req.body?.type) ? req.body.type : 'SINGLE';
  const defaultRole = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI']
    .includes(req.body?.defaultRole) ? req.body.defaultRole : 'MENTEE';
  const maxUses = Math.max(1, Math.min(500, Number(req.body?.maxUses || (type === 'SINGLE' ? 1 : 25))));
  const expiresDays = Math.max(1, Math.min(90, Number(req.body?.expiresDays || 14)));
  const code = `GEHC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const invite = await prisma.inviteCode.create({
    data: {
      code,
      type,
      defaultRole,
      maxUses,
      expiresAt: new Date(Date.now() + expiresDays * 86400000),
      createdBy: req.authUser?.email || null,
    },
  });
  res.json({ invite: { ...invite, maxUses: Number(invite.maxUses), uses: Number(invite.uses) } });
}));

app.delete('/api/invites/:code', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.inviteCode.delete({ where: { code: req.params.code.toUpperCase() } }).catch(() => {});
  res.json({ ok: true });
}));

// ---------- Join via invite (Google SSO + profil) ----------
app.post('/api/join', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  try {
    const p = await verifyGoogleCredential(req.body?.credential);

    const code = String(req.body?.code || '').toUpperCase().trim();
    const invite = await prisma.inviteCode.findUnique({ where: { code } });
    if (!invite) return res.status(400).json({ error: 'Kode undangan tidak ditemukan.' });
    if (Number(invite.uses) >= Number(invite.maxUses)) return res.status(400).json({ error: 'Link undangan sudah habis dipakai.' });
    if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(400).json({ error: 'Link undangan sudah kedaluwarsa.' });

    const profile = {
      phone: req.body?.phone ? String(req.body.phone).slice(0, 40) : undefined,
      address: req.body?.address ? String(req.body.address).slice(0, 1000) : undefined,
      origin: req.body?.origin ? String(req.body.origin).slice(0, 190) : undefined,
      talents: Array.isArray(req.body?.talents) ? req.body.talents : undefined,
      giftsTop5: Array.isArray(req.body?.giftsTop5) ? req.body.giftsTop5 : undefined,
    };

    let user = (await prisma.user.findUnique({ where: { id: p.sub } }))
      || (await prisma.user.findUnique({ where: { email: p.email } }));

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: p.sub,
          email: p.email,
          name: p.name || p.email.split('@')[0],
          avatar: p.picture || null,
          accountStatus: 'PENDING',
          ...profile,
        },
        include: { roles: true },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: p.name || user.name,
          avatar: p.picture || user.avatar,
          phone: profile.phone ?? user.phone,
          address: profile.address ?? user.address,
          origin: profile.origin ?? user.origin,
          talents: profile.talents ?? user.talents,
          giftsTop5: profile.giftsTop5 ?? user.giftsTop5,
        },
        include: { roles: true },
      });
    }

    // Multi-role: tambahkan role dasar dari invite bila belum dimiliki
    const has = (user.roles || []).some((r) => r.role === invite.defaultRole);
    if (!has) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: invite.defaultRole },
      });
      user.roles.push({ role: invite.defaultRole, tenantId: 'tenant-youth' });
    }

    await prisma.inviteCode.update({ where: { code }, data: { uses: { increment: 1 } } });

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status: user.accountStatus,
      role: invite.defaultRole,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, roles: user.roles },
    });
  } catch (err) {
    console.error('[join] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

// Join via invite — akun LOKAL (email + password)
app.post('/api/join/local', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').toLowerCase().trim();
    const password = String(b.password || '');
    if (!name || !email.includes('@')) return res.status(400).json({ error: 'Nama dan email valid wajib diisi.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });

    const code = String(b.code || '').toUpperCase().trim();
    const invite = await prisma.inviteCode.findUnique({ where: { code } });
    if (!invite) return res.status(400).json({ error: 'Kode undangan tidak ditemukan.' });
    if (Number(invite.uses) >= Number(invite.maxUses)) return res.status(400).json({ error: 'Link undangan sudah habis dipakai.' });
    if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(400).json({ error: 'Link undangan sudah kedaluwarsa.' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({
        error: 'Email sudah terdaftar. Masuk lewat Google atau gunakan tombol masuk email.',
        existingAccount: true,
      });
    }

    const user = await prisma.user.create({
      data: {
        id: `usr-${crypto.randomUUID()}`,
        email,
        name,
        phone: b.phone ? String(b.phone).slice(0, 40) : null,
        address: b.address ? String(b.address).slice(0, 1000) : null,
        origin: b.origin ? String(b.origin).slice(0, 190) : null,
        talents: Array.isArray(b.talents) ? b.talents : undefined,
        giftsTop5: Array.isArray(b.giftsTop5) ? b.giftsTop5 : undefined,
        authProvider: 'LOCAL',
        passwordHash: hashPassword(password),
        accountStatus: 'PENDING',
      },
      include: { roles: true },
    });

    await prisma.userRole.create({
      data: { userId: user.id, tenantId: 'tenant-youth', role: invite.defaultRole },
    });
    user.roles.push({ role: invite.defaultRole, tenantId: 'tenant-youth' });

    await prisma.inviteCode.update({ where: { code }, data: { uses: { increment: 1 } } });

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({ status: user.accountStatus, role: invite.defaultRole, user });
  } catch (err) {
    console.error('[join-local] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

// ---------- Profil diri sendiri (lengkapi setelah join) ----------
app.patch('/api/me', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const b = req.body || {};
  const data = {};
  for (const k of ['phone', 'address', 'origin']) {
    if (b[k] !== undefined) data[k] = String(b[k]).slice(0, 1000);
  }
  if (Array.isArray(b.talents)) data.talents = b.talents;
  if (Array.isArray(b.giftsTop5)) data.giftsTop5 = b.giftsTop5;
  if (b.giftsScores && typeof b.giftsScores === 'object') data.giftsScores = b.giftsScores;
  const u = await prisma.user.update({ where: { id: req.authUser.id }, data });
  res.json({ ok: true, name: u.name });
}));

// ---------- Registrasi mandiri via Google (publik, PENDING → approval Komisi) ----------
const registrationOpen = () => process.env.REGISTRATION_OPEN !== 'false';

app.post('/api/register/google', wrap(async (req, res) => {
  if (!registrationOpen()) {
    return res.status(403).json({ error: 'Pendaftaran akun baru sedang ditutup. Ikuti waitlist event terdekat ya!' });
  }
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    const p = await verifyGoogleCredential(req.body?.credential);
    const email = p.email;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: p.sub }, { email }] },
      include: { roles: true },
    });
    if (existing && (existing.roles || []).length > 0) {
      return res.status(409).json({
        error: 'Email sudah terdaftar. Silakan Masuk dengan Google.',
        existingAccount: true,
      });
    }

    const trusted = isSuperadminEmail(email);
    const status = trusted ? 'ACTIVE' : 'PENDING';
    const initialRole = trusted ? 'SUPERADMIN' : 'MENTEE';

    const profile = {
      phone: req.body?.phone ? String(req.body.phone).slice(0, 40) : null,
      origin: req.body?.origin ? String(req.body.origin).slice(0, 190) : null,
      talents: Array.isArray(req.body?.talents) ? req.body.talents : undefined,
      giftsTop5: Array.isArray(req.body?.giftsTop5) ? req.body.giftsTop5 : undefined,
    };

    let user;
    if (existing) {
      // akun yatim (tanpa role) — lengkapi & aktifkan alur pendaftaran
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: p.name || user?.name || email.split('@')[0],
          avatar: p.picture || existing.avatar,
          accountStatus: status,
          ...profile,
        },
        include: { roles: true },
      });
    } else {
      user = await prisma.user.create({
        data: {
          id: p.sub,
          email,
          name: p.name || email.split('@')[0],
          avatar: p.picture || null,
          accountStatus: status,
          ...profile,
        },
        include: { roles: true },
      });
    }

    const hasRole = (user.roles || []).some((r) => r.role === initialRole);
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: initialRole },
      });
      user.roles.push({ userId: user.id, tenantId: 'tenant-youth', role: initialRole });
    }

    // Kaitkan waitlist berdasar email bila pernah daftar cepat
    const wl = await prisma.waitlistEntry.findFirst({ where: { email } });
    if (wl && wl.status === 'WAITLISTED') {
      await prisma.waitlistEntry.update({ where: { id: wl.id }, data: { status: 'PROFILED' } });
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status,
      role: initialRole,
      user: {
        id: user.id, email: user.email, name: user.name,
        avatar: user.avatar, accountStatus: status, roles: user.roles,
      },
    });
  } catch (err) {
    console.error('[register-google] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

// Agenda terdekat untuk portal terbatas / landing (publik)
app.get('/api/events/upcoming', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const items = await prisma.contentItem.findMany({
    where: { type: 'ACTIVITY', isPublished: true },
    orderBy: { publishedAt: 'desc' },
    take: 6,
  });
  res.json({
    events: items.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      date: c.publishedAt,
      locationDetail: c.locationDetail ?? null,
      bannerUrl: c.bannerUrl,
    })),
  });
}));

// ---------- OAuth Redirect Flow ala AISIGHT (prompt=select_account) ----------
const oauthStates = new Map(); // state → intent (TTL 10 menit)
function newOAuthState(data) {
  const s = crypto.randomBytes(16).toString('hex');
  oauthStates.set(s, { ...data, exp: Date.now() + 10 * 60 * 1000 });
  return s;
}
function takeOAuthState(state) {
  const v = oauthStates.get(String(state));
  oauthStates.delete(String(state));
  if (!v || v.exp < Date.now()) return null;
  return v;
}

function googleRedirectUri(req) {
  return `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

app.get('/api/auth/google/start', wrap(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('Google OAuth belum dikonfigurasi (CLIENT_ID / SECRET). Panduan: drive-integration.md §8.');
  }
  const mode = ['login', 'register', 'join'].includes(String(req.query.mode)) ? String(req.query.mode) : 'login';
  const inviteCode = mode === 'join' ? String(req.query.code || '').toUpperCase().slice(0, 16) : undefined;
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('#')
    ? req.query.next : '#/beyonders';

  const state = newOAuthState({ mode, code: inviteCode, next });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}));

/** Buat/perbarui user dari identitas Google terverifikasi. */
async function upsertGoogleUser(prisma, p, { profile = {}, accountStatus = 'ACTIVE', initialRole }) {
  const email = p.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ id: p.sub }, { email }] },
    include: { roles: true },
  });

  const baseData = {
    name: p.name || email.split('@')[0],
    avatar: p.picture ?? undefined,
    phone: profile.phone ?? undefined,
    address: profile.address ?? undefined,
    origin: profile.origin ?? undefined,
    talents: Array.isArray(profile.talents) ? profile.talents : undefined,
    giftsTop5: Array.isArray(profile.giftsTop5) ? profile.giftsTop5 : undefined,
  };

  if (!user) {
    user = await prisma.user.create({
      data: { id: p.sub, email, accountStatus, ...baseData },
      include: { roles: true },
    });
  } else {
    const clean = Object.fromEntries(Object.entries(baseData).filter(([, v]) => v !== undefined));
    user = await prisma.user.update({ where: { id: user.id }, data: clean, include: { roles: true } });
  }

  if (initialRole) {
    const has = (user.roles || []).some((r) => r.role === initialRole);
    if (!has) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: initialRole },
      });
      user.roles.push({ userId: user.id, tenantId: 'tenant-youth', role: initialRole });
    }
  }
  return user;
}

app.get('/api/auth/google/callback', wrap(async (req, res) => {
  const sendErr = (msg) =>
    res.status(400).send(
      `<html><body style="font-family:system-ui;background:#111;color:#fff;text-align:center;padding-top:80px">
       <h2>Login gagal</h2><p style="color:#f87171">${msg}</p>
       <a href="/#/beyonders" style="color:#FF416C">← Kembali ke situs</a></body></html>`
    );

  try {
    if (req.query.error) throw new Error(req.query.error === 'access_denied' ? 'Login dibatalkan.' : String(req.query.error));
    const intent = takeOAuthState(String(req.query.state || ''));
    if (!intent) throw new Error('Sesi otorisasi kedaluwarsa — coba tombol Google lagi.');

    const prisma = getPrisma();
    if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');

    // Tukar authorization code → token, lalu verifikasi identitas
    const { google } = await import('googleapis');
    const oauth2 = new google.auth.OAuth2({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(req),
    });
    const { tokens } = await oauth2.getToken(String(req.query.code));
    oauth2.setCredentials(tokens);
    const idp = tokens.id_token ? await verifyGoogleCredential(tokens.id_token) : null;
    if (!idp) throw new Error('id_token tidak diterima.');

    const email = idp.email;
    let user; let status; let roleInfo;

    if (intent.mode === 'register') {
      if (!registrationOpen()) throw new Error('Pendaftaran akun baru sedang ditutup.');
      const dup = await prisma.user.findFirst({ where: { OR: [{ id: idp.sub }, { email }] }, include: { roles: true } });
      if (dup && (dup.roles || []).length > 0) throw new Error('Email sudah terdaftar — silakan Masuk dengan Google.');

      const trusted = isSuperadminEmail(email);
      status = trusted ? 'ACTIVE' : 'PENDING';
      user = await upsertGoogleUser(prisma, idp, {
        profile: { origin: req.state?.origin },
        accountStatus: status,
        initialRole: trusted ? 'SUPERADMIN' : 'MENTEE',
      });
      roleInfo = trusted ? 'SUPERADMIN' : 'MENTEE';

      const wl = await prisma.waitlistEntry.findFirst({ where: { email } });
      if (wl && wl.status === 'WAITLISTED') {
        await prisma.waitlistEntry.update({ where: { id: wl.id }, data: { status: 'PROFILED' } });
      }
    } else if (intent.mode === 'join') {
      const inv = await prisma.inviteCode.findUnique({ where: { code: intent.code } });
      if (!inv) throw new Error('Kode undangan tidak ditemukan.');
      if (Number(inv.uses) >= Number(inv.maxUses)) throw new Error('Link undangan sudah habis dipakai.');
      if (inv.expiresAt && inv.expiresAt < new Date()) throw new Error('Link undangan kedaluwarsa.');

      user = await upsertGoogleUser(prisma, idp, {
        profile: {},
        accountStatus: 'PENDING',
        initialRole: inv.defaultRole,
      });
      status = user.accountStatus;
      roleInfo = inv.defaultRole;

      await prisma.inviteCode.update({ where: { code: intent.code }, data: { uses: { increment: 1 } } });
    } else {
      // login biasa
      user = await upsertGoogleUser(prisma, idp, {
        profile: {},
        accountStatus: 'ACTIVE',
        initialRole: isSuperadminEmail(email) ? 'SUPERADMIN' : null,
      });
      status = user.accountStatus;
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.redirect(302, `/${intent.next}`);
  } catch (err) {
    console.error('[oauth-callback]', err.message);
    sendErr(err.message);
  }
}));

// ---------- People (akun & approval) ----------
app.get('/api/db/users', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const users = await prisma.user.findMany({
    include: { roles: true, _count: { select: { groupMembers: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    users: users.map(({ _count, ...u }) => ({ ...u, groupCount: _count.groupMembers })),
  });
}));

app.patch('/api/people/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const action = req.body?.action;

  if (action === 'approve') {
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: { accountStatus: 'ACTIVE' },
      include: { roles: true },
    });
    return res.json({ user: u });
  }

  if (action === 'addRole') {
    const role = req.body?.role;
    if (!['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid.' });
    }
    const dup = await prisma.userRole.findFirst({
      where: { userId: req.params.id, role, groupId: req.body?.groupId ?? null },
    });
    if (!dup) {
      await prisma.userRole.create({
        data: { userId: req.params.id, tenantId: 'tenant-youth', role, groupId: req.body?.groupId ?? null },
      });
    }
    return res.json({ ok: true });
  }

  if (action === 'removeRole') {
    await prisma.userRole.deleteMany({
      where: { userId: req.params.id, role: req.body?.role, groupId: req.body?.groupId ?? null },
    });
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'action tidak dikenal.' });
}));

// ---------- GiftTest ----------
app.post('/api/gifttest', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { scope, token, giftsTop5, giftsScores, talents } = req.body || {};

  if (scope === 'waitlist') {
    if (!token) return res.status(400).json({ error: 'token wajib.' });
    const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: token } });
    if (!w) return res.status(404).json({ error: 'Token tidak valid.' });
    await prisma.waitlistEntry.update({
      where: { id: w.id },
      data: { giftsTop5, giftsScores, talents, status: w.status === 'WAITLISTED' ? 'PROFILED' : w.status },
    });
    return res.json({ ok: true });
  }

  if (scope === 'user') {
    if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
    await prisma.user.update({
      where: { id: req.authUser.id },
      data: { giftsTop5, giftsScores, talents },
    });
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'scope tidak dikenal.' });
}));

// ---------- Benzarpreneurship E-commerce ----------
const VALID_CATEGORIES = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];
const VALID_ORDER_STATUSES = ['PENDING', 'PAID', 'VERIFIED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
const VALID_SHIPPING = ['PICKUP', 'DELIVERY'];

function generateOrderCode() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `BZP-${dateStr}-${rand}`;
}

// GET /api/benzar/products — public katalog produk
app.get('/api/benzar/products', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { category } = req.query;
  const where = { isActive: true };
  if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
    where.category = category.toUpperCase();
  }
  const products = await prisma.product.findMany({ where, orderBy: { sortOrder: 'asc' } });
  res.json({ products });
}));

// GET /api/benzar/products/:id — detail produk
app.get('/api/benzar/products/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  res.json({ product });
}));

// POST /api/benzar/products — buat produk (BZP LEAD/CO_LEAD)
app.post('/api/benzar/products', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { name, description, price, stock, images, category, sortOrder } = req.body || {};
  if (!name || price == null || !category) {
    return res.status(400).json({ error: 'name, price, category wajib.' });
  }
  if (!VALID_CATEGORIES.includes(category.toUpperCase())) {
    return res.status(400).json({ error: `category harus salah satu dari: ${VALID_CATEGORIES.join(', ')}` });
  }
  const id = `prod-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
  const product = await prisma.product.create({
    data: {
      id, name, description: description || null, price: Number(price),
      stock: Number(stock) || 0, images: images || [], category: category.toUpperCase(),
      sortOrder: Number(sortOrder) || 0, createdById: req.authUser?.id || 'unknown',
    },
  });
  res.status(201).json({ product });
}));

// PATCH /api/benzar/products/:id — update produk
app.patch('/api/benzar/products/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const { name, description, price, stock, images, category, sortOrder, isActive } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = Number(price);
  if (stock !== undefined) data.stock = Number(stock);
  if (images !== undefined) data.images = images;
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({ error: `category harus salah satu dari: ${VALID_CATEGORIES.join(', ')}` });
    }
    data.category = category.toUpperCase();
  }
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json({ product });
}));

// DELETE /api/benzar/products/:id — soft delete
app.delete('/api/benzar/products/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
}));

// POST /api/benzar/orders — buat pesanan
app.post('/api/benzar/orders', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { items: rawItems, shipping, shippingAddr, notes } = req.body || {};
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'items[] wajib minimal 1 produk.' });
  }
  // Validate & build order items
  const orderItems = [];
  let total = 0;
  for (const item of rawItems) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product || !product.isActive) {
      return res.status(400).json({ error: `Produk ${item.productId} tidak tersedia.` });
    }
    const qty = Number(item.qty) || 1;
    if (product.stock > 0 && qty > product.stock) {
      return res.status(400).json({ error: `Stok ${product.name} tidak cukup (tersisa ${product.stock}).` });
    }
    orderItems.push({ productId: product.id, qty, price: product.price, name: product.name });
    total += product.price * qty;
  }
  if (shipping && !VALID_SHIPPING.includes(shipping.toUpperCase())) {
    return res.status(400).json({ error: `shipping harus PICKUP atau DELIVERY.` });
  }
  const orderId = `ord-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
  const orderCode = generateOrderCode();
  const order = await prisma.order.create({
    data: {
      id: orderId, orderCode, userId: req.authUser.id, items: orderItems, total,
      status: 'PENDING', shipping: (shipping || 'PICKUP').toUpperCase(),
      shippingAddr: shippingAddr || null, notes: notes || null,
    },
  });
  // Create order items in relation table
  for (const oi of orderItems) {
    await prisma.orderItem.create({
      data: { id: `oi-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`, orderId: order.id, ...oi },
    });
  }
  // Deduct stock
  for (const oi of orderItems) {
    await prisma.product.update({
      where: { id: oi.productId },
      data: { stock: { decrement: oi.qty } },
    });
  }
  res.status(201).json({ order, orderCode });
}));

// GET /api/benzar/orders — list orders (BZP staff)
app.get('/api/benzar/orders', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { status } = req.query;
  const where = {};
  if (status && VALID_ORDER_STATUSES.includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }
  const orders = await prisma.order.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json({ orders });
}));

// GET /api/benzar/orders/my — list orders milik user login
app.get('/api/benzar/orders/my', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const orders = await prisma.order.findMany({
    where: { userId: req.authUser.id }, orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
}));

// GET /api/benzar/orders/:id — detail order
app.get('/api/benzar/orders/:id', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  // Only owner or staff can view
  const isOwner = order.userId === req.authUser.id;
  const roles = (req.authUser.roles || []).map((r) => r.role);
  const isStaff = roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE');
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Akses ditolak.' });
  res.json({ order });
}));

// PATCH /api/benzar/orders/:id/status — update status order (BZP staff)
app.patch('/api/benzar/orders/:id/status', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { status } = req.body || {};
  if (!status || !VALID_ORDER_STATUSES.includes(status.toUpperCase())) {
    return res.status(400).json({ error: `status harus salah satu dari: ${VALID_ORDER_STATUSES.join(', ')}` });
  }
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  // If cancelling, restore stock
  if (status.toUpperCase() === 'CANCELLED' && order.status !== 'CANCELLED') {
    const items = order.items;
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
  }
  const updated = await prisma.order.update({
    where: { id: req.params.id }, data: { status: status.toUpperCase() },
  });
  res.json({ order: updated });
}));

// GET /api/benzar/qris — return QRIS info (public)
app.get('/api/benzar/qris', wrap(async (req, res) => {
  // Static QRIS config — admin ganti di Drive, ini fallback
  res.json({
    imageUrl: process.env.QRIS_IMAGE_URL || '/qris.png',
    merchantName: process.env.QRIS_MERCHANT_NAME || 'GEHC Benzarpreneurship',
    merchantId: process.env.QRIS_MERCHANT_ID || '',
    bankName: process.env.QRIS_BANK_NAME || 'GoPay',
    accountNumber: process.env.QRIS_ACCOUNT_NUMBER || '',
    instructions: 'Scan QRIS di atas untuk melakukan pembayaran. Setelah bayar, konfirmasi ke admin.',
  });
}));

// ---------- End Benzarpreneurship E-commerce ----------

// ---------- Fallback ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// ---------- Frontend terintegrasi (gaya AISIGHT: 1 proses, 1 port) ----------
// DEV  : Vite middleware di-tanam ke Express → hot-reload, satu port.
// PROD : sajikan dist/ hasil `vite build`.
// API-only: set PURE_API=1 untuk mematikan penyajian frontend.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const serveFrontend = !process.env.PURE_API;

if (serveFrontend && process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

let viteDev = null;
if (serveFrontend && process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  viteDev = await createViteServer({
    appType: 'spa',
    server: { middlewareMode: true, hmr: { port: 24678 } },
  });
  app.use(viteDev.middlewares);
}

// Di Vercel serverless: jangan listen — app diekspor via api/index.mjs.
// Di lokal (npm run dev / npm run server): jalankan HTTP listener seperti biasa.
if (!process.env.VERCEL) {
  // eslint-disable-next-line no-inner-declarations
  app.listen(PORT, () => {
    const mode = process.env.NODE_ENV === 'production'
      ? 'produksi (dist/)'
      : viteDev
        ? 'development (Vite middleware — hot-reload aktif)'
        : 'API-only';
    console.log(`GEHC server berjalan di http://localhost:${PORT} [${mode}]`);
    console.log(`Google Drive mode: ${getDriveMode() ?? 'BELUM DIKONFIGURASI'}`);
    console.log(`TiDB Cloud: ${isDbConfigured() ? 'terkonfigurasi' : 'belum dikonfigurasi'}`);

    // Peringatan dini untuk developer — agar login/daftar Google tidak "diam" tanpa penjelasan
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('⚠️  GOOGLE_CLIENT_ID belum diisi — Login/Daftar via Google NONAKTIF.');
      console.warn('    Panduan: drive-integration.md §8 (Setup Google Auth).');
    }
    if (!process.env.SUPERADMIN_EMAILS) {
      console.warn('ℹ️  SUPERADMIN_EMAILS kosong — tidak ada email yang otomatis menjadi SUPERADMIN saat login pertama.');
    }
  });
}

export default app;
