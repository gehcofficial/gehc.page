import { UserRole } from '../types';

export type PortalNavItemDef = {
  id: string;
  label: string;
  roles: UserRole[];
  group: string;
  subtitle?: string;
  accountOnly?: boolean;
  onboardingOnly?: boolean;
  badge?: boolean;
};

export type NavBuildContext = {
  isGroupMentor: boolean;
  isMentee: boolean;
};

const CHURCH_ROLES = {
  all: ['BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'] as UserRole[],
  komisi: ['KOMISI'] as UserRole[],
  committee: ['COMMITTEE'] as UserRole[],
  komisiCommittee: ['KOMISI', 'COMMITTEE'] as UserRole[],
};

const BASE_NAV: PortalNavItemDef[] = [
  { id: 'account', label: 'Akun Saya', roles: CHURCH_ROLES.all, group: 'Utama', accountOnly: true },
  { id: 'event-info', label: 'Info Event', roles: CHURCH_ROLES.all, group: 'Utama', subtitle: 'BAKU TAU — QR & grup WA' },
  { id: 'dashboard', label: 'Dashboard & Ringkasan', roles: ['COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'], group: 'Utama' },
  { id: 'people', label: 'Orang & Undangan', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Akun & link undangan' },
  { id: 'onboarding', label: 'Onboarding Pipeline', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Newcomer → role assignment' },
  { id: 'jethro-placement', label: 'Review Penempatan', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Komunitas', subtitle: 'Approve batch newcomer' },
  { id: 'youth-gehc', label: 'Jemaat', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Direktori BIPRA & HUT' },
  { id: 'org-hierarchy', label: 'Kelola Hirarki', roles: CHURCH_ROLES.komisi, group: 'Komunitas', subtitle: 'Pohon organisasi multi-domain' },
  { id: 'groups-monitoring', label: 'Monitoring 10 Kelompok', roles: ['COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE'], group: 'Komunitas' },
  { id: 'jethro', label: 'Regenerasi Kelompok', roles: ['KOMISI', 'BPMJ'], group: 'Komunitas', subtitle: 'Mitosis & merger kelompok' },
  { id: 'content-weekly', label: 'Kelola Warta Pemuda', roles: CHURCH_ROLES.committee, group: 'Konten', subtitle: 'CMS publikasi warta' },
  { id: 'content-activities', label: 'Kelola Agenda Kegiatan', roles: CHURCH_ROLES.committee, group: 'Konten', subtitle: 'CMS agenda publik' },
  { id: 'content-testimonials', label: 'Kelola Testimoni', roles: CHURCH_ROLES.komisiCommittee, group: 'Konten', subtitle: 'Collage landing' },
  { id: 'media-guide', label: 'Panduan Media (Drive)', roles: CHURCH_ROLES.komisiCommittee, group: 'Konten' },
  { id: 'struktur', label: 'Struktur Organisasi', roles: CHURCH_ROLES.committee, group: 'Struktur' },
  { id: 'events', label: 'Program & Event', roles: ['KOMISI', 'COMMITTEE', 'BPMJ'], group: 'Kerja', subtitle: 'Workspace per event' },
  { id: 'divisions', label: 'Panel Divisi (6 Divisi)', roles: CHURCH_ROLES.komisiCommittee, group: 'Kerja', subtitle: 'Workspace permanen divisi' },
  { id: 'wa-channels', label: 'Kanal WhatsApp', roles: ['KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'BPMJ'], group: 'Kerja', subtitle: 'Link grup permanen & event' },
  { id: 'integrations', label: 'Integrasi Google Drive', roles: CHURCH_ROLES.komisi, group: 'Sistem' },
  // 'pwa-settings' sengaja tidak ada di sidebar — pengaturan pribadi tinggal di
  // Akun Saya → Notifikasi. Rutenya tetap hidup untuk tautan langsung.
];

/**
 * Urutan tampil per peran. Item yang lolos filter tapi tidak terdaftar di sini
 * tetap ikut di belakang (lihat buildPortalNavItems), jadi daftar ini mengatur
 * urutan — bukan hak akses.
 *
 * SUPERADMIN tidak punya entri sendiri: `roleForNav` sudah memetakannya ke
 * KOMISI, dan tugas platform ada di shell terpisah `#/admin`.
 */
export const NAMESPACE_NAV_OVERRIDES: Partial<Record<UserRole, string[]>> = {
  KOMISI: ['event-info', 'dashboard', 'people', 'onboarding', 'jethro-placement', 'youth-gehc', 'org-hierarchy', 'jethro', 'events', 'divisions', 'wa-channels', 'integrations', 'media-guide', 'content-testimonials', 'account'],
  COMMITTEE: ['event-info', 'dashboard', 'groups-monitoring', 'jethro-placement', 'content-weekly', 'content-activities', 'content-testimonials', 'struktur', 'events', 'divisions', 'wa-channels', 'media-guide', 'account'],
  MENTOR: ['event-info', 'dashboard', 'groups-monitoring', 'wa-channels', 'account'],
  MENTEE: ['event-info', 'dashboard', 'groups-monitoring', 'account'],
  BPMJ: ['event-info', 'dashboard', 'jethro-placement', 'jethro', 'groups-monitoring', 'events', 'wa-channels', 'account'],
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
  const roleForNav: UserRole = currentRole === 'SUPERADMIN' ? 'KOMISI' : currentRole;

  const withLabels = BASE_NAV.map((item) => {
    if (item.id === 'groups-monitoring') {
      return { ...item, label: monitoringLabel(ctx) };
    }
    return item;
  });

  const filtered = withLabels.filter((item) => {
    if (!item.roles.includes(roleForNav)) return false;
    // Onboarding: hanya Info Event + Akun (akses penuh belum dibuka).
    if (isOnboarding) return item.id === 'event-info' || item.id === 'account';
    if (item.onboardingOnly) return false;
    return true;
  });

  const order = NAMESPACE_NAV_OVERRIDES[currentRole] || NAMESPACE_NAV_OVERRIDES[roleForNav];
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
