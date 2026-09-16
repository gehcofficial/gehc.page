import type { Dict } from '../i18n';
import type { UserRole } from '../types';
import {
  buildPortalNavItems,
  getAllPortalNavDefs,
  type NavBuildContext,
} from './portal-nav-config';
import { portalNavLabel } from './portal-i18n';
import { PORTAL_ACTIONS } from './portal-actions';

export type PortalSearchKind = 'page' | 'action';

export type PortalSearchEntry = {
  id: string;
  kind: PortalSearchKind;
  title: string;
  group: string;
  subtitle?: string;
  /** Peran yang dibutuhkan; undefined = semua peran. */
  requiredRoles?: UserRole[];
  /** Apakah peran aktif boleh membuka (dihitung saat build). */
  allowed: boolean;
  /** Halaman tujuan (id tab) — lihat `PortalPage`. */
  page: string;
  accountSection?: 'profile' | 'security' | 'notifications' | 'roles';
  guideId?: string;
  actionId?: string;
  purpose?: string;
  steps?: string[];
  when?: string;
  notFor?: string;
  /** Internal: normalisasi untuk pencarian. */
  hay: string;
  titleNorm: string;
  subtitleNorm: string;
  keywordsNorm: string[];
};

export type PortalSearchIndexOptions = {
  t: Dict;
  role: UserRole;
  ctx: NavBuildContext;
  isOnboarding: boolean;
  isGroupMentor?: boolean;
  isMentee?: boolean;
};

const KEYWORDS: Record<string, string[]> = {
  'event-info': ['qr', 'whatsapp', 'wa', 'pendaftaran', 'daftar', 'register', 'check-in', 'kehadiran', 'lokasi'],
  kegiatan: ['kalender', 'agenda', 'ibadah', 'jadwal', 'kegiatan'],
  events: ['event', 'program', 'agenda', 'penatalayan', 'divisi', 'rundown', 'akun'],
  divisions: ['divisi', 'liturgia', 'didaskalia', 'koinonia', 'diakonia', 'marturia', 'rhb', 'drive', 'material'],
  'wa-channels': ['whatsapp', 'wa', 'grup', 'link'],
  people: ['akun', 'undangan', 'invite', 'provision', 'reset', 'password', 'akses'],
  onboarding: ['newcomer', 'pipeline', 'waiting', 'pending', 'role'],
  monitoring: ['mentee', 'kelompok', 'monitoring', 'absensi'],
  'groups-monitoring': ['mentee', 'kelompok', 'monitoring', 'absensi', 'binaan'],
  kesaksian: ['testimoni', 'kesaksian', 'tulis'],
  'pastoral-care': ['doa', 'prayer', 'pastoral', 'curhat'],
  'content-weekly': ['warta', 'bulletin', 'cms', 'publikasi'],
  'content-activities': ['agenda', 'publik', 'cms'],
  dashboard: ['ringkasan', 'summary', 'statistik'],
  jethro: ['regenerasi', 'mitosis', 'merge', 'kelompok'],
  'jethro-placement': ['penempatan', 'placement', 'newcomer', 'approve'],
  'youth-gehc': ['jemaat', 'direktori', 'bipra', 'hut', 'ultah'],
  'beyonders-leaders': ['pemimpin', 'rumah', 'leader', 'retreat'],
  struktur: ['org', 'struktur', 'chart', 'kepengurusan'],
  catalog: ['kampus', 'gelar', 'minat', 'katalog'],
  'church-info': ['gereja', 'profil', 'kontak', 'sosial', 'galeri'],
  integrations: ['drive', 'google', 'integrasi'],
  'org-hierarchy': ['hirarki', 'hierarchy', 'organisasi'],
  'media-guide': ['drive', 'media', 'panduan'],
  account: ['akun', 'profil', 'password', 'keamanan', 'peran', 'notifikasi'],
};

export function guideIdToPage(guideId: string): { page: string; accountSection?: PortalSearchEntry['accountSection'] } | null {
  if (!guideId) return null;
  if (guideId.startsWith('account.')) {
    const section = guideId.slice('account.'.length);
    if (section === 'profile' || section === 'security' || section === 'notifications' || section === 'roles') {
      return { page: 'account', accountSection: section };
    }
    return { page: 'account' };
  }
  const base = guideId.split('.')[0];
  if (base === 'ibadah-mingguan') return { page: 'kegiatan' };
  return { page: base };
}

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildHay(parts: Array<string | undefined>): string {
  return normalize(parts.filter(Boolean).join(' · '));
}

type SearchI18n = {
  actions?: Record<string, { title?: string; purpose?: string; steps?: string[] }>;
};

function actionText(t: Dict, id: string): { title: string; purpose?: string; steps?: string[] } {
  const search = (t.portal as unknown as { search?: SearchI18n }).search;
  const item = search?.actions?.[id];
  return { title: item?.title || id, purpose: item?.purpose, steps: item?.steps };
}

/**
 * Bangun indeks pencarian portal: semua menu (termasuk yang terkunci untuk
 * transparansi), seluruh panduan i18n, dan aksi lintas-panel.
 */
export function buildPortalSearchIndex(opts: PortalSearchIndexOptions): PortalSearchEntry[] {
  const { t, role, ctx, isOnboarding, isGroupMentor, isMentee } = opts;
  const allowedIds = new Set(buildPortalNavItems(role, ctx, isOnboarding).map((d) => d.id));
  const allDefs = getAllPortalNavDefs();
  const defById = new Map(allDefs.map((d) => [d.id, d]));
  const entries: PortalSearchEntry[] = [];

  for (const def of allDefs) {
    const title = portalNavLabel(t, def.id, { isGroupMentor, isMentee });
    const guide = (t.portal.guides as Record<string, { purpose?: string; steps?: string[]; when?: string; notFor?: string } | undefined>)[def.id];
    const keywords = KEYWORDS[def.id] || [];
    entries.push({
      id: `page:${def.id}`,
      kind: 'page',
      title,
      group: def.group,
      subtitle: def.subtitle,
      requiredRoles: def.roles,
      allowed: allowedIds.has(def.id),
      page: def.id,
      guideId: def.id,
      purpose: guide?.purpose,
      steps: guide?.steps,
      when: guide?.when,
      notFor: guide?.notFor,
      hay: buildHay([title, def.subtitle, def.group, keywords.join(' '), guide?.purpose, guide?.steps?.join(' ')]),
      titleNorm: normalize(title),
      subtitleNorm: normalize(def.subtitle || ''),
      keywordsNorm: keywords.map(normalize),
    });
  }

  const guides = t.portal.guides as Record<string, { title: string; purpose: string; steps: string[]; when: string; notFor: string }>;
  for (const [guideId, guide] of Object.entries(guides)) {
    if (!guide || !guide.title) continue;
    const mapped = guideIdToPage(guideId);
    if (!mapped) continue;
    const baseDef = defById.get(mapped.page);
    const isAccount = mapped.page === 'account';
    entries.push({
      id: `guide:${guideId}`,
      kind: 'page',
      title: guide.title,
      group: baseDef?.group || 'Utama',
      requiredRoles: baseDef?.roles,
      allowed: isAccount || allowedIds.has(mapped.page),
      page: mapped.page,
      accountSection: mapped.accountSection,
      guideId,
      purpose: guide.purpose,
      steps: guide.steps,
      when: guide.when,
      notFor: guide.notFor,
      hay: buildHay([guide.title, guide.purpose, guide.steps?.join(' '), guide.when, guide.notFor]),
      titleNorm: normalize(guide.title),
      subtitleNorm: normalize(guide.purpose || ''),
      keywordsNorm: [],
    });
  }

  for (const action of PORTAL_ACTIONS) {
    const text = actionText(t, action.id);
    const allowed = allowedIds.has(action.page) || (action.requiredRoles || []).includes(role) || role === 'SUPERADMIN';
    const keywords = KEYWORDS[action.page] || [];
    entries.push({
      id: `action:${action.id}`,
      kind: 'action',
      title: text.title,
      group: 'Aksi',
      requiredRoles: action.requiredRoles,
      allowed,
      page: action.page,
      actionId: action.id,
      purpose: text.purpose,
      steps: text.steps,
      hay: buildHay([text.title, text.purpose, text.steps?.join(' '), keywords.join(' ')]),
      titleNorm: normalize(text.title),
      subtitleNorm: normalize(text.purpose || ''),
      keywordsNorm: keywords.map(normalize),
    });
  }

  return entries;
}

export type PortalSearchResult = PortalSearchEntry & { score: number };

/** Pencarian deterministik (tanpa dependency): semua token wajib cocok, bobot per posisi. */
export function searchPortal(entries: PortalSearchEntry[], query: string, limit = 40): PortalSearchResult[] {
  const q = normalize(query).trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return entries.slice(0, limit).map((e) => ({ ...e, score: 0 }));
  }
  const out: PortalSearchResult[] = [];
  for (const e of entries) {
    if (!tokens.every((tk) => e.hay.includes(tk))) continue;
    let score = 0;
    for (const tk of tokens) {
      if (e.titleNorm === tk) score += 100;
      else if (e.titleNorm.startsWith(tk)) score += 80;
      else if (e.titleNorm.includes(tk)) score += 60;
      else if (e.keywordsNorm.some((k) => k.includes(tk))) score += 40;
      else if (e.subtitleNorm.includes(tk)) score += 25;
      else score += 10;
    }
    if (e.kind === 'action') score += 5;
    out.push({ ...e, score });
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
