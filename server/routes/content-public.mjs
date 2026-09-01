import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { getDriveMode, listFolders, listFiles, getFolderChain } from '../gdrive.mjs';
import { resolveAccess } from '../gdrive-policy.mjs';
import { fromDbContent, toDbContent, syncWartaToContentItem } from '../lib/content-map.mjs';
import {
  VISUAL_SLOTS,
  WEBSITE_VISUAL_FOLDER,
  WARTA_PUBLIK_FOLDER,
  matchStem,
  slugifyName,
} from '../lib/website-visuals.mjs';
import {
  loadStaticSlots,
  validateStaticSlots,
  emptySlots,
  assignSlot,
  slotsHasAny,
} from '../lib/static-visuals.mjs';

const CMS_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

const LANDING_MEDIA_KEYS = [
  'heroBanner',
  'collageWorship',
  'collageCommunity',
  'collageMusic',
  'collageStudy',
  'collageFriends',
  'collagePortrait',
];

function cacheVersion(file) {
  if (file?.modifiedTime) return Date.parse(file.modifiedTime) || file.id;
  return file?.id || '0';
}

function publicFileUrl(file) {
  if (!file) return null;
  const v = cacheVersion(file);
  // Stream via API — thumbnail Google CDN sering stale setelah replace-in-place di Drive.
  return `/api/drive/file/${file.id}/content?v=${v}`;
}

function pickSlotFile(files, stem) {
  const matches = (files || []).filter((f) => matchStem(f.name, stem));
  if (!matches.length) return null;
  return matches.sort(
    (a, b) => Date.parse(b.modifiedTime || 0) - Date.parse(a.modifiedTime || 0)
  )[0];
}

async function folderAllowed(folder) {
  if (!folder) return false;
  const chain = await getFolderChain(folder.id);
  const verdict = await resolveAccess(chain, null);
  return Boolean(verdict.allowed);
}

async function findNamedFolder(parentId, matcher) {
  const folders = await listFolders(parentId, 100);
  if (typeof matcher === 'string') {
    const want = matcher.toLowerCase();
    return folders.find((f) => f.name.toLowerCase() === want) || null;
  }
  return folders.find((f) => matcher.test(f.name)) || null;
}

async function findWebsiteVisualRoot() {
  return findNamedFolder(undefined, new RegExp(`^${WEBSITE_VISUAL_FOLDER.replace(/[[\]]/g, '\\$&')}$`, 'i'));
}

let slotsCache = { at: 0, data: null };
const SLOTS_TTL = 60_000;

async function loadDriveSlots() {
  if (slotsCache.data && Date.now() - slotsCache.at < SLOTS_TTL) return slotsCache.data;

  const staticRaw = loadStaticSlots();
  const staticResult = staticRaw ? validateStaticSlots(staticRaw) : null;
  if (staticResult) {
    slotsCache = { at: Date.now(), data: staticResult };
    return staticResult;
  }

  const slots = emptySlots();
  if (!getDriveMode()) {
    slotsCache = { at: Date.now(), data: { slots, source: 'fallback' } };
    return slotsCache.data;
  }

  try {
    const root = await findWebsiteVisualRoot();
    if (!root || !(await folderAllowed(root))) {
      slotsCache = { at: Date.now(), data: { slots, source: 'fallback' } };
      return slotsCache.data;
    }

    const subfolders = await listFolders(root.id, 50);
    const byName = new Map(subfolders.map((f) => [f.name.toLowerCase(), f]));
    const filesByFolder = new Map();

    const folderNames = new Set([
      ...VISUAL_SLOTS.map((s) => s.folder.toLowerCase()),
      'pengurus',
      'testimoni',
    ]);
    const foldersToLoad = [...folderNames]
      .map((name) => byName.get(name))
      .filter(Boolean);

    await Promise.all(
      foldersToLoad.map(async (folder) => {
        const files = await listFiles({ folderId: folder.id, pageSize: 50, fresh: true });
        filesByFolder.set(folder.id, files);
      })
    );

    for (const slot of VISUAL_SLOTS) {
      const folder = byName.get(slot.folder.toLowerCase());
      if (!folder) continue;
      const files = filesByFolder.get(folder.id) || [];
      const file = pickSlotFile(files, slot.stem);
      if (file) assignSlot(slots, slot.key, publicFileUrl(file));
    }

    const pengurusFolder = byName.get('pengurus');
    if (pengurusFolder) {
      const files = filesByFolder.get(pengurusFolder.id) || (await listFiles({ folderId: pengurusFolder.id, pageSize: 50 }));
      for (const f of files) {
        const stem = String(f.name || '').replace(/\.[^.]+$/, '').toLowerCase();
        if (stem.startsWith('contoh-') || stem.startsWith('_')) continue;
        const url = publicFileUrl(f);
        if (url) slots.pengurus[stem] = url;
      }
    }

    const testimoniFolder = byName.get('testimoni');
    if (testimoniFolder) {
      const files = filesByFolder.get(testimoniFolder.id) || (await listFiles({ folderId: testimoniFolder.id, pageSize: 50 }));
      for (const f of files) {
        const stem = String(f.name || '').replace(/\.[^.]+$/, '').toLowerCase();
        if (stem.startsWith('contoh-') || stem.startsWith('_')) continue;
        const url = publicFileUrl(f);
        if (url) slots.testimoni[stem] = url;
      }
    }

    const hasAny = slotsHasAny(slots);
    slotsCache = { at: Date.now(), data: { slots, source: hasAny ? 'drive' : 'fallback' } };
    return slotsCache.data;
  } catch {
    slotsCache = { at: Date.now(), data: { slots, source: 'fallback' } };
    return slotsCache.data;
  }
}

export function registerContentPublicRoutes(app, { wrap }) {
  app.get('/api/content/public', wrap(async (_req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const items = await prisma.contentItem.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: 'desc' }],
      take: 100,
    });

    res.json({ items: items.map(fromDbContent) });
  }));

  app.post('/api/content', requireRole(...CMS_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const body = req.body || {};
    if (!body.type || !body.title) {
      return res.status(400).json({ error: 'type & title wajib' });
    }

    const id = body.id || `cnt-${Date.now()}`;
    const data = toDbContent(body, { id });
    const created = await prisma.contentItem.create({ data });
    res.status(201).json({ item: fromDbContent(created) });
  }));

  app.patch('/api/content/:id', requireRole(...CMS_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const existing = await prisma.contentItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Konten tidak ditemukan' });

    const merged = fromDbContent(existing);
    Object.assign(merged, req.body || {});
    const data = toDbContent(merged, { id: req.params.id });
    const updated = await prisma.contentItem.update({ where: { id: req.params.id }, data });
    res.json({ item: fromDbContent(updated) });
  }));

  app.delete('/api/content/:id', requireRole(...CMS_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    await prisma.contentItem.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ ok: true });
  }));

  app.get('/api/gallery/public', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const { eventId, division } = req.query;
    const where = { status: 'APPROVED' };
    if (eventId) where.eventId = eventId;
    if (division) where.division = division;

    const items = await prisma.eventGallery.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ items });
  }));

  app.get('/api/media/landing', wrap(async (_req, res) => {
    const { slots, source } = await loadDriveSlots();
    const media = {};
    for (const key of LANDING_MEDIA_KEYS) {
      if (slots.landing?.[key]) media[key] = slots.landing[key];
    }
    res.json({
      media: Object.keys(media).length > 0 ? media : null,
      source: Object.keys(media).length > 0 ? source : 'fallback',
      heroVideo: slots.landing?.heroVideo || null,
    });
  }));

  app.get('/api/media/slots', wrap(async (_req, res) => {
    const { slots, source } = await loadDriveSlots();
    res.json({ slots, source });
  }));

  app.get('/api/media/warta-album', wrap(async (req, res) => {
    if (!getDriveMode()) return res.json({ files: [], source: 'fallback' });
    const publishedAt = String(req.query.publishedAt || req.query.date || '').slice(0, 10);
    const title = String(req.query.title || '');
    const slug = slugifyName(title).slice(0, 48);

    try {
      const root = await findNamedFolder(undefined, new RegExp(WARTA_PUBLIK_FOLDER.replace(/[[\]]/g, '\\$&'), 'i'));
      if (!root || !(await folderAllowed(root))) return res.json({ files: [], source: 'fallback' });

      const editions = await listFolders(root.id, 100);
      const needleDate = publishedAt.toLowerCase();
      const edition =
        editions.find((f) => needleDate && f.name.toLowerCase().includes(needleDate)) ||
        editions.find((f) => slug && f.name.toLowerCase().includes(slug)) ||
        null;
      if (!edition) return res.json({ files: [], source: 'drive' });

      const subs = await listFolders(edition.id, 20);
      const foto = subs.find((f) => /^foto$/i.test(f.name)) || edition;
      const files = (await listFiles({ folderId: foto.id, pageSize: 36 })).filter(
        (f) => f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/')
      );
      res.json({
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          url: publicFileUrl(f),
          thumbnailUrl: f.thumbnailUrl || f.thumbnailLink,
        })),
        folderId: foto.id,
        source: 'drive',
      });
    } catch {
      res.json({ files: [], source: 'fallback' });
    }
  }));

  function mapTestimonial(row) {
    return {
      id: row.id,
      tenantId: row.tenantId ?? row.tenant_id,
      authorName: row.authorName ?? row.author_name,
      groupName: row.groupName ?? row.group_name ?? null,
      quote: row.quote,
      photoUrl: row.photoUrl ?? row.photo_url ?? null,
      isPublished: Boolean(row.isPublished ?? row.is_published),
      sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  async function listTestimonials(prisma, { publishedOnly } = {}) {
    if (prisma.testimonial) {
      const items = await prisma.testimonial.findMany({
        where: publishedOnly ? { isPublished: true } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: publishedOnly ? 50 : 200,
      });
      return items.map(mapTestimonial);
    }
    const rows = publishedOnly
      ? await prisma.$queryRawUnsafe(
          `SELECT * FROM testimonials WHERE is_published = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 50`
        )
      : await prisma.$queryRawUnsafe(
          `SELECT * FROM testimonials ORDER BY sort_order ASC, created_at DESC LIMIT 200`
        );
    return (rows || []).map(mapTestimonial);
  }

  app.get('/api/testimonials/public', wrap(async (_req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    try {
      const items = await listTestimonials(prisma, { publishedOnly: true });
      res.json({ items });
    } catch {
      res.json({ items: [] });
    }
  }));

  app.get('/api/testimonials', requireRole(...CMS_ROLES), wrap(async (_req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    try {
      const items = await listTestimonials(prisma, { publishedOnly: false });
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Gagal membaca testimoni' });
    }
  }));

  app.post('/api/testimonials', requireRole(...CMS_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const { authorName, groupName, quote, photoUrl, isPublished, sortOrder } = req.body || {};
    if (!authorName?.trim() || !quote?.trim()) {
      return res.status(400).json({ error: 'authorName & quote wajib' });
    }
    const id = `tst-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const pub = Boolean(isPublished);
    const order = Number(sortOrder) || 0;
    const gName = groupName?.trim() || null;
    const pUrl = photoUrl?.trim() || null;

    if (prisma.testimonial) {
      const item = await prisma.testimonial.create({
        data: {
          id,
          tenantId: 'tenant-youth',
          authorName: authorName.trim(),
          groupName: gName,
          quote: quote.trim(),
          photoUrl: pUrl,
          isPublished: pub,
          sortOrder: order,
        },
      });
      return res.status(201).json({ item: mapTestimonial(item) });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO testimonials (id, tenant_id, author_name, group_name, quote, photo_url, is_published, sort_order)
       VALUES (?, 'tenant-youth', ?, ?, ?, ?, ?, ?)`,
      id,
      authorName.trim(),
      gName,
      quote.trim(),
      pUrl,
      pub ? 1 : 0,
      order
    );
    res.status(201).json({
      item: mapTestimonial({
        id,
        tenant_id: 'tenant-youth',
        author_name: authorName.trim(),
        group_name: gName,
        quote: quote.trim(),
        photo_url: pUrl,
        is_published: pub,
        sort_order: order,
      }),
    });
  }));

  app.patch('/api/testimonials/:id', requireRole(...CMS_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const body = req.body || {};
    if (prisma.testimonial) {
      const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Testimoni tidak ditemukan' });
      const data = {};
      if (body.authorName !== undefined) data.authorName = String(body.authorName).trim();
      if (body.groupName !== undefined) data.groupName = body.groupName?.trim() || null;
      if (body.quote !== undefined) data.quote = String(body.quote).trim();
      if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl?.trim() || null;
      if (body.isPublished !== undefined) data.isPublished = Boolean(body.isPublished);
      if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
      const item = await prisma.testimonial.update({ where: { id: req.params.id }, data });
      return res.json({ item: mapTestimonial(item) });
    }

    const found = await prisma.$queryRawUnsafe(
      `SELECT * FROM testimonials WHERE id = ? LIMIT 1`,
      req.params.id
    );
    const rows = Array.isArray(found) ? found[0] : null;
    if (!rows) return res.status(404).json({ error: 'Testimoni tidak ditemukan' });

    const next = {
      author_name: body.authorName !== undefined ? String(body.authorName).trim() : rows.author_name,
      group_name: body.groupName !== undefined ? body.groupName?.trim() || null : rows.group_name,
      quote: body.quote !== undefined ? String(body.quote).trim() : rows.quote,
      photo_url: body.photoUrl !== undefined ? body.photoUrl?.trim() || null : rows.photo_url,
      is_published:
        body.isPublished !== undefined ? (body.isPublished ? 1 : 0) : rows.is_published ? 1 : 0,
      sort_order: body.sortOrder !== undefined ? Number(body.sortOrder) || 0 : rows.sort_order,
    };
    await prisma.$executeRawUnsafe(
      `UPDATE testimonials SET author_name=?, group_name=?, quote=?, photo_url=?, is_published=?, sort_order=? WHERE id=?`,
      next.author_name,
      next.group_name,
      next.quote,
      next.photo_url,
      next.is_published,
      next.sort_order,
      req.params.id
    );
    res.json({ item: mapTestimonial({ id: req.params.id, ...next }) });
  }));

  app.delete('/api/testimonials/:id', requireRole(...CMS_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (prisma.testimonial) {
      await prisma.testimonial.delete({ where: { id: req.params.id } }).catch(() => null);
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM testimonials WHERE id = ?`, req.params.id).catch(() => null);
    }
    res.json({ ok: true });
  }));
}

export { syncWartaToContentItem };
