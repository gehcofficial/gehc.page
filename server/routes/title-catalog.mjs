import crypto from 'node:crypto';
import { requireRole } from '../auth.mjs';
import { getPrisma } from '../db.mjs';
import { KOMISION_CORE } from '../lib/rbac-constants.mjs';
import { normalizeAcademicAbbr, setTitleCatalogLookups } from '../lib/person-name.mjs';

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

function serializeTitle(row) {
  return {
    id: row.id,
    kind: row.kind,
    code: row.code,
    abbr: row.abbr,
    nameId: row.nameId,
    nameEn: row.nameEn,
    position: row.position,
    locked: row.locked,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

async function refreshLookups(prisma) {
  const rows = await prisma.titleCatalog.findMany({ where: { active: true } });
  setTitleCatalogLookups(rows);
}

function codeFromAbbr(abbr, kind) {
  if (kind === 'CHURCH') {
    return String(abbr || '')
      .replace(/\./g, '')
      .replace(/\s+/g, '')
      .toUpperCase()
      .slice(0, 16);
  }
  return normalizeAcademicAbbr(abbr).slice(0, 32);
}

export function registerTitleCatalogRoutes(app, { wrap }) {
  app.get('/api/titles', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.json({ church: [], academic: [] });
    const includeInactive = String(req.query.all || '') === '1' && req.authUser;
    const where = includeInactive ? {} : { active: true };
    let rows = [];
    try {
      rows = await prisma.titleCatalog.findMany({ where, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] });
    } catch {
      return res.json({ church: [], academic: [] });
    }
    setTitleCatalogLookups(rows.filter((r) => r.active));
    const church = rows.filter((r) => r.kind === 'CHURCH').map(serializeTitle);
    const academic = rows.filter((r) => r.kind === 'ACADEMIC').map(serializeTitle);
    res.json({ church, academic });
  }));

  app.post('/api/titles', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const kind = String(req.body?.kind || 'ACADEMIC').toUpperCase();
    if (!['CHURCH', 'ACADEMIC'].includes(kind)) return res.status(400).json({ error: 'Jenis gelar tidak valid.' });
    const abbrRaw = String(req.body?.abbr || req.body?.code || '').trim();
    const abbr = kind === 'CHURCH'
      ? (abbrRaw.replace(/\s+/g, '') || abbrRaw)
      : normalizeAcademicAbbr(abbrRaw);
    if (!abbr) return res.status(400).json({ error: 'Singkatan gelar wajib.' });
    const code = String(req.body?.code || codeFromAbbr(abbr, kind)).toUpperCase().slice(0, 32);
    if (!code) return res.status(400).json({ error: 'Kode gelar wajib.' });
    const existing = await prisma.titleCatalog.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ error: 'Gelar itu sudah ada di katalog.', title: serializeTitle(existing) });
    const siblings = await prisma.titleCatalog.findMany({ where: { kind }, select: { sortOrder: true } });
    const sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0) + 1;
    const title = await prisma.titleCatalog.create({
      data: {
        id: newId('ttl'),
        kind,
        code,
        abbr: kind === 'CHURCH' ? abbr : normalizeAcademicAbbr(abbr),
        nameId: String(req.body?.nameId || req.body?.name || abbr).trim().slice(0, 120),
        nameEn: String(req.body?.nameEn || req.body?.name || abbr).trim().slice(0, 120),
        position: kind === 'CHURCH' ? 'prefix' : (req.body?.position === 'prefix' ? 'prefix' : 'suffix'),
        locked: false,
        active: true,
        sortOrder,
      },
    });
    await refreshLookups(prisma);
    res.json({ title: serializeTitle(title) });
  }));

  app.patch('/api/titles/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const row = await prisma.titleCatalog.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Gelar tidak ditemukan.' });
    const data = {};
    if (req.body?.active === true || req.body?.active === false) data.active = Boolean(req.body.active);
    if (req.body?.nameId) data.nameId = String(req.body.nameId).trim().slice(0, 120);
    if (req.body?.nameEn) data.nameEn = String(req.body.nameEn).trim().slice(0, 120);
    // Singkatan boleh diubah termasuk gelar inti (Pdt/Pnt/Dkn/Kr): profil menyimpan
    // kode stabil (PDT/…) sehingga tampilan mengikuti katalog; code tidak bisa diubah.
    if (req.body?.abbr) {
      const abbr = row.kind === 'CHURCH'
        ? String(req.body.abbr).trim().replace(/\s+/g, '').slice(0, 32)
        : normalizeAcademicAbbr(req.body.abbr);
      if (!abbr) return res.status(400).json({ error: 'Singkatan gelar wajib.' });
      data.abbr = abbr;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada field untuk diupdate.' });
    const title = await prisma.titleCatalog.update({ where: { id: row.id }, data });
    await refreshLookups(prisma);
    res.json({ title: serializeTitle(title) });
  }));

  app.delete('/api/titles/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const row = await prisma.titleCatalog.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Gelar tidak ditemukan.' });
    // Gelar inti boleh dihapus bila benar-benar perlu: profil lama tetap tampil
    // lewat peta bawaan (PDT→Pdt, dst.), hanya hilang dari picker.
    await prisma.titleSuggestion.updateMany({ where: { titleId: row.id }, data: { titleId: null } });
    await prisma.titleCatalog.delete({ where: { id: row.id } });
    await refreshLookups(prisma);
    res.json({ ok: true });
  }));

  app.post('/api/titles/suggest', wrap(async (req, res) => {
    if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const kind = String(req.body?.kind || 'ACADEMIC').toUpperCase();
    if (!['CHURCH', 'ACADEMIC'].includes(kind)) return res.status(400).json({ error: 'Jenis gelar tidak valid.' });
    const abbr = kind === 'CHURCH'
      ? String(req.body?.abbr || '').trim().slice(0, 32)
      : normalizeAcademicAbbr(req.body?.abbr || '');
    if (!abbr) return res.status(400).json({ error: 'Singkatan gelar wajib.' });
    const code = codeFromAbbr(abbr, kind);
    const known = await prisma.titleCatalog.findFirst({
      where: { OR: [{ code }, { abbr }] },
    });
    if (known) return res.json({ ok: true, existing: true, title: serializeTitle(known) });
    const pending = await prisma.titleSuggestion.findFirst({
      where: { abbr, status: 'PENDING' },
    });
    if (pending) return res.json({ ok: true, suggestion: pending });
    const suggestion = await prisma.titleSuggestion.create({
      data: {
        id: newId('tsg'),
        userId: req.authUser.id,
        kind,
        abbr,
        nameHint: req.body?.nameHint ? String(req.body.nameHint).trim().slice(0, 120) : null,
        status: 'PENDING',
      },
    });
    res.json({ ok: true, suggestion });
  }));

  app.get('/api/titles/suggestions', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const status = String(req.query.status || 'PENDING');
    const suggestions = await prisma.titleSuggestion.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ suggestions });
  }));

  app.post('/api/titles/suggestions/:id/approve', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const sug = await prisma.titleSuggestion.findUnique({ where: { id: req.params.id } });
    if (!sug) return res.status(404).json({ error: 'Saran tidak ditemukan.' });
    if (sug.status !== 'PENDING') return res.status(400).json({ error: 'Saran sudah diproses.' });
    const kind = sug.kind === 'CHURCH' ? 'CHURCH' : 'ACADEMIC';
    const abbr = sug.abbr;
    const code = codeFromAbbr(abbr, kind);
    let title = await prisma.titleCatalog.findFirst({ where: { OR: [{ code }, { abbr }] } });
    if (!title) {
      const siblings = await prisma.titleCatalog.findMany({ where: { kind }, select: { sortOrder: true } });
      title = await prisma.titleCatalog.create({
        data: {
          id: newId('ttl'),
          kind,
          code,
          abbr,
          nameId: sug.nameHint || abbr,
          nameEn: sug.nameHint || abbr,
          position: kind === 'CHURCH' ? 'prefix' : 'suffix',
          locked: false,
          active: true,
          sortOrder: siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0) + 1,
        },
      });
    }
    await prisma.titleSuggestion.update({
      where: { id: sug.id },
      data: { status: 'APPROVED', titleId: title.id },
    });
    await refreshLookups(prisma);
    res.json({ ok: true, title: serializeTitle(title) });
  }));

  app.post('/api/titles/suggestions/:id/reject', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const sug = await prisma.titleSuggestion.findUnique({ where: { id: req.params.id } });
    if (!sug) return res.status(404).json({ error: 'Saran tidak ditemukan.' });
    await prisma.titleSuggestion.update({ where: { id: sug.id }, data: { status: 'REJECTED' } });
    res.json({ ok: true });
  }));
}
