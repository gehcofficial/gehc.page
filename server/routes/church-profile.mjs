import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';

const CHURCH_PROFILE_ID = 'church-profile';
const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube'];

const DEFAULT_MAP_URL = 'https://share.google/Ro2jBSuGfrzfg49nP';
const DEFAULT_MAP_QUERY = 'GMIM Eben Haezer Cikarang';
const DEFAULT_SCHEDULES = [
  { label: 'Ibadah Umum', day: 'Minggu', time: '10.00 WIB' },
  { label: 'Ibadah Pemuda', day: 'Minggu', time: '13.00 WIB' },
];

const str = (v, max = 300) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

function envDefaults() {
  return {
    id: CHURCH_PROFILE_ID,
    name: 'GMIM Eben Haezer Cikarang',
    tagline: 'Satu gereja, banyak pelayanan.',
    description: null,
    addressText:
      'Gereja GMIM Eben Haezer, Jl. Kasuari No. 12, Cikarang Baru, Kab. Bekasi, Jawa Barat, Indonesia',
    mapShareUrl: process.env.GEHC_MAP_URL?.trim() || DEFAULT_MAP_URL,
    mapEmbedQuery: process.env.BAKU_TAU_MAP_EMBED_QUERY?.trim() || DEFAULT_MAP_QUERY,
    contactEmail: null,
    contactPhone: null,
    whatsapp: null,
    schedules: DEFAULT_SCHEDULES,
    socials: {},
  };
}

function pickSocials(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || typeof raw !== 'object') return {};
  const out = {};
  for (const k of SOCIAL_KEYS) {
    const v = str(raw[k], 300);
    if (v) out[k] = v;
  }
  return out;
}

function pickSchedules(raw) {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((row) => ({
      label: str(row?.label, 80),
      day: str(row?.day, 40),
      time: str(row?.time, 60),
    }))
    .filter((row) => row.label || row.day || row.time);
}

function mergeProfile(row) {
  const base = envDefaults();
  if (!row) return base;
  return {
    ...base,
    ...row,
    schedules: Array.isArray(row.schedules) && row.schedules.length ? row.schedules : base.schedules,
    socials: row.socials && typeof row.socials === 'object' ? row.socials : {},
  };
}

export function registerChurchProfileRoutes(app, { wrap }) {
  /** Publik: profil gereja church-wide. */
  app.get('/api/church-profile', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.json({ profile: envDefaults() });
    const row = await prisma.churchProfile.findUnique({ where: { id: CHURCH_PROFILE_ID } });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ profile: mergeProfile(row) });
  }));

  app.put(
    '/api/church-profile',
    requireRole('SUPERADMIN', 'BPMJ', 'KOMISI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const b = req.body || {};
      const name = str(b.name, 200);
      if (!name) return res.status(400).json({ error: 'Nama gereja wajib diisi.' });

      const socials = pickSocials(b.socials);
      const schedules = pickSchedules(b.schedules);

      const data = {
        name,
        tagline: str(b.tagline, 300),
        description: str(b.description, 2000),
        addressText: str(b.addressText, 1000),
        mapShareUrl: str(b.mapShareUrl, 1000),
        mapEmbedQuery: str(b.mapEmbedQuery, 300),
        contactEmail: str(b.contactEmail, 190),
        contactPhone: str(b.contactPhone, 40),
        whatsapp: str(b.whatsapp, 40),
        updatedById: req.authUser?.id || null,
      };
      if (socials !== undefined) data.socials = socials;
      if (schedules !== undefined) data.schedules = schedules;

      const profile = await prisma.churchProfile.upsert({
        where: { id: CHURCH_PROFILE_ID },
        create: { id: CHURCH_PROFILE_ID, ...data },
        update: data,
      });
      res.json({ profile: mergeProfile(profile) });
    }),
  );

  /** Publik: daftar unit + profil singkat (hub/direktori). */
  app.get('/api/tenants', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.json({ tenants: [] });
    const tenants = await prisma.tenant.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ tenants });
  }));

  /** Publik: profil satu unit. */
  app.get('/api/tenants/:slug/profile', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const tenant = await prisma.tenant.findUnique({ where: { slug: String(req.params.slug) } });
    if (!tenant) return res.status(404).json({ error: 'Unit tidak ditemukan.' });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ tenant });
  }));

  app.put(
    '/api/tenants/:slug/profile',
    requireRole('SUPERADMIN', 'BPMJ', 'KOMISI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const tenant = await prisma.tenant.findUnique({ where: { slug: String(req.params.slug) } });
      if (!tenant) return res.status(404).json({ error: 'Unit tidak ditemukan.' });

      const b = req.body || {};
      const data = {};
      if (b.tagline !== undefined) data.tagline = str(b.tagline, 300);
      if (b.contactEmail !== undefined) data.contactEmail = str(b.contactEmail, 190);
      const socials = pickSocials(b.socials);
      if (socials !== undefined) data.socials = socials;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });

      const updated = await prisma.tenant.update({ where: { id: tenant.id }, data });
      res.json({ tenant: updated });
    }),
  );
}
