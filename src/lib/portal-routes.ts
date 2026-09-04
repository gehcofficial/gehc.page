import { UserRole } from '../types';

export const ROLE_NAMESPACE: Record<UserRole, string> = {
  SUPERADMIN: 'superadmin',
  BPMJ: 'bpmj',
  KOMISI: 'komisi',
  COMMITTEE: 'committee',
  MENTOR: 'mentor',
  CO_MENTOR: 'co-mentor',
  MENTEE: 'mentee',
  ALUMNI: 'alumni',
};

export const NAMESPACE_ROLE: Record<string, UserRole> = Object.fromEntries(
  Object.entries(ROLE_NAMESPACE).map(([role, ns]) => [ns, role as UserRole]),
) as Record<string, UserRole>;

export type PortalPage =
  | 'dashboard'
  | 'my-profile'
  | 'event-info'
  | 'people'
  | 'onboarding'
  | 'jethro-placement'
  | 'youth-gehc'
  | 'catalog'
  | 'org-hierarchy'
  | 'groups-monitoring'
  | 'pastoral-care'
  | 'jethro'
  | 'content-weekly'
  | 'content-activities'
  | 'content-testimonials'
  | 'media-guide'
  | 'struktur'
  | 'events'
  | 'divisions'
  | 'wa-channels'
  | 'integrations'
  | 'pwa-settings';

export type AccountSection = 'profile' | 'security' | 'notifications' | 'roles';

export type ParsedPortalRoute = {
  isPortal: boolean;
  namespace: string | null;
  page: string;
  accountSection?: AccountSection;
};

const ACCOUNT_SECTIONS = new Set<AccountSection>(['profile', 'security', 'notifications', 'roles']);

export function parseHashSearch(hash = typeof window !== 'undefined' ? window.location.hash : ''): URLSearchParams {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(q);
}

export function isPortalHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  return raw === 'portal' || raw.startsWith('portal/');
}

export function parsePortalHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): ParsedPortalRoute | null {
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  const segments = raw.split('/').filter(Boolean);
  if (segments[0] !== 'portal') return null;

  if (segments.length === 1) {
    return { isPortal: true, namespace: null, page: 'home' };
  }

  const ns = segments[1];
  if (ns === 'account') {
    const sec = (segments[2] || 'profile') as AccountSection;
    return {
      isPortal: true,
      namespace: 'account',
      page: 'account',
      accountSection: ACCOUNT_SECTIONS.has(sec) ? sec : 'profile',
    };
  }

  const page = segments[2] || 'dashboard';
  return { isPortal: true, namespace: ns, page };
}

export function buildPortalPath(opts: {
  namespace?: string | null;
  page?: string;
  accountSection?: AccountSection;
}): string {
  const { namespace, page = 'dashboard', accountSection } = opts;
  if (namespace === 'account') {
    return `#/portal/account/${accountSection || 'profile'}`;
  }
  if (!namespace) return '#/portal';
  return `#/portal/${namespace}/${page}`;
}

export function roleToNamespace(role: UserRole): string {
  return ROLE_NAMESPACE[role];
}

export function namespaceToRole(ns: string): UserRole | null {
  return NAMESPACE_ROLE[ns] || null;
}

export function defaultPageForOnboarding(): string {
  return 'event-info';
}

export function defaultPageForRole(_role: UserRole, isOnboarding: boolean): string {
  return isOnboarding ? 'event-info' : 'dashboard';
}

export function navigatePortal(opts: Parameters<typeof buildPortalPath>[0]) {
  window.location.hash = buildPortalPath(opts).slice(1);
  window.scrollTo({ top: 0 });
}

export function legacyTabToPortalPage(tabId: string): PortalPage {
  if (tabId === 'my-profile') return 'my-profile';
  return tabId as PortalPage;
}

export function portalPageToLegacyTab(page: string): string {
  if (page === 'account') return 'account';
  if (page === 'my-profile') return 'my-profile';
  return page;
}
