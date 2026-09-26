import { UserRole } from '../types';
import {
  ALL_PORTAL_IDS,
  JEMAAT_ONLY_PORTALS,
  YOUTH_ONLY_PORTALS,
  type PortalId,
} from './portal-profiles';

export type PortalNavItemDef = {
  id: string;
  label: string;
  roles: UserRole[];
  group: string;
  subtitle?: string;
  accountOnly?: boolean;
  onboardingOnly?: boolean;
  /**
   * Portal tempat item ini tampil. `undefined` = legacy (tanpa filter portal).
   * Lihat src/lib/portal-profiles.ts.
   */
  portals?: PortalId[];
};

export type NavBuildContext = {
  isGroupMentor: boolean;
  isMentee: boolean;
  isBodTimkerja?: boolean;
};

const CHURCH_ROLES = {
  all: ['BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI', 'MEMBER'] as UserRole[],
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

/** Panel unit jemaat (BPMJ + 4 unit). Gating per-unit via useMyChurchUnits. */
export const CHURCH_TABS: { id: string; unit: string; label: string }[] = [
  { id: 'church-org', unit: '*', label: 'Unit & Struktur Jemaat' },
];

export const CHURCH_TAB_IDS = CHURCH_TABS.map((c) => c.id);

export function churchTabById(tabId: string): { id: string; unit: string; label: string } | null {
  return CHURCH_TABS.find((c) => c.id === tabId) || null;
}

export function churchNavDefs(): PortalNavItemDef[] {
  return CHURCH_TABS.map((c) => ({ id: c.id, label: c.label, roles: CHURCH_ROLES.all, group: 'Jemaat', portals: ALL_PORTAL_IDS }));
}

/** Boleh membuka tab jemaat? BPMJ/SUPERADMIN, atau anggota unit jemaat. */
export function canSeeChurchTab(
  me: { isSuperadmin: boolean; isBpmj: boolean; units: string[] },
  tabId: string,
): boolean {
  const t = churchTabById(tabId);
  if (!t) return false;
  if (me.isSuperadmin || me.isBpmj) return true;
  const set = new Set((me.units || []).map((x) => String(x).toUpperCase()));
  if (t.unit === '*') return set.size > 0;
  return set.has(t.unit);
}

const BASE_NAV: PortalNavItemDef[] = [
  { id: 'account', label: 'Akun Saya', roles: CHURCH_ROLES.all, group: 'Utama', accountOnly: true, portals: ALL_PORTAL_IDS },
  { id: 'event-info', label: 'Info Event', roles: CHURCH_ROLES.all, group: 'Utama', subtitle: 'Pendaftaran, QR & grup WA per event', portals: ALL_PORTAL_IDS },
  { id: 'kegiatan', label: 'Kegiatan', roles: CHURCH_ROLES.all, group: 'Utama', subtitle: 'Umum/Khusus/Internal/Rekreasional — by event', portals: ALL_PORTAL_IDS },
  { id: 'internal-warta', label: 'Info & Peluang', roles: CHURCH_ROLES.all, group: 'Utama', subtitle: 'Beasiswa, lowongan & kabar komunitas', portals: ALL_PORTAL_IDS },
  { id: 'dashboard', label: 'Dashboard & Ringkasan', roles: ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI', 'MEMBER'], group: 'Utama', portals: ALL_PORTAL_IDS },
  { id: 'people', label: 'Orang & Undangan', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Akun & link undangan', portals: ALL_PORTAL_IDS },
  { id: 'onboarding', label: 'Onboarding Pipeline', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Newcomer → role assignment', portals: ALL_PORTAL_IDS },
  { id: 'jethro-placement', label: 'Review Penempatan', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Komunitas', subtitle: 'Approve batch newcomer', portals: YOUTH_ONLY_PORTALS },
  { id: 'youth-gehc', label: 'Jemaat', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Direktori BIPRA & HUT', portals: ALL_PORTAL_IDS },
  { id: 'catalog', label: 'Katalog Minat, Kampus & Gelar', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Minat, kampus, gelar pelayanan/akademis', portals: ALL_PORTAL_IDS },
  { id: 'org-hierarchy', label: 'Kelola Hirarki', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Pohon organisasi multi-domain', portals: JEMAAT_ONLY_PORTALS },
  { id: 'groups-monitoring', label: 'Monitoring 10 Kelompok', roles: ['KOMISI', 'BPMJ', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], group: 'Komunitas', portals: YOUTH_ONLY_PORTALS },
  { id: 'beyonders-leaders', label: 'Pemimpin 10 Rumah', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Komunitas', subtitle: 'Nama landing & generasi Retreat', portals: YOUTH_ONLY_PORTALS },
  { id: 'pastoral-care', label: 'Portal Doa', roles: ['KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], group: 'Komunitas', subtitle: 'Kabar penggembalaan (privat)', portals: ALL_PORTAL_IDS },
  { id: 'jethro', label: 'Regenerasi Kelompok', roles: ['KOMISI', 'BPMJ'], group: 'Komunitas', subtitle: 'Mitosis & merger kelompok', portals: YOUTH_ONLY_PORTALS },
  { id: 'content-weekly', label: 'Warta', roles: ['KOMISI', 'COMMITTEE'] as UserRole[], group: 'Konten', subtitle: 'Publikasi & arsip warta', portals: ALL_PORTAL_IDS },
  { id: 'content-activities', label: 'Kelola Agenda Kegiatan', roles: CHURCH_ROLES.committee, group: 'Konten', subtitle: 'CMS agenda publik', portals: ALL_PORTAL_IDS },
  { id: 'content-testimonials', label: 'Kelola Testimoni', roles: CHURCH_ROLES.komisi, group: 'Konten', subtitle: 'Collage landing', portals: ALL_PORTAL_IDS },
  { id: 'announcements', label: 'Pengumuman', roles: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ', 'MENTOR', 'CO_MENTOR'] as UserRole[], group: 'Konten', subtitle: 'Notifikasi push ke peran/divisi/kelompok', portals: ALL_PORTAL_IDS },
  { id: 'kesaksian', label: 'Kesaksian', roles: ['MENTEE'] as UserRole[], group: 'Komunitas', subtitle: 'Tulis kesaksian sendiri', portals: YOUTH_ONLY_PORTALS },
  { id: 'media-guide', label: 'Panduan Media (Drive)', roles: CHURCH_ROLES.komisiCommittee, group: 'Konten', portals: ALL_PORTAL_IDS },
  { id: 'struktur', label: 'Struktur Organisasi', roles: CHURCH_ROLES.committee, group: 'Struktur', portals: ALL_PORTAL_IDS },
  { id: 'unit-pengurus', label: 'Pengurus Unit', roles: CHURCH_ROLES.all, group: 'Struktur', subtitle: 'Susunan pengurus unit ini', portals: ALL_PORTAL_IDS },
  { id: 'kolom', label: 'Kolom & Wilayah', roles: CHURCH_ROLES.all, group: 'Struktur', subtitle: 'Kolom teritorial & anggotanya', portals: ['jemaat', 'kolom'] },
  { id: 'unit-members', label: 'Anggota Unit', roles: CHURCH_ROLES.all, group: 'Komunitas', subtitle: 'Daftar anggota unit ini', portals: ALL_PORTAL_IDS },
  { id: 'events', label: 'Program & Event', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Kerja', subtitle: 'Workspace per event', portals: ALL_PORTAL_IDS },
  { id: 'div-liturgia', label: 'Liturgia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Ibadah, penatalayan & liturgi', portals: YOUTH_ONLY_PORTALS },
  { id: 'div-didaskalia', label: 'Didaskalia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Studio, RHB & warta', portals: YOUTH_ONLY_PORTALS },
  { id: 'div-koinonia', label: 'Koinonia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Hubungan, komunikasi & check-in', portals: YOUTH_ONLY_PORTALS },
  { id: 'div-diakonia', label: 'Diakonia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Kasih peduli & benevolence', portals: YOUTH_ONLY_PORTALS },
  { id: 'div-marturia', label: 'Marturia', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Dokumentasi, galeri & kesaksian', portals: YOUTH_ONLY_PORTALS },
  { id: 'div-benzarpr', label: 'Benzarpreneurship', roles: CHURCH_ROLES.komisiCommittee, group: 'Divisi', subtitle: 'Usaha & fundraising', portals: ALL_PORTAL_IDS },
  { id: 'wa-channels', label: 'Kanal WhatsApp', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Kerja', subtitle: 'Link grup permanen & event', portals: ALL_PORTAL_IDS },
  { id: 'integrations', label: 'Integrasi Google Drive', roles: CHURCH_ROLES.komisi, group: 'Sistem', portals: JEMAAT_ONLY_PORTALS },
  { id: 'church-info', label: 'Info Gereja', roles: ['SUPERADMIN', 'BPMJ', 'KOMISI'], group: 'Sistem', subtitle: 'Profil, kontak & sosial gereja/unit', portals: ALL_PORTAL_IDS },
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
    'internal-warta',
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
  KOMISI: ['event-info', 'kegiatan', 'internal-warta', 'dashboard', 'people', 'onboarding', 'jethro-placement', 'youth-gehc', 'catalog', 'org-hierarchy', 'groups-monitoring', 'beyonders-leaders', 'pastoral-care', 'jethro', 'events', 'wa-channels', 'integrations', 'church-info', 'media-guide', 'content-testimonials', 'account'],
  COMMITTEE: ['event-info', 'kegiatan', 'internal-warta', 'dashboard', 'groups-monitoring', 'beyonders-leaders', 'pastoral-care', 'jethro-placement', 'content-weekly', 'content-activities', 'struktur', 'events', 'wa-channels', 'media-guide', 'account'],
  MENTOR: ['event-info', 'kegiatan', 'internal-warta', 'dashboard', 'groups-monitoring', 'pastoral-care', 'account'],
  CO_MENTOR: ['event-info', 'kegiatan', 'internal-warta', 'dashboard', 'groups-monitoring', 'pastoral-care', 'account'],
  MENTEE: ['event-info', 'kegiatan', 'internal-warta', 'dashboard', 'groups-monitoring', 'kesaksian', 'pastoral-care', 'account'],
  BPMJ: ['event-info', 'kegiatan', 'internal-warta', 'dashboard', 'jethro-placement', 'beyonders-leaders', 'jethro', 'groups-monitoring', 'events', 'wa-channels', 'church-info', 'account'],
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
  portalId?: PortalId,
): PortalNavItemDef[] {
  const withLabels = BASE_NAV.map((item) => {
    if (item.id === 'groups-monitoring') {
      return { ...item, label: monitoringLabel(ctx) };
    }
    return item;
  });

  const filtered = withLabels.filter((item) => {
    if (currentRole !== 'SUPERADMIN' && !item.roles.includes(currentRole)) return false;
    if (portalId && item.portals && !item.portals.includes(portalId)) return false;
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
  portalId?: PortalId,
): PortalSidebarItem[] {
  const items = buildPortalNavItems(currentRole, ctx, isOnboarding, portalId);
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
