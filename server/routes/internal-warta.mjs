/**
 * Info & Peluang — warta internal (login-only).
 * Admin membuat warta, memilih "siapa yang berbagi", lampiran file/link,
 * deadline + auto-arsip, notifikasi ke semua akun saat dipublikasikan.
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { pushToUsers } from '../lib/notify.mjs';
import {
  getDriveMode, listFolders, createFolder, uploadFile, getFileStream, getFileStreamAsServiceAccount,
} from '../gdrive.mjs';

export const WARTA_CATEGORIES = ['BEASISWA', 'LOWONGAN', 'PELUANG', 'KEGIATAN', 'UMUM'];
const FOLDER_NAME = 'Info & Peluang [PRIVAT]';
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const ALLOWED_MIME = /^(application\/pdf|image\/(jpeg|png|webp|gif)|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet)|application\/vnd\.ms-powerpoint)$/i;

export function isWartaAdmin(authUser) {
  const roles = (authUser?.roles || []).map((r) => r.role);
  return roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE');
}

function cleanAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((a) => {
    if (!a || typeof a !== 'object') return null;
    if (a.kind === 'LINK') {
      const url = String(a.url || '').trim().slice(0, 500);
      if (!/^https?:\/\//i.test(url)) return null;
      return { kind: 'LINK', label: String(a.label || '').trim().slice(0, 120) || url, url };
    }
    const fileId = String(a.fileId || '').trim().slice(0, 120);
    if (!fileId) return null;
    return {
      kind: 'FILE',
      fileId,
      name: String(a.name || 'Berkas').slice(0, 200),
      mimetype: String(a.mimetype || '').slice(0, 120),
      size: Number(a.size) || 0,
    };
  }).filter(Boolean);
}

let cachedFolderId = null;

export function registerInternalWartaRoutes(app, { wrap }) {
  /** Folder Drive lampiran: dari DB (ChannelLink), atau buat via root env lalu disimpan. */
  async function resolveFolder(prisma) {
    if (cachedFolderId) return cachedFolderId;
    try {
      const link = await prisma.channelLink.findUnique({ where: { kind_refId: { kind: 'INTERNAL_WARTA', refId: 'FOLDER' } } }).catch(() => null);
      if (link?.url) { cachedFolderId = link.url; return cachedFolderId; }
    } catch { /* lanjut */ }
    const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
    if (!rootId) return null;
    const subs = await listFolders(rootId, 100).catch(() => []);
    let folder = subs.find((f) => String(f.name) === FOLDER_NAME);
    if (!folder) {
      const created = await createFolder(rootId, FOLDER_NAME).catch(() => null);
      folder = created ? { id: created.id } : null;
    }
    if (!folder?.id) return null;
    cachedFolderId = folder.id;
    await prisma.channelLink.upsert({
      where: { kind_refId: { kind: 'INTERNAL_WARTA', refId: 'FOLDER' } },
      update: { url: folder.id },
      create: { id: 'cl-internal-warta-folder', kind: 'INTERNAL_WARTA', refId: 'FOLDER', label: FOLDER_NAME, url: folder.id },
    }).catch(() => null);
    return cachedFolderId;
  }

  /** Auto-arsip: PUBLISHED yang deadline-nya lewat. */
  async function autoArchive(prisma) {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    await prisma.internalWarta.updateMany({
      where: { status: 'PUBLISHED', deadline: { lt: today } },
      data: { status: 'ARCHIVED' },
    }).catch(() => null);
  }

  function shape(row, sharer) {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      body: row.body,
      category: row.category,
      caption: row.caption,
      share: sharer ? { id: sharer.id, name: sharer.name, avatar: sharer.avatar } : null,
      shareNote: row.shareNote,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      link: row.link,
      deadline: row.deadline,
      status: row.status,
      isPinned: row.isPinned,
      viewCount: row.viewCount,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
    };
  }

  // GET /api/internal-warta — feed
  app.get('/api/internal-warta', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    await autoArchive(prisma);
    const includeArchived = String(req.query?.archived || '') === '1';
    const q = String(req.query?.q || '').trim();
    const category = String(req.query?.category || '').trim().toUpperCase();
    const where = {};
    if (!includeArchived) where.status = 'PUBLISHED';
    if (WARTA_CATEGORIES.includes(category)) where.category = category;
    if (q) where.OR = [{ title: { contains: q } }, { summary: { contains: q } }, { body: { contains: q } }];
    const rows = await prisma.internalWarta.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }).catch(() => []);
    const ids = [...new Set(rows.map((r) => r.shareUserId).filter(Boolean))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatar: true } }).catch(() => []) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    res.json({ warta: rows.map((r) => shape(r, byId.get(r.shareUserId))), canAdmin: isWartaAdmin(req.authUser), categories: WARTA_CATEGORIES });
  }));

  // GET /api/internal-warta/:id
  app.get('/api/internal-warta/:id', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const row = await prisma.internalWarta.findUnique({ where: { id: req.params.id } }).catch(() => null);
    if (!row) return res.status(404).json({ error: 'Warta tidak ditemukan.' });
    if (row.status === 'PUBLISHED') {
      await prisma.internalWarta.update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);
    }
    const sharer = row.shareUserId
      ? await prisma.user.findUnique({ where: { id: row.shareUserId }, select: { id: true, name: true, avatar: true } }).catch(() => null)
      : null;
    res.json({ warta: shape({ ...row, viewCount: (row.viewCount || 0) + (row.status === 'PUBLISHED' ? 1 : 0) }, sharer) });
  }));

  // POST /api/internal-warta — buat (admin)
  app.post('/api/internal-warta', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { title, summary, body, category, caption, shareUserId, shareNote, attachments, link, deadline, status, isPinned, notify } = req.body || {};
    const cleanTitle = String(title || '').trim().slice(0, 200);
    if (!cleanTitle) return res.status(400).json({ error: 'Judul wajib.' });
    const cat = WARTA_CATEGORIES.includes(String(category || '').toUpperCase()) ? String(category).toUpperCase() : 'UMUM';
    const st = STATUSES.includes(String(status || '').toUpperCase()) ? String(status).toUpperCase() : 'DRAFT';
    const row = await prisma.internalWarta.create({
      data: {
        id: `iw-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        summary: summary ? String(summary).slice(0, 2000) : null,
        body: body ? String(body) : null,
        category: cat,
        caption: caption ? String(caption).slice(0, 4000) : null,
        shareUserId: shareUserId ? String(shareUserId) : null,
        shareNote: shareNote ? String(shareNote).slice(0, 190) : null,
        attachments: cleanAttachments(attachments),
        link: link ? String(link).slice(0, 500) : null,
        deadline: deadline ? new Date(deadline) : null,
        status: st,
        isPinned: Boolean(isPinned),
        createdById: req.authUser?.id || null,
        publishedAt: st === 'PUBLISHED' ? new Date() : null,
      },
    });
    if (st === 'PUBLISHED' && notify !== false) void notifyAllWarta(prisma, row);
    res.status(201).json({ warta: shape(row, null) });
  }));

  // PATCH /api/internal-warta/:id (admin)
  app.patch('/api/internal-warta/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const existing = await prisma.internalWarta.findUnique({ where: { id: req.params.id } }).catch(() => null);
    if (!existing) return res.status(404).json({ error: 'Warta tidak ditemukan.' });
    const b = req.body || {};
    const data = {};
    if (b.title !== undefined) data.title = String(b.title).trim().slice(0, 200);
    if (b.summary !== undefined) data.summary = b.summary ? String(b.summary).slice(0, 2000) : null;
    if (b.body !== undefined) data.body = b.body ? String(b.body) : null;
    if (b.caption !== undefined) data.caption = b.caption ? String(b.caption).slice(0, 4000) : null;
    if (b.category !== undefined) data.category = WARTA_CATEGORIES.includes(String(b.category).toUpperCase()) ? String(b.category).toUpperCase() : 'UMUM';
    if (b.shareUserId !== undefined) data.shareUserId = b.shareUserId ? String(b.shareUserId) : null;
    if (b.shareNote !== undefined) data.shareNote = b.shareNote ? String(b.shareNote).slice(0, 190) : null;
    if (b.attachments !== undefined) data.attachments = cleanAttachments(b.attachments);
    if (b.link !== undefined) data.link = b.link ? String(b.link).slice(0, 500) : null;
    if (b.deadline !== undefined) data.deadline = b.deadline ? new Date(b.deadline) : null;
    if (b.isPinned !== undefined) data.isPinned = Boolean(b.isPinned);
    let becamePublished = false;
    if (b.status !== undefined && STATUSES.includes(String(b.status).toUpperCase())) {
      const st = String(b.status).toUpperCase();
      data.status = st;
      if (st === 'PUBLISHED' && existing.status !== 'PUBLISHED') { data.publishedAt = new Date(); becamePublished = true; }
    }
    const row = await prisma.internalWarta.update({ where: { id: existing.id }, data });
    if (becamePublished && b.notify !== false) void notifyAllWarta(prisma, row);
    res.json({ warta: shape(row, null) });
  }));

  // DELETE /api/internal-warta/:id (admin)
  app.delete('/api/internal-warta/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    await prisma.internalWarta.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ ok: true });
  }));

  // POST /api/internal-warta/upload (admin) — unggah lampiran ke Drive
  app.post('/api/internal-warta/upload', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    const { filename, mimetype, data } = req.body || {};
    const name = String(filename || '').trim() || `lampiran-${Date.now()}`;
    const mime = String(mimetype || 'application/octet-stream');
    const raw = String(data || '');
    if (!raw) return res.status(400).json({ error: 'data wajib.' });
    if (raw.length > 11_000_000) return res.status(413).json({ error: 'Berkas terlalu besar (maks ~8MB).' });
    if (!ALLOWED_MIME.test(mime)) return res.status(415).json({ error: 'Jenis berkas tidak diizinkan (PDF, gambar, Word/PowerPoint/Excel).' });
    const buffer = Buffer.from(raw.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 8_000_000) return res.status(413).json({ error: 'Berkas terlalu besar (maks ~8MB).' });
    const folderId = await resolveFolder(prisma);
    if (!folderId) return res.status(503).json({ error: 'Folder penyimpanan belum siap. Jalankan: npm run db:setup:internal-warta-folder' });
    let file;
    try {
      file = await uploadFile(folderId, { filename: name, mimetype: mime, buffer });
    } catch (e) {
      return res.status(502).json({ error: `Gagal mengunggah ke Drive: ${String(e?.message || e)}. Sementara itu gunakan "Tambah tautan" untuk menempelkan link.` });
    }
    res.status(201).json({ file: { fileId: file.id, name: file.name || name, mimetype: mime, size: buffer.length } });
  }));

  // GET /api/internal-warta/attachment/:fileId (login)
  app.get('/api/internal-warta/attachment/:fileId', requireRole(), wrap(async (req, res) => {
    if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    const fileId = String(req.params.fileId || '');
    if (!fileId) return res.status(400).json({ error: 'fileId wajib.' });
    let got = null;
    try { got = await getFileStream(fileId); } catch { /* coba service account */ }
    if (!got) { try { got = await getFileStreamAsServiceAccount(fileId); } catch { /* gagal */ } }
    if (!got) return res.status(404).json({ error: 'Berkas tidak ditemukan.' });
    const { meta, stream } = got;
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${String(meta.name || 'berkas').replace(/"/g, '')}"`);
    stream.on('error', () => { try { res.end(); } catch { /* abaikan */ } });
    stream.pipe(res);
  }));
}

/** Notifikasi push ke semua akun (dipanggil non-blocking). */
async function notifyAllWarta(prisma, row) {
  try {
    const users = await prisma.user.findMany({ select: { id: true } }).catch(() => []);
    const ids = users.map((u) => u.id).filter(Boolean);
    const title = 'Info & Peluang baru';
    const message = row.title;
    const href = '#/portal';
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await prisma.notification.createMany({
        data: slice.map((uid) => ({
          id: 'ntf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          type: 'IDLE_FLAG',
          memberId: uid,
          title,
          message,
          payload: { href, category: 'warta', priority: 'INFO', itemId: row.id },
          category: 'warta',
          status: 'OPEN',
        })),
      }).catch(() => null);
      await pushToUsers(prisma, slice, { title, message, href, category: 'warta', priority: 'INFO' }).catch(() => {});
    }
  } catch { /* notifikasi opsional */ }
}
