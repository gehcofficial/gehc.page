import 'dotenv/config';
import express from 'express';
import { getDriveMode, listFolders, listFiles, getFileStream, testConnection as testDrive, getFolderChain, listFolderTree } from '../server/gdrive.mjs';
import { resolveAccess, matrixForUser, parseTag } from '../server/gdrive-policy.mjs';
import { requireRole, attachUser } from '../server/auth.mjs';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[drive] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

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
    res.json({ folders: enriched.filter((f) => f.accessAllowed || Boolean(req.authUser)) });
  } catch (err) {
    const s = typeof err?.status === 'number' && err.status >= 400 ? err.status : 502;
    res.status(s).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

app.get('/api/drive/files', wrap(async (req, res) => {
  const target = req.query.folderId || DRIVE_ROOT();
  try {
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

app.get('/api/drive/group-files/:groupName', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  const groupName = String(req.params.groupName || '').trim();
  if (!groupName) return res.status(400).json({ error: 'Nama grup wajib diisi.' });
  try {
    const rootFolders = await listFolders();
    const container = rootFolders.find((f) => /^kelompok mentoring/i.test(f.name));
    if (!container) return res.status(404).json({ error: 'Folder Kelompok Mentoring tidak ditemukan.' });

    const kids = await listFolders(container.id);
    const target = kids.find(
      (k) =>
        (parseTag(k.name) || '').toUpperCase() === `GROUP:${groupName.toUpperCase()}` ||
        k.name.toLowerCase().includes(`[${groupName.toLowerCase()}]`)
    );
    if (!target) return res.status(404).json({ error: `Folder galeri untuk grup "${groupName}" belum dibuat.` });

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

app.get('/api/drive/policy', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  res.json({ matrix: matrixForUser(req.authUser), authenticated: Boolean(req.authUser) });
}));

app.get('/api/drive/audit', requireRole('SUPERADMIN'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const tree = await listFolderTree(3);
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

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

  const subs = await prisma.strukturMember.findMany({
    where: { division: { in: ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] }, NOT: { subdivision: null } },
    select: { division: true, subdivision: true },
  });
  const pillarParents = new Map();
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

// ---------- Division Drive Browser ----------
import { createFolder as gdriveCreateFolder, uploadFile as gdriveUploadFile, deleteFile as gdriveDeleteFile, getFileInfo as gdriveGetFileInfo } from '../server/gdrive.mjs';

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

app.get('/api/drive/files/:fileId', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  try {
    const info = await gdriveGetFileInfo(req.params.fileId);
    res.json({ file: info });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat info file: ${e.message}` });
  }
}));

export default app;