export type AdminPage =
  | 'dashboard'
  | 'platform-admins'
  | 'access-groups'
  | 'people'
  | 'integrations'
  | 'audit'
  | 'passkey';

export type ParsedAdminRoute = {
  isAdmin: boolean;
  page: AdminPage;
};

const ADMIN_PAGES = new Set<AdminPage>([
  'dashboard',
  'platform-admins',
  'access-groups',
  'people',
  'integrations',
  'audit',
  'passkey',
]);

export function isAdminHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  return raw === 'admin' || raw.startsWith('admin/');
}

export function parseAdminHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): ParsedAdminRoute | null {
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  const segments = raw.split('/').filter(Boolean);
  if (segments[0] !== 'admin') return null;
  const page = (segments[1] || 'dashboard') as AdminPage;
  return {
    isAdmin: true,
    page: ADMIN_PAGES.has(page) ? page : 'dashboard',
  };
}

export function buildAdminPath(page: AdminPage = 'dashboard'): string {
  if (page === 'dashboard') return '#/admin';
  return `#/admin/${page}`;
}

export function navigateAdmin(page: AdminPage) {
  window.location.hash = buildAdminPath(page).slice(1);
  window.scrollTo({ top: 0 });
}
