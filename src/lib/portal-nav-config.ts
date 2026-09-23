import { UserRole } from '../types';

export type PortalNavItemDef = {
  id: string;
  label: string;
  roles: UserRole[];
  group: string;
  subtitle?: string;
  accountOnly?: boolean;
  onboardingOnly?: boolean;
};

export type NavBuildContext = {
  isGroupMentor: boolean;
  isMentee: boolean;
  isBodTimkerja?: boolean;
};

const CHURCH_ROLES = {
  all: ['BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'] as UserRole[],
  komisi: ['KOMISI'] as UserRole[],
  committee: ['COMMITTEE'] as UserRole[],
  komisiCommittee: ['KOMISI', 'COMMITTEE'] as UserRole[],
};

/** Panel per-divisi (Fase 1 IA): tiap divisi = destinasi sendiri di sidebar. */
export const DIVISION_TABS: { id: string; division: string; label: string }[] = [
  { id: 'div-liturgia', division: 'LITURGIA', label: 'Liturgia' },
  { id: 'div-didaskalia', division: 'DIDASKALIA', label: 'Didaskalia' },
  { id: 'div-koinonia', division: 'KOINONIA', label: 'Koinonia' },
  { id: 'div-diakonia', division: 'DIAKONIA', label: 'Diakonia' },
  { id: 'div-marturia', division: 'MARTURIA', label: 'Marturia' },
  { id: 'div-benzarpr', division: 'BENZARPR', label: 'Benzarpreneurship' },
];

export const DIVISION_TAB_IDS = DIVISION_TABS.map((d) => d.id);

export function divisionForTab(tabId: string): string | null {
  return DIVISION_TABS.find((d) => d.id === tabId)?.division || null;
}

export function isDivisionTab(tabId: string): boolean {
  return DIVISION_TAB_IDS.includes(tabId);
}

/** Definisi nav untuk 6 panel divisi (untuk gating anggota divisi). */
export function divisionNavDefs(): PortalNavItemDef[] {
  return BASE_NAV.filter((i) => i.group === 'Divisi');
}

/**
 * Boleh membuka panel divisi? Aturan (sama dengan server/lib/division-access.mjs):
 * SUPERADMIN, anggota divisi itu, atau kepala divisi itu (LEAD/CO_LEAD per-divisi).
 */
export function canSeeDivisionTab(
  me: { isSuperadmin: boolean; divisions: string[]; headDivisions: string[] },
  tabId: string,
): boolean {
  const div = divisionForTab(tabId);
  if (!div) return false;
  if (me.isSuperadmin) return true;
  const set = new Set([...(me.divisions || []), ...(me.headDivisions || [])].map((x) => String(x).toUpperCase()));
  return set.has(div);
}

const BASE_NAV: PortalNavItemDef[] = [
  { id: 'account', label: 'Akun Saya', roles: CHURCH_ROLES.all, group: 'Utama', accountOnly: true },
  { id: 'event-info', label: 'Info Event', roles: CHURCH_ROLES.all, group: 'Utama', subtitle: 'Pendaftaran, QR & grup WA per event' },
  { id: 'kegiatan', label: 'Kegiatan', roles: CHURCH_ROLES.all, group: 'Utama', subtitle: 'Umum/Khusus/Internal/Rekreasional — by event' },
  { id: 'dashboard', label: 'Dashboard & Ringkasan', roles: ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'], group: 'Utama' },
  { id: 'people', label: 'Orang & Undangan', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Akun & link undangan' },
  { id: 'onboarding', label: 'Onboarding Pipeline', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Newcomer → role assignment' },
  { id: 'jethro-placement', label: 'Review Penempatan', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Komunitas', subtitle: 'Approve batch newcomer' },
  { id: 'youth-gehc', label: 'Jemaat', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Direktori BIPRA & HUT' },
  { id: 'catalog', label: 'Katalog Minat, Kampus & Gelar', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Minat, kampus, gelar pelayanan/akademis' },
  { id: 'org-hierarchy', label: 'Kelola Hirarki', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Pohon organisasi multi-domain' },
  { id: 'groups-monitoring', label: 'Monitoring 10 Kelompok', roles: ['KOMISI', 'BPMJ', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], group: 'Komunitas' },
  { id: 'beyonders-leaders', label: 'Pemimpin 10 Rumah', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Komunitas', subtitle: 'Nama landing & generasi Retreat' },
  { id: 'pastoral-care', label: 'Portal Doa', roles: ['KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], group: 'Komunitas', subtitle: 'Kabar penggembalaan (privat)' },
  { id: 'jethro', label: 'Regenerasi Kelompok', roles: ['KOMISI', 'BPMJ'], group: 'Komunitas', subtitle: 'Mitosis & merger kelompok' },
  { id: 'content-weekly', label: 'Warta', roles: ['KOMISI', 'COMMITTEE'] as UserRole[], group: 'Konten', subtitle: 'Publikasi & arsip warta' },
  { id: 'content-activities', label: 'Kelola Agenda Kegiatan', roles: CHURCH_ROLES.committee, group: 'Konten', subtitle: 'CMS agenda publik' },
  { id: 'content-testimonials', label: 'Kelola Testimoni', roles: CHURCH_ROLES.komisi, group: 'Konten', subtitle: 'Collage landing' },
  { id: 'announcements', label: 'Pengumuman', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ', 'MENTOR', 'CO_MENTOR'] as UserRole[], group: 'Konten', subtitle: 'Notifikasi push ke peran/divisi/kelompok' },
  { id: 'kesaksian', label: 'Kesaksian', roles: ['MENTEE'] as UserRole[], group: 'Komunitas', subtitle: 'Tulis kesaksian sendiri' },
  { id: 'media-guide', label: 'Panduan Media (Drive)', roles: CHURCH_ROLES.komisiCommittee, group: 'Konten' },
  { id: 'struktur', label: 'Struktur Organisasi', roles: CHURCH_ROLES.committee, group: 'Struktur' },
  { id: 'events', label: 'Program & Event', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Kerja', subtitle: 'Workspace per event' },
  { id: 'div-liturgia', label: 'Liturgia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Ibadah, penatalayan & liturgi' },
  { id: 'div-didaskalia', label: 'Didaskalia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Studio, RHB & warta' },
  { id: 'div-koinonia', label: 'Koinonia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Hubungan, komunikasi & check-in' },
  { id: 'div-diakonia', label: 'Diakonia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Kasih peduli & benevolence' },
  { id: 'div-marturia', label: 'Marturia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Dokumentasi, galeri & kesaksian' },
  { id: 'div-benzarpr', label: 'Benzarpreneurship', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Usaha & fundraising' },
  { id: 'wa-channels', label: 'Kanal WhatsApp', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Kerja', subtitle: 'Link grup permanen & event' },
  { id: 'integrations', label: 'Integrasi Google Drive', roles: CHURCH_ROLES.komisi, group: 'Sistem' },
  { id: 'church-info', label: 'Info Gereja', roles: ['SUPERADMIN', 'BPMJ', 'KOMISI'], group: 'Sistem', subtitle: 'Profil, kontak & sosial gereja/unit' },
  // 'pwa-settings' sengaja tidak ada di sidebar — pengaturan pribadi tinggal di
  // Akun Saya → Notifikasi. Rutenya tetap hidup untuk tautan langsung.
];

/**
 * Urutan tampil per peran. Item yang lolos filter tapi tidak terdaftar di sini
 * tetap ikut di belakang (lihat buildPortalNavItems), jadi daftar ini mengatur
 * urutan — bukan hak akses.
 *
 * SUPERADMIN melihat seluruh panel gereja (inspector). Tugas platform (passkey,
 * grant, audit) tetap di shell terpisah `#/admin`.
 */
export const NAMESPACE_NAV_OVERRIDES: Partial<Record<UserRole, string[]>> = {
  SUPERADMIN: [
    'event-info',
    'kegiatan',
    'dashboard',
    'people',
    'onboarding',
    'jethro-placement',
    'youth-gehc',
    'catalog',
    'org-hierarchy',
    'groups-monitoring',
    'beyonders-leaders',
    'pastoral-care',
    'jethro',
    'content-weekly',
    'content-activities',
    'kesaksian',
    'content-testimonials',
    'media-guide',
    'struktur',
    'events',
    'div-liturgia', 'div-didaskalia', 'div-koinonia', 'div-diakonia', 'div-marturia', 'div-benzarpr',
    'wa-channels',
    'integrations',
    'church-info',
    'account',
  ],
  KOMISI: ['event-info', 'kegiatan', 'dashboard', 'people', 'onboarding', 'jethro-placement', 'youth-gehc', 'catalog', 'org-hierarchy', 'groups-monitoring', 'beyonders-leaders', 'pastoral-care', 'jethro', 'events', 'wa-channels', 'integrations', 'church-info', 'media-guide', 'content-testimonials', 'account'],
  COMMITTEE: ['event-info', 'kegiatan', 'dashboard', 'groups-monitoring', 'beyonders-leaders', 'pastoral-care', 'jethro-placement', 'content-weekly', 'content-activities', 'struktur', 'events', 'wa-channels', 'media-guide', 'account'],
  MENTOR: ['event-info', 'kegiatan', 'dashboard', 'groups-monitoring', 'pastoral-care', 'account'],
  CO_MENTOR: ['event-info', 'kegiatan', 'dashboard', 'groups-monitoring', 'pastoral-care', 'account'],
  MENTEE: ['event-info', 'kegiatan', 'dashboard', 'groups-monitoring', 'kesaksian', 'pastoral-care', 'account'],
  BPMJ: ['event-info', 'kegiatan', 'dashboard', 'jethro-placement', 'beyonders-leaders', 'jethro', 'groups-monitoring', 'events', 'wa-channels', 'church-info', 'account'],
};

function monitoringLabel(ctx: NavBuildContext): string {
  if (ctx.isGroupMentor) return 'Monitoring Kelompok Binaan';
  if (ctx.isMentee) return 'Monitoring Kelompok Saya';
  return 'Monitoring 10 Kelompok';
}

export function buildPortalNavItems(
  currentRole: UserRole,
  ctx: NavBuildContext,
  isOnboarding: boolean,
): PortalNavItemDef[] {
  const withLabels = BASE_NAV.map((item) => {
    if (item.id === 'groups-monitoring') {
      return { ...item, label: monitoringLabel(ctx) };
    }
    return item;
  });

  const filtered = withLabels.filter((item) => {
    if (currentRole !== 'SUPERADMIN' && !item.roles.includes(currentRole)) return false;
    // Onboarding: hanya Info Event + Akun (akses penuh belum dibuka).
    if (isOnboarding) return item.id === 'event-info' || item.id === 'account';
    if (item.onboardingOnly) return false;
    if (item.id === 'wa-channels' && currentRole === 'COMMITTEE' && !ctx.isBodTimkerja) return false;
    return true;
  });

  const order = NAMESPACE_NAV_OVERRIDES[currentRole];
  if (!order) return filtered;

  const byId = new Map(filtered.map((i) => [i.id, i]));
  const ordered: PortalNavItemDef[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) ordered.push(item);
  }
  for (const item of filtered) {
    if (!ordered.some((o) => o.id === item.id)) ordered.push(item);
  }
  return ordered;
}

export function getAllPortalNavDefs(): PortalNavItemDef[] {
  return BASE_NAV;
}

/** Destinasi gabungan (parent) dengan sub-tab anak. */
export type PortalNavParentDef = {
  id: string;
  label: string;
  group: string;
  roles: UserRole[];
  children: string[];
};

export type PortalSidebarItem =
  | { type: 'item'; item: PortalNavItemDef }
  | { type: 'parent'; parent: PortalNavParentDef; children: PortalNavItemDef[] };

/**
 * Peta penggabungan destinasi (audit bagian 5). ID anak tetap routable —
 * ini hanya mengubah cara akses di sidebar, bukan rute/komponen.
 */
export const PORTAL_NAV_PARENTS: PortalNavParentDef[] = [
  { id: 'orang', label: 'Orang', group: 'Komunitas', roles: ['KOMISI'], children: ['people', 'youth-gehc', 'onboarding', 'catalog'] },
  { id: 'regenerasi', label: 'Regenerasi', group: 'Komunitas', roles: ['KOMISI', 'BPMJ', 'COMMITTEE'], children: ['jethro', 'jethro-placement', 'beyonders-leaders'] },
  { id: 'konten', label: 'Konten', group: 'Konten', roles: ['COMMITTEE', 'KOMISI'], children: ['content-weekly', 'content-activities', 'content-testimonials', 'media-guide', 'announcements'] },
  { id: 'struktur-hirarki', label: 'Struktur & Hirarki', group: 'Struktur', roles: ['COMMITTEE', 'KOMISI'], children: ['struktur', 'org-hierarchy'] },
  { id: 'sistem', label: 'Sistem', group: 'Sistem', roles: ['KOMISI', 'BPMJ'], children: ['integrations', 'church-info'] },
];

/** Rollout bertahap: grouping sidebar aktif untuk peran ini dulu. */
export const PORTAL_NAV_GROUPED_ROLES: UserRole[] = ['COMMITTEE', 'KOMISI', 'BPMJ', 'SUPERADMIN'];

/**
 * Baris sidebar: item tunggal, atau parent yang menampung beberapa anak.
 * Peran di luar PORTAL_NAV_GROUPED_ROLES tetap datar (belum berubah).
 */
export function buildPortalSidebarItems(
  currentRole: UserRole,
  ctx: NavBuildContext,
  isOnboarding: boolean,
): PortalSidebarItem[] {
  const items = buildPortalNavItems(currentRole, ctx, isOnboarding);
  if (!PORTAL_NAV_GROUPED_ROLES.includes(currentRole)) {
    return items.map((item) => ({ type: 'item', item }));
  }

  const parents = currentRole === 'SUPERADMIN'
    ? PORTAL_NAV_PARENTS
    : PORTAL_NAV_PARENTS.filter((p) => p.roles.includes(currentRole));
  const byId = new Map(items.map((i) => [i.id, i]));
  const consumed = new Set<string>();
  const out: PortalSidebarItem[] = [];

  for (const item of items) {
    if (consumed.has(item.id)) continue;
    const parent = parents.find((p) => p.children.includes(item.id));
    if (!parent) {
      out.push({ type: 'item', item });
      continue;
    }
    const children = parent.children
      .map((id) => byId.get(id))
      .filter((c): c is PortalNavItemDef => Boolean(c));
    for (const c of children) consumed.add(c.id);
    if (children.length < 2) {
      out.push({ type: 'item', item: children[0] || item });
      continue;
    }
    out.push({ type: 'parent', parent, children });
  }
  return out;
}

export function findParentForTab(
  rows: PortalSidebarItem[],
  tabId: string,
): PortalNavParentDef | null {
  for (const row of rows) {
    if (row.type === 'parent' && row.children.some((c) => c.id === tabId)) return row.parent;
  }
  return null;
}
