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
  res.json({ applied, errors, total: ddl.length });
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
  const roles = (authUser?.roles || []).map((r) => r.role);
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

  const events = await prisma.eventProgram.findMany({
    orderBy: { startDate: 'desc' },
    include: { divisions: true },
  });

  // Filter berdasarkan role
  const roles = (req.authUser?.roles || []).map((r) => r.role);
  const isKomsaOrBod = roles.includes('SUPERADMIN') || roles.includes('KOMISI');
  const isBodTimkerja = roles.includes('COMMITTEE') && await (async () => {
    const sm = await prisma.strukturMember.findFirst({ where: { email: req.authUser?.email || '' } });
    return !(sm?.division) || sm.division.toUpperCase() === 'TIMKERJA';
  })();

  if (isKomsaOrBod || isBodTimkerja) {
    return res.json({ events });
  }

  // Filter: hanya event yang punya division yang bisa diakses user
  const accessible = [];
  for (const ev of events) {
    for (const d of ev.divisions) {
      if (await canSeeEventDivision(req.authUser, d.division)) {
        accessible.push(ev);
        break;
      }
    }
  }
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

  const ev = await prisma.eventProgram.findUnique({
    where: { id: req.params.id },
    include: { divisions: true, meetings: { orderBy: { scheduledAt: 'desc' } } },
  });
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

// POST /api/events/:id/divisions/:div/updates — tambah diskusi/progres
app.post('/api/events/:id/divisions/:div/updates', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { body: text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'body wajib.' });

  const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: req.params.id, division: req.params.div.toUpperCase() } } });
  if (!div) return res.status(404).json({ error: 'Divisi event tidak ditemukan.' });

  const canSee = await canSeeEventDivision(req.authUser, req.params.div.toUpperCase());
  if (!canSee) return res.status(403).json({ error: 'Tidak punya akses ke divisi ini.' });

  const update = await prisma.eventUpdate.create({
    data: {
      id: `evu-${Date.now().toString(36)}`,
      eventDivisionId: div.id,
      authorId: req.authUser?.id || 'unknown',
      body: text,
    },
  });
  res.status(201).json({ update });
}));

// GET /api/events/:id/divisions/:div/updates — baca diskusi
app.get('/api/events/:id/divisions/:div/updates', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const canSee = await canSeeEventDivision(req.authUser, req.params.div.toUpperCase());
  if (!canSee) return res.status(403).json({ error: 'Tidak punya akses ke divisi ini.' });

  const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: req.params.id, division: req.params.div.toUpperCase() } } });
  if (!div) return res.status(404).json({ error: 'Divisi event tidak ditemukan.' });

  const updates = await prisma.eventUpdate.findMany({ where: { eventDivisionId: div.id }, orderBy: { createdAt: 'asc' } });
  res.json({ updates });
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
