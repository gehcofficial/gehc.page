/**
 * Daftar host STAGING — paritas domain dengan produksi.
 *
 *   Hub : staging.gehc.page            ↔ gehc.page
 *   Unit: staging-<unit>.gehc.page     ↔ <unit>.gehc.page
 *
 * Dipakai scripts/deploy-staging.mjs & scripts/sync-staging.mjs untuk memasang
 * alias ke deployment preview yang sama. Deteksi di aplikasi: lihat
 * src/lib/host-context.ts (isHubHost/resolveHostUnit) — jaga tetap sinkron.
 */

export const STAGING_HUB_HOST = 'staging.gehc.page';

export const STAGING_UNIT_HOSTS = [
  'staging-youth.gehc.page',
  'staging-teen.gehc.page',
  'staging-kids.gehc.page',
  'staging-men.gehc.page',
  'staging-women.gehc.page',
  'staging-districts.gehc.page',
  'staging-community.gehc.page',
];

/** Hub dulu, lalu unit. */
export const STAGING_HOSTS = [STAGING_HUB_HOST, ...STAGING_UNIT_HOSTS];

/** Alias vercel.app lama — dipertahankan agar tautan/QR lama tidak putus. */
export const LEGACY_ALIAS = 'staging-gehcpage.vercel.app';

/** Semua alias yang dipasang ke deployment staging. */
export const ALL_STAGING_ALIASES = [...STAGING_HOSTS, LEGACY_ALIAS];
