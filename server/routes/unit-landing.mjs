/**
 * Landing publik per subdomain unit (F4) — data-driven dari tabel `Tenant`.
 *
 *   GET /api/unit/landing           -> profil unit untuk host saat ini
 *   GET /api/units/:slug/pengurus   -> struktur pengurus unit (StrukturMember.tenantId)
 *
 * Publik (tanpa login). Host hub/unit tak dikenal mengikuti konteks host yang ada,
 * jadi fallback Pemuda tetap utuh. Klien menggabungkan hasil ini dengan data
 * statis `src/data/churchUnits.ts` bila kolom Tenant masih kosong.
 */
import { getPrisma } from '../db.mjs';
import { resolveHostContext, normalizeHost } from '../lib/host-context.mjs';

const CHURCH_PROFILE_ID = 'church-profile';

const PORTAL_TENANTS = {
  jemaat: { unit: 'hub', tenantId: 'tenant-jemaat', bipra: null },
  youth: { unit: 'youth', tenantId: 'tenant-youth', bipra: 'PEMUDA' },
  men: { unit: 'men', tenantId: 'tenant-men', bipra: 'BAPAK' },
  women: { unit: 'women', tenantId: 'tenant-women', bipra: 'IBU' },
  teen: { unit: 'teen', tenantId: 'tenant-teen', bipra: 'REMAJA' },
  kids: { unit: 'kids', tenantId: 'tenant-kids', bipra: 'ANAK' },
  kolom: { unit: 'districts', tenantId: 'tenant-districts', bipra: null },
  community: { unit: 'community', tenantId: 'tenant-community', bipra: null },
};

function isKnownGehcHost(req) {
  const h = normalizeHost(req?.get?.('host') || req?.headers?.host || '');
  return h === 'gehc.page' || h === 'www.gehc.page' || h.endsWith('.gehc.page');
}

/** Konteks unit efektif: host gehc.page menang; host tak dikenal boleh `?portal=`. */
export function effectiveContext(req) {
  const ctx = resolveHostContext(req);
  const portal = String(req.query?.portal || '').toLowerCase();
  if (!isKnownGehcHost(req) && PORTAL_TENANTS[portal]) {
    return { ...PORTAL_TENANTS[portal], isHub: false };
  }
  return ctx;
}

function pickSchedules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((row) => ({
      label: row?.label ? String(row.label).slice(0, 80) : null,
      day: row?.day ? String(row.day).slice(0, 40) : null,
      time: row?.time ? String(row.time).slice(0, 60) : null,
    }))
    .filter((row) => row.label || row.day || row.time);
}

function publicTenant(tenant) {
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    tagline: tenant.tagline || null,
    description: tenant.description || null,
    contactEmail: tenant.contactEmail || null,
    socials: tenant.socials && typeof tenant.socials === 'object' ? tenant.socials : {},
    logoUrl: tenant.logoUrl || null,
    heroImageUrl: tenant.heroImageUrl || null,
    schedules: pickSchedules(tenant.schedules),
    themeTone: tenant.themeTone || null,
    registrationOpen: Boolean(tenant.registrationOpen),
    defaultBipra: tenant.defaultBipra || null,
    branding: {
      brand: tenant.brandAccent || null,
      brandEnd: tenant.brandAccent2 || null,
      brandInk: tenant.brandInk || null,
    },
  };
}

export function registerUnitLandingRoutes(app, { wrap }) {
  /** Publik: profil landing untuk host unit aktif (hub => tenant-jemaat). */
  app.get(
    '/api/unit/landing',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const ctx = effectiveContext(req);
      if (!prisma) {
        return res.json({ unit: ctx, tenant: null, church: null });
      }

      const [tenant, church] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: ctx.tenantId } }).catch(() => null),
        prisma.churchProfile.findUnique({ where: { id: CHURCH_PROFILE_ID } }).catch(() => null),
      ]);

      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.json({
        unit: { id: ctx.unit, tenantId: ctx.tenantId, bipra: ctx.bipra, isHub: Boolean(ctx.isHub) },
        tenant: publicTenant(tenant),
        church: church
          ? {
              name: church.name || null,
              addressText: church.addressText || null,
              mapShareUrl: church.mapShareUrl || null,
              contactEmail: church.contactEmail || null,
              schedules: pickSchedules(church.schedules),
              socials: church.socials && typeof church.socials === 'object' ? church.socials : {},
            }
          : null,
      });
    }),
  );

  /** Publik: struktur pengurus satu unit (StrukturMember ber-tenantId unit). */
  app.get(
    '/api/units/:slug/pengurus',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ members: [] });
      const tenant = await prisma.tenant
        .findUnique({ where: { slug: String(req.params.slug) } })
        .catch(() => null);
      if (!tenant) return res.status(404).json({ error: 'Unit tidak ditemukan.' });

      const members = await prisma.strukturMember
        .findMany({
          where: { tenantId: tenant.id },
          orderBy: [{ sortOrder: 'asc' }, { roleOrder: 'asc' }],
          select: {
            id: true,
            name: true,
            position: true,
            subdivision: true,
            division: true,
            photoUrl: true,
            sortOrder: true,
            isOpenRole: true,
          },
        })
        .catch(() => []);

      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.json({ tenantId: tenant.id, slug: tenant.slug, members });
    }),
  );
}
