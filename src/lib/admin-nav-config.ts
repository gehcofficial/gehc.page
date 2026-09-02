import { AdminPage } from './admin-routes';

export type AdminNavItem = {
  id: AdminPage;
  label: string;
  capability?: string;
  rootOnly?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard Platform' },
  { id: 'platform-admins', label: 'Platform Admins', capability: 'platform_admins', rootOnly: true },
  { id: 'access-groups', label: 'Access Groups', capability: 'access_groups' },
  { id: 'people', label: 'Orang & Provision', capability: 'users_provision' },
  { id: 'integrations', label: 'Integrasi Drive', capability: 'integrations' },
  { id: 'audit', label: 'Audit Log', capability: 'drive_audit', rootOnly: true },
  { id: 'passkey', label: 'Kelola Passkey', capability: 'passkey_manage', rootOnly: true },
];

export function buildAdminNavItems(capabilities: string[], isRoot: boolean): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => {
    if (item.rootOnly && !isRoot) return false;
    if (!item.capability) return true;
    return capabilities.includes(item.capability);
  });
}
