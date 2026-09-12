/**
 * Konteks host → unit pelayanan.
 *
 * Hub gereja hanya untuk allowlist (gehc.page / www.gehc.page).
 * Host lain yang belum dikenal (mis. *.vercel.app, localhost) HARUS tetap
 * dianggap Pemuda agar QR lama & staging tidak berubah.
 */

export const HUB_HOSTS = ['gehc.page', 'www.gehc.page'] as const;

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
  return (HUB_HOSTS as readonly string[]).includes(normalizeHost(host));
}

/** Unit efektif untuk sebuah host (host tak dikenal → 'default' = Pemuda). */
export function resolveHostUnit(host: string): HostUnit {
  const h = normalizeHost(host);
  if (isHubHost(h)) return 'hub';
  return HOST_UNIT_MAP[h] || 'default';
}

/** True bila host ini harus menampilkan aplikasi Pemuda (portal). */
export function isYouthAppHost(host: string): boolean {
  const unit = resolveHostUnit(host);
  return unit === 'youth' || unit === 'default';
}
