import type { Dict } from '../i18n';
import type { UserRole } from '../types';
import type { PortalGuide } from '../i18n/portal-en';

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function portalNavLabel(
  t: Dict,
  id: string,
  opts?: { isGroupMentor?: boolean; isMentee?: boolean },
): string {
  const nav = t.portal.nav;
  if (id === 'groups-monitoring') {
    if (opts?.isGroupMentor) return nav.groupsMonitoringBinaan;
    if (opts?.isMentee) return nav.groupsMonitoringMine;
    return nav['groups-monitoring'];
  }
  const key = id as keyof typeof nav;
  return nav[key] || id;
}

export function portalNavGroup(t: Dict, group: string): string {
  const groups = t.portal.navGroups;
  const key = group as keyof typeof groups;
  return groups[key] || group;
}

export function portalRoleLabel(t: Dict, role: string): string {
  const roles = t.portal.roles;
  const key = role as keyof typeof roles;
  return roles[key] || role;
}

export function portalGuide(t: Dict, id: string): PortalGuide | null {
  const guides = t.portal.guides as Record<string, PortalGuide>;
  return guides[id] ?? null;
}
