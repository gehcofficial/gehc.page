/**
 * Konteks host → unit pelayanan.
 *
 * Hub gereja hanya untuk allowlist (gehc.page / www.gehc.page).
 * Host lain yang belum dikenal (mis. *.vercel.app, localhost) HARUS tetap
 * dianggap Pemuda agar QR lama & staging tidak berubah.
 */

export const HUB_HOSTS = ['gehc.page', 'www.gehc.page'] as const;

/** Host hub di staging — paritas domain dengan produksi. */
export const STAGING_HUB_HOST = 'staging.gehc.page';

/** Zone jemaat & prefix unit staging (`staging-youth.gehc.page` → youth). */
const ZONE_SUFFIX = '.gehc.page';
const STAGING_UNIT_PREFIX = 'staging-';

export type HostUnit =
  | 'hub'
  | 'youth'
  | 'teen'
  | 'kids'
  | 'men'
  | 'women'
  | 'districts'
  | 'community'
  | 'default';

/** Subdomain resmi → unit. Domain English, id tenant English. */
export const HOST_UNIT_MAP: Record<string, HostUnit> = {
  'youth.gehc.page': 'youth',
  'teen.gehc.page': 'teen',
  'kids.gehc.page': 'kids',
  'men.gehc.page': 'men',
  'women.gehc.page': 'women',
  'districts.gehc.page': 'districts',
  'community.gehc.page': 'community',
};

export function normalizeHost(host: string): string {
  return String(host || '')
    .toLowerCase()
    .replace(/:\d+$/, '')
    .trim();
}

export function isHubHost(host: string): boolean {
  const h = normalizeHost(host);
  return (HUB_HOSTS as readonly string[]).includes(h) || h === STAGING_HUB_HOST;
}

/** True bila host adalah host staging (`staging.gehc.page` / `staging-<unit>.gehc.page`). */
export function isStagingHost(host: string): boolean {
  const h = normalizeHost(host);
  if (h === STAGING_HUB_HOST) return true;
  if (!h.endsWith(ZONE_SUFFIX)) return false;
  return h.slice(0, -ZONE_SUFFIX.length).startsWith(STAGING_UNIT_PREFIX);
}

/** Unit efektif untuk sebuah host (host tak dikenal → 'default' = Pemuda). */
export function resolveHostUnit(host: string): HostUnit {
  const h = normalizeHost(host);
  if (isHubHost(h)) return 'hub';
  const direct = HOST_UNIT_MAP[h];
  if (direct) return direct;
  // Staging: staging-youth.gehc.page → unit youth.
  if (h.endsWith(ZONE_SUFFIX)) {
    const label = h.slice(0, -ZONE_SUFFIX.length);
    if (label.startsWith(STAGING_UNIT_PREFIX)) {
      const unit = HOST_UNIT_MAP[`${label.slice(STAGING_UNIT_PREFIX.length)}${ZONE_SUFFIX}`];
      if (unit) return unit;
    }
  }
  return 'default';
}

/** True bila host ini harus menampilkan aplikasi Pemuda (portal). */
export function isYouthAppHost(host: string): boolean {
  const unit = resolveHostUnit(host);
  return unit === 'youth' || unit === 'default';
}

/** Rute aplikasi (portal/admin/auth) — di host hub ini memicu portal, bukan landing. */
const APP_HASH_PREFIXES = ['#/portal', '#/admin', '#/claim', '#/forgot-password', '#/reset-password'];

export function isAppHash(hash: string): boolean {
  const h = String(hash || '');
  return APP_HASH_PREFIXES.some((p) => h === p || h.startsWith(`${p}/`) || h.startsWith(`${p}?`));
}

/** Halaman presentasi (pitch deck). */
export function isPitchHash(hash: string): boolean {
  const h = String(hash || '');
  return h === '#/pitch' || h.startsWith('#/pitch/') || h.startsWith('#/pitch?');
}

/** Halaman presentasi materi Didaskalia (per pekan/hari). */
export function isMaterialHash(hash: string): boolean {
  const h = String(hash || '');
  return h === '#/materi' || h.startsWith('#/materi/') || h.startsWith('#/materi?');
}

/** Halaman voting logo kelompok (Beyonders). */
export function isVotingHash(hash: string): boolean {
  const h = String(hash || '');
  return h === '#/voting' || h.startsWith('#/voting/') || h.startsWith('#/voting?');
}

/** Presentasi Mentor & Co-Mentor (regenerasi + fitur portal). */
export function isMentorPitchHash(hash: string): boolean {
  const h = String(hash || '');
  return (
    h === '#/pitch-mentor' ||
    h.startsWith('#/pitch-mentor/') ||
    h.startsWith('#/pitch-mentor?') ||
    h === '#/panduan' ||
    h.startsWith('#/panduan/')
  );
}
