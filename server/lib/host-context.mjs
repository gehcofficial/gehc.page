/**
 * Host → konteks unit (server-side).
 * Cerminan src/lib/host-context.ts — jaga tetap sinkron.
 *
 * Fallback WAJIB Pemuda untuk host tak dikenal (*.vercel.app, localhost, preview)
 * agar QR/landing lama tidak berubah.
 */

export const HUB_HOSTS = ['gehc.page', 'www.gehc.page'];

/** Host hub di staging — paritas domain dengan produksi. */
export const STAGING_HUB_HOST = 'staging.gehc.page';

/** Zone jemaat & prefix unit staging (`staging-youth.gehc.page` → youth). */
const ZONE_SUFFIX = '.gehc.page';
const STAGING_UNIT_PREFIX = 'staging-';

/** Domain English → unit + tenant + kategorial default. */
export const HOST_UNIT_MAP = {
  'youth.gehc.page': { unit: 'youth', tenantId: 'tenant-youth', bipra: 'PEMUDA' },
  'teen.gehc.page': { unit: 'teen', tenantId: 'tenant-teen', bipra: 'REMAJA' },
  'kids.gehc.page': { unit: 'kids', tenantId: 'tenant-kids', bipra: 'ANAK' },
  'men.gehc.page': { unit: 'men', tenantId: 'tenant-men', bipra: 'BAPAK' },
  'women.gehc.page': { unit: 'women', tenantId: 'tenant-women', bipra: 'IBU' },
  'districts.gehc.page': { unit: 'districts', tenantId: 'tenant-districts', bipra: null },
  'community.gehc.page': { unit: 'community', tenantId: 'tenant-community', bipra: null },
};

const FALLBACK = { unit: 'youth', tenantId: 'tenant-youth', bipra: 'PEMUDA', isHub: false };
const HUB = { unit: 'hub', tenantId: null, bipra: null, isHub: true };

export function normalizeHost(host) {
  return String(host || '')
    .toLowerCase()
    .replace(/:\d+$/, '')
    .trim();
}

export function hostFromReq(req) {
  if (typeof req === 'string') return normalizeHost(req);
  return normalizeHost(req?.get?.('host') || req?.headers?.host || '');
}

/** True bila host adalah host staging (hub `staging.gehc.page` / `staging-<unit>.gehc.page`). */
export function isStagingHost(host) {
  const h = normalizeHost(host);
  if (h === STAGING_HUB_HOST) return true;
  if (!h.endsWith(ZONE_SUFFIX)) return false;
  const label = h.slice(0, -ZONE_SUFFIX.length);
  return label.startsWith(STAGING_UNIT_PREFIX);
}

/** Konteks unit efektif untuk sebuah request (host hub → netral). */
export function resolveHostContext(req) {
  const host = hostFromReq(req);
  if (HUB_HOSTS.includes(host) || host === STAGING_HUB_HOST) return { ...HUB };
  const mapped = HOST_UNIT_MAP[host];
  if (mapped) return { ...mapped, isHub: false };
  // Staging: staging-youth.gehc.page → unit youth.
  if (host.endsWith(ZONE_SUFFIX)) {
    const label = host.slice(0, -ZONE_SUFFIX.length);
    if (label.startsWith(STAGING_UNIT_PREFIX)) {
      const unit = HOST_UNIT_MAP[`${label.slice(STAGING_UNIT_PREFIX.length)}${ZONE_SUFFIX}`];
      if (unit) return { ...unit, isHub: false };
    }
  }
  return { ...FALLBACK };
}

/** Unit string untuk kolom registration_origin. */
export function registrationOriginFor(req) {
  return resolveHostContext(req).unit;
}
