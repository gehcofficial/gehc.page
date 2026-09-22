import {
  matchesMainFilter as matchesMainFilterLib,
  matchesSubFilter as matchesSubFilterLib,
  buildSubFilters as buildSubFiltersLib,
} from '../../lib/jemaat-filter';
import { countryName } from '../../lib/countries';

export interface RoleAssignment {
  id: string;
  userId: string;
  role: string;
  position: string | null;
  division: string | null;
  subdivision: string | null;
  groupId: string | null;
  familyRole: string | null;
  assignedBy: string;
  assignedAt: string;
  isActive: boolean;
  note: string | null;
  group?: { id: string; name: string } | null;
}

export interface UserRoleLegacy {
  id: number;
  userId: string;
  tenantId: string;
  role: string;
  groupId: string | null;
  assignmentId: string | null;
}

export interface YouthUser {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  addressScope?: string;
  addressCountry?: string;
  addressLine?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  addressNote?: string | null;
  provinceCode?: string | null;
  cityCode?: string | null;
  districtCode?: string | null;
  villageCode?: string | null;
  giftsTop5?: string[] | null;
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  churchTitle?: string | null;
  academicTitles?: unknown;
  isBeyonders?: boolean;
  isIndividuExplicit?: boolean;
  membershipKind?: 'JEMAAT' | 'SIMPATISAN';
  memberStatus?: 'ACTIVE' | 'ALUMNI' | 'NONAKTIF';
  bipra?: string;
  kolomId?: string | null;
  kolom?: { id: string; number: number; name: string } | null;
  linkStatus?: string;
  authProvider?: string;
  recreational?: Array<{ id: string; slug: string; name: string; kind?: string; parentId?: string | null }>;
  recreationalIds?: string[];
  birthDate?: string | null;
  demographics?: {
    age?: number | null;
    daysToBirthday?: number | null;
    bipraMismatch?: boolean;
    bipraSuggest?: { suggested?: string | null; reason?: string; needsConfirm?: boolean };
  };
  roles: UserRoleLegacy[];
  roleAssignments: RoleAssignment[];
}

export type MainFilter = 'ALL' | 'INDIVIDU' | 'BEYONDERS' | 'TIMKERJA' | 'KOMISI' | 'BPMJ' | 'ALUMNI' | 'NONAKTIF';

export const MAIN_FILTERS: { id: MainFilter; label: string; color: string }[] = [
  { id: 'ALL', label: 'All', color: 'bg-[#181818] text-white' },
  { id: 'INDIVIDU', label: 'Individu', color: 'bg-amber-100 text-amber-800' },
  { id: 'BEYONDERS', label: 'Beyonders', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'TIMKERJA', label: 'Tim Kerja', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'KOMISI', label: 'Komisi', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'BPMJ', label: 'BPMJ', color: 'bg-blue-100 text-blue-700' },
  { id: 'ALUMNI', label: 'Alumni', color: 'bg-slate-100 text-slate-600' },
  { id: 'NONAKTIF', label: 'Nonaktif', color: 'bg-gray-100 text-gray-600' },
];

export const BIPRA_TABS = [
  { id: 'PEMUDA', label: 'Pemuda' },
  { id: 'BAPAK', label: 'Bapak' },
  { id: 'IBU', label: 'Ibu' },
  { id: 'REMAJA', label: 'Remaja' },
  { id: 'ANAK', label: 'Anak' },
  { id: '', label: 'Semua' },
] as const;

export const BEYONDER_ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE'];

export const ROLE_COLORS: Record<string, string> = {
  BPMJ: 'bg-blue-100 text-blue-700',
  KOMISI: 'bg-indigo-100 text-indigo-700',
  COMMITTEE: 'bg-cyan-100 text-cyan-700',
  MENTOR: 'bg-emerald-100 text-emerald-700',
  CO_MENTOR: 'bg-emerald-100 text-emerald-700',
  MENTEE: 'bg-emerald-100 text-emerald-700',
  ALUMNI: 'bg-slate-100 text-slate-500',
  COMMUNITY: 'bg-emerald-100 text-emerald-700',
};

export const ROLE_LABELS: Record<string, string> = {
  BPMJ: 'BPMJ',
  KOMISI: 'Komisi',
  COMMITTEE: 'Tim Kerja',
  MENTOR: 'Community',
  CO_MENTOR: 'Community',
  MENTEE: 'Community',
  ALUMNI: 'Alumni',
  COMMUNITY: 'Belum ditempatkan',
};

// Tim Kerja groupings — fallback if org tree not loaded
export const TIMKERJA_GROUPS_FALLBACK = [
  { key: 'TIMKERJA_BOD', label: 'BOD', divisions: ['TIMKERJA'] },
  { key: 'PANCA_TUGAS', label: 'Panca Tugas', divisions: ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] },
  { key: 'BENZARPR', label: 'Benzarpreneurship', divisions: ['BENZARPR'] },
];

export const BEYONDER_GROUPS = [
  { id: 'grp-avodah', name: 'Avodah', color: '#FF416C' },
  { id: 'grp-agape', name: 'Agape', color: '#E94057' },
  { id: 'grp-shalom', name: 'Shalom', color: '#2A81FF' },
  { id: 'grp-hesed', name: 'Hesed', color: '#8A2387' },
  { id: 'grp-kairos', name: 'Kairos', color: '#F27121' },
  { id: 'grp-logos', name: 'Logos', color: '#00B4D8' },
  { id: 'grp-metanoia', name: 'Metanoia', color: '#059669' },
  { id: 'grp-ruach', name: 'Ruach', color: '#7C3AED' },
  { id: 'grp-dunamis', name: 'Dunamis', color: '#DC2626' },
  { id: 'grp-echad', name: 'Echad', color: '#0D9488' },
];

export function hasRoleInAssignment(y: YouthUser, role: string): boolean {
  return y.roleAssignments?.some((ra) => ra.isActive && ra.role === role) || false;
}

export function hasRoleInLegacy(y: YouthUser, role: string): boolean {
  return y.roles?.some((ur) => ur.role === role) || false;
}

export function matchesMainFilter(y: YouthUser, filter: MainFilter): boolean {
  return matchesMainFilterLib(y as unknown as Parameters<typeof matchesMainFilterLib>[0], filter);
}

export function buildSubFilters(y: YouthUser[], filter: MainFilter, timKerjaGroups: Array<{ key: string; label: string; divisions: string[] }>): Array<{ key: string; label: string; count: number }> {
  return buildSubFiltersLib(y as unknown as Parameters<typeof buildSubFiltersLib>[0], filter, timKerjaGroups);
}

export function matchesSubFilter(y: YouthUser, filter: MainFilter, subKey: string | null, timKerjaGroups: Array<{ key: string; label: string; divisions: string[] }>): boolean {
  return matchesSubFilterLib(y as unknown as Parameters<typeof matchesSubFilterLib>[0], filter, subKey, timKerjaGroups);
}

export function displayRoles(user: YouthUser): Array<{ key: string; role: string; label: string; color: string; detail: string }> {
  const status = String(user.memberStatus || 'ACTIVE').toUpperCase();
  if (status === 'ALUMNI' || status === 'NONAKTIF') {
    return [{
      key: 'member-status',
      role: status,
      label: status === 'ALUMNI' ? 'Alumni' : 'Nonaktif',
      color: status === 'ALUMNI' ? 'bg-slate-100 text-slate-600' : 'bg-gray-100 text-gray-600',
      detail: status === 'ALUMNI' ? 'Alumni kelompok binaan' : 'Tidak aktif',
    }];
  }
  if (user.roleAssignments?.length > 0) {
    return user.roleAssignments
      .filter((ra) => ra.isActive)
      .map((ra) => {
        if (BEYONDER_ROLES.includes(ra.role)) {
          const detail = ra.group?.name
            ? `${ra.group.name} ${ra.familyRole || ''}`.trim()
            : 'Individu';
          return {
            key: ra.id,
            role: 'COMMUNITY',
            label: 'Community',
            color: ROLE_COLORS.COMMUNITY,
            detail,
          };
        }

        const parts: string[] = [];
        if (ra.position) parts.push(ra.position);
        if (ra.division) parts.push(ra.subdivision ? `${ra.division}/${ra.subdivision}` : ra.division);
        return {
          key: ra.id,
          role: ra.role,
          label: ROLE_LABELS[ra.role] || ra.role,
          color: ROLE_COLORS[ra.role] || 'bg-gray-100 text-gray-600',
          detail: parts.join(' · '),
        };
      });
  }

  if (user.isIndividuExplicit) {
    return [{ key: 'individu', role: 'INDIVIDU', label: 'Individu (eksplisit)', color: 'bg-amber-100 text-amber-800', detail: 'Tidak bisa jadi Beyonders' }];
  }
  if (user.isBeyonders === false && !user.isIndividuExplicit && (user.roles?.length || user.roleAssignments?.length) === 0) {
    return [{ key: 'belum', role: 'COMMUNITY', label: 'Belum ditempatkan', color: 'bg-gray-100 text-gray-600', detail: 'Pemuda — belum assign' }];
  }
  return (user.roles || []).map((ur) => ({
    key: `legacy-${ur.id}`,
    role: ur.role,
    label: ROLE_LABELS[ur.role] || ur.role,
    color: ROLE_COLORS[ur.role] || 'bg-gray-100 text-gray-600',
    detail: '',
  }));
}

/** Status penempatan untuk kolom CSV + badge ringkas. */
export function placementStatusLabel(user: YouthUser): string {
  const status = String(user.memberStatus || 'ACTIVE').toUpperCase();
  if (status === 'ALUMNI') return 'Alumni';
  if (status === 'NONAKTIF') return 'Nonaktif';
  const ra = (user.roleAssignments || []).filter((r) => r.isActive && BEYONDER_ROLES.includes(r.role));
  const withGroup = ra.find((r) => r.group?.name && r.group.name !== 'Tanpa Group');
  if (withGroup) return `Community – ${withGroup.group!.name}`;
  if (ra.length) return 'Community – Individu (tanpa grup)';
  if (user.isIndividuExplicit) return 'Individu (eksplisit)';
  const legacy = (user.roles || []).some((r) => BEYONDER_ROLES.includes(r.role));
  if (legacy) return 'Community – legacy (belum ada grup)';
  return 'Belum ditempatkan';
}

export function beyonderAssignment(user: YouthUser): RoleAssignment | null {
  const ra = (user.roleAssignments || []).filter((r) => r.isActive && BEYONDER_ROLES.includes(r.role));
  return ra.find((r) => r.group?.name && r.group.name !== 'Tanpa Group') || ra[0] || null;
}

export function domicileLabel(u: YouthUser): string {
  if (u.addressScope === 'INTL' && u.addressCountry && u.addressCountry !== 'ID') {
    return countryName(u.addressCountry);
  }
  return 'Indonesia';
}
