/**
 * Host → konteks unit (server-side).
 * Cerminan src/lib/host-context.ts — jaga tetap sinkron.
 *
 * Fallback WAJIB Pemuda untuk host tak dikenal (*.vercel.app, localhost, preview)
 * agar QR/landing lama tidak berubah.
 */

export const HUB_HOSTS = ['gehc.page', 'www.gehc.page'];

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

/** Konteks unit efektif untuk sebuah request (host hub → netral). */
export function resolveHostContext(req) {
  const host = hostFromReq(req);
  if (HUB_HOSTS.includes(host)) return { ...HUB };
  const mapped = HOST_UNIT_MAP[host];
  if (mapped) return { ...mapped, isHub: false };
  return { ...FALLBACK };
}

/** Unit string untuk kolom registration_origin. */
export function registrationOriginFor(req) {
  return resolveHostContext(req).unit;
}
