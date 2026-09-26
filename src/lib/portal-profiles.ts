/**
 * Profil PORTAL per domain/subdomain.
 *
 * Satu database jemaat, banyak portal: setiap host (domain/subdomain) menampilkan
 * portal dengan subset nav-nya sendiri. Ini melengkapi src/lib/host-context.ts
 * (host -> unit pelayanan) dengan konsep "portal" (host -> nav + lingkup data).
 *
 *   gehc.page        -> portal 'jemaat'  (lingkup JEMAAT: seluruh BIPRA + Kolom)
 *   youth.gehc.page  -> portal 'youth'   (lingkup BIPRA PEMUDA)
 *   men/women/...    -> portal kategorial (lingkup BIPRA-nya)
 *   districts        -> portal 'kolom'
 *   localhost/preview (host tak dikenal) -> 'youth' (perilaku lama dipertahankan)
 *
 * Scope disimpan di konteks klien agar panel bisa memfilter data per portal
 * (lihat F4). Di F1 hanya dipakai untuk nav, label, dan badge "Lingkup".
 */

import { resolveHostUnit, type HostUnit } from './host-context';

export type PortalId =
  | 'jemaat'
  | 'youth'
  | 'teen'
  | 'kids'
  | 'men'
  | 'women'
  | 'kolom'
  | 'community';

export type PortalScope =
  | { kind: 'JEMAAT' }
  | { kind: 'BIPRA'; bipra: string }
  | { kind: 'KOLOM' };

export type PortalProfile = {
  id: PortalId;
  /** Label panjang, mis. "GEHC Jemaat". */
  label: string;
  /** Label pendek untuk badge, mis. "Jemaat" / "Pemuda". */
  shortLabel: string;
  /** Host kanonik portal ini. */
  host: string;
  /** BIPRA default (null bila bukan portal kategorial). */
  bipra: string | null;
  /** Tenant unit (null untuk jemaat / kolom). */
  tenantId: string | null;
};

/** Semua id portal (untuk tag nav "tampil di semua portal"). */
export const ALL_PORTAL_IDS: PortalId[] = [
  'jemaat',
  'youth',
  'men',
  'women',
  'teen',
  'kids',
  'kolom',
  'community',
];

/** Portal yang hanya menampilkan modul khusus Pemuda/Beyonders. */
export const YOUTH_ONLY_PORTALS: PortalId[] = ['youth'];

/** Portal yang hanya menampilkan modul admin jemaat. */
export const JEMAAT_ONLY_PORTALS: PortalId[] = ['jemaat'];

export const PORTAL_PROFILES: Record<PortalId, PortalProfile> = {
  jemaat: {
    id: 'jemaat',
    label: 'GEHC Jemaat',
    shortLabel: 'Jemaat',
    host: 'gehc.page',
    bipra: null,
    tenantId: null,
  },
  youth: {
    id: 'youth',
    label: 'GEHC Youth (Beyonders)',
    shortLabel: 'Pemuda',
    host: 'youth.gehc.page',
    bipra: 'PEMUDA',
    tenantId: 'tenant-youth',
  },
  men: {
    id: 'men',
    label: 'GEHC Kaum Bapa',
    shortLabel: 'Kaum Bapa',
    host: 'men.gehc.page',
    bipra: 'BAPAK',
    tenantId: 'tenant-men',
  },
  women: {
    id: 'women',
    label: 'GEHC Kaum Ibu',
    shortLabel: 'Kaum Ibu',
    host: 'women.gehc.page',
    bipra: 'IBU',
    tenantId: 'tenant-women',
  },
  teen: {
    id: 'teen',
    label: 'GEHC Remaja',
    shortLabel: 'Remaja',
    host: 'teen.gehc.page',
    bipra: 'REMAJA',
    tenantId: 'tenant-teen',
  },
  kids: {
    id: 'kids',
    label: 'GEHC Anak',
    shortLabel: 'Anak',
    host: 'kids.gehc.page',
    bipra: 'ANAK',
    tenantId: 'tenant-kids',
  },
  kolom: {
    id: 'kolom',
    label: 'GEHC Kolom',
    shortLabel: 'Kolom',
    host: 'districts.gehc.page',
    bipra: null,
    tenantId: 'tenant-districts',
  },
  community: {
    id: 'community',
    label: 'GEHC Komunitas',
    shortLabel: 'Komunitas',
    host: 'community.gehc.page',
    bipra: null,
    tenantId: 'tenant-community',
  },
};

const PORTAL_BY_HOST: Record<HostUnit, PortalId> = {
  hub: 'jemaat',
  youth: 'youth',
  men: 'men',
  women: 'women',
  teen: 'teen',
  kids: 'kids',
  districts: 'kolom',
  community: 'community',
  // Host tak dikenal (*.vercel.app, localhost, preview) => Pemuda (perilaku lama).
  default: 'youth',
};

/** Host -> PortalId. Hub (gehc.page) = portal Jemaat. */
export function portalIdForHost(host: string): PortalId {
  return PORTAL_BY_HOST[resolveHostUnit(host)] || 'youth';
}

export function isPortalId(value: unknown): value is PortalId {
  return typeof value === 'string' && value in PORTAL_PROFILES;
}

export function portalProfile(id: PortalId): PortalProfile {
  return PORTAL_PROFILES[id] || PORTAL_PROFILES.youth;
}

/** True bila host produksi (gehc.page atau subdomainnya). */
export function isProductionHost(host: string): boolean {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '').trim();
  return h === 'gehc.page' || h.endsWith('.gehc.page');
}

/**
 * Override portal via query `?portal=<id>` — HANYA di non-produksi (localhost,
 * preview, staging) agar portal Jemaat bisa diuji tanpa menyetel hosts.
 */
export function portalOverrideFromSearch(search: string, host: string): PortalId | null {
  if (!search || isProductionHost(host)) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get('portal');
  return isPortalId(value) ? value : null;
}

/** Portal efektif untuk host + query (memperhitungkan override non-produksi). */
export function resolvePortalId(host: string, search = ''): PortalId {
  return portalOverrideFromSearch(search, host) || portalIdForHost(host);
}

export function isJemaatPortal(id: PortalId): boolean {
  return id === 'jemaat';
}

/** Lingkup data default portal. */
export function portalScopeOf(id: PortalId): PortalScope {
  const p = portalProfile(id);
  if (!p.bipra) {
    if (p.id === 'kolom') return { kind: 'KOLOM' };
    return { kind: 'JEMAAT' };
  }
  return { kind: 'BIPRA', bipra: p.bipra };
}

/** Label badge "Lingkup" untuk header. */
export function portalScopeLabel(id: PortalId): string {
  const scope = portalScopeOf(id);
  if (scope.kind === 'JEMAAT') return 'Lingkup: Jemaat';
  if (scope.kind === 'KOLOM') return 'Lingkup: Kolom';
  return `Lingkup: ${portalProfile(id).shortLabel}`;
}
