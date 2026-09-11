export type MainFilter = 'ALL' | 'INDIVIDU' | 'BEYONDERS' | 'TIMKERJA' | 'KOMISI' | 'BPMJ';

export const BEYONDER_ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE'] as const;

export interface YouthUserLite {
  id: string;
  bipra?: string | null;
  isIndividuExplicit?: boolean;
  isBeyonders?: boolean;
  roles?: Array<{ role: string; groupId?: string | null }>;
  roleAssignments: Array<{
    id: string;
    role: string;
    isActive: boolean;
    group?: { id: string; name: string } | null;
    groupId?: string | null;
    position?: string | null;
    division?: string | null;
  }>;
}

// strict: hanya assignment aktif + group 10 itu, legacy diabaikan, flag isBeyonders diabaikan
export function hasBeyonderWithGroup(y: YouthUserLite): boolean {
  return (y.roleAssignments || []).some((ra) => {
    if (!ra.isActive) return false;
    if (!(BEYONDER_ROLES as readonly string[]).includes(ra.role)) return false;
    // "Tanpa Group" bukan grup nyata → masuk Individu
    if (ra.group?.name === 'Tanpa Group') return false;
    return Boolean(ra.group?.id || ra.group?.name || ra.groupId);
  });
}

function hasRoleInAssignment(y: YouthUserLite, role: string): boolean {
  return (y.roleAssignments || []).some((ra) => ra.isActive && ra.role === role);
}

function hasRoleInLegacy(y: YouthUserLite, role: string): boolean {
  return (y.roles || []).some((ur) => ur.role === role);
}

export function matchesMainFilter(y: YouthUserLite, filter: MainFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'INDIVIDU') {
    if (y.bipra !== 'PEMUDA') return false;
    if (y.isIndividuExplicit) return true;
    // Pemuda tanpa group Beyonders → Individu (sesuai “Tanpa Group masuk Individu”)
    return !hasBeyonderWithGroup(y);
  }
  if (filter === 'BEYONDERS') {
    if (y.isIndividuExplicit) return false;
    if (y.bipra !== 'PEMUDA') return false;
    return hasBeyonderWithGroup(y);
  }
  if (filter === 'TIMKERJA') {
    return hasRoleInAssignment(y, 'COMMITTEE') || hasRoleInLegacy(y, 'COMMITTEE');
  }
  return hasRoleInAssignment(y, filter) || hasRoleInLegacy(y, filter);
}

export function matchesSubFilter(
  y: YouthUserLite,
  filter: MainFilter,
  subKey: string | null,
  timKerjaGroups: Array<{ key: string; label: string; divisions: string[] }>
): boolean {
  if (!subKey) return true;
  if (filter === 'BPMJ' || filter === 'KOMISI') {
    const roleKey = filter === 'BPMJ' ? 'BPMJ' : 'KOMISI';
    return (y.roleAssignments || []).some((ra) => ra.isActive && ra.role === roleKey && (ra.position || 'Anggota') === subKey);
  }
  if (filter === 'TIMKERJA') {
    const grp = timKerjaGroups.find((g) => g.key === subKey);
    if (!grp) return false;
    return (y.roleAssignments || []).some((ra) => ra.isActive && ra.role === 'COMMITTEE' && grp.divisions.includes(ra.division || ''));
  }
  if (filter === 'BEYONDERS') {
    return (y.roleAssignments || []).some((ra) => ra.isActive && (BEYONDER_ROLES as readonly string[]).includes(ra.role) && (ra.group?.name || '') === subKey);
  }
  return true;
}

export function buildSubFilters(
  y: YouthUserLite[],
  filter: MainFilter,
  timKerjaGroups: Array<{ key: string; label: string; divisions: string[] }>
): Array<{ key: string; label: string; count: number }> {
  if (filter === 'ALL') return [];
  const usersWithFilter = y.filter((u) => matchesMainFilter(u, filter));
  if (filter === 'BPMJ' || filter === 'KOMISI') {
    const posMap: Record<string, number> = {};
    const roleKey = filter === 'BPMJ' ? 'BPMJ' : 'KOMISI';
    usersWithFilter.forEach((u) => {
      (u.roleAssignments || [])
        .filter((ra) => ra.isActive && ra.role === roleKey)
        .forEach((ra) => {
          const pos = ra.position || 'Anggota';
          posMap[pos] = (posMap[pos] || 0) + 1;
        });
    });
    return Object.entries(posMap).map(([label, count]) => ({ key: label, label, count }));
  }
  if (filter === 'TIMKERJA') {
    const groupCounts: Record<string, number> = {};
    timKerjaGroups.forEach((g) => { groupCounts[g.key] = 0; });
    usersWithFilter.forEach((u) => {
      (u.roleAssignments || [])
        .filter((ra) => ra.isActive && ra.role === 'COMMITTEE')
        .forEach((ra) => {
          const grp = timKerjaGroups.find((g) => g.divisions.includes(ra.division || ''));
          if (grp) groupCounts[grp.key] = (groupCounts[grp.key] || 0) + 1;
        });
    });
    return timKerjaGroups.map((g) => ({ key: g.key, label: g.label, count: groupCounts[g.key] || 0 })).filter((g) => g.count > 0);
  }
  if (filter === 'BEYONDERS') {
    // hitung user unik per grup (bukan assignment)
    const groupUserSets: Record<string, Set<string>> = {};
    usersWithFilter.forEach((u) => {
      const seenForUser = new Set<string>();
      (u.roleAssignments || [])
        .filter((ra) => ra.isActive && (BEYONDER_ROLES as readonly string[]).includes(ra.role) && ra.group?.name)
        .forEach((ra) => {
          const grp = ra.group!.name;
          if (grp === 'Tanpa Group') return;
          if (seenForUser.has(grp)) return;
          seenForUser.add(grp);
          if (!groupUserSets[grp]) groupUserSets[grp] = new Set();
          groupUserSets[grp].add(u.id);
        });
    });
    return Object.entries(groupUserSets)
      .map(([label, set]) => ({ key: label, label, count: set.size }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  return [];
}
