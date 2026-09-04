export type ParsedHashRoute = {
  tab:
    | 'beyonders'
    | 'leaders'
    | 'events'
    | 'bulletin'
    | 'gallery'
    | 'join'
    | 'login'
    | 'register'
    | 'event-signup'
    | 'group-detail'
    | 'benzarpreneurship';
  eventSlug?: string;
  params: URLSearchParams;
};

const LEGACY_MAP: Record<string, ParsedHashRoute['tab']> = {
  home: 'beyonders',
  groups: 'beyonders',
  struktur: 'leaders',
  komisi: 'leaders',
  'weekly-info': 'bulletin',
  activity: 'events',
  warta: 'bulletin',
};

const PUBLIC_TABS = new Set<ParsedHashRoute['tab']>([
  'beyonders',
  'leaders',
  'events',
  'bulletin',
  'gallery',
  'join',
  'login',
  'register',
  'event-signup',
  'benzarpreneurship',
]);

export function parseHashRoute(hash = typeof window !== 'undefined' ? window.location.hash : ''): ParsedHashRoute {
  const raw = hash.replace(/^#\/?/, '');
  const qIdx = raw.indexOf('?');
  const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const queryPart = qIdx >= 0 ? raw.slice(qIdx + 1) : '';
  const params = new URLSearchParams(queryPart);
  const segments = pathPart.split('/').filter(Boolean);

  if (segments[0] === 'event' && segments[1]) {
    return { tab: 'event-signup', eventSlug: segments[1], params };
  }

  const first = segments[0] || 'beyonders';
  if (first === 'portal' || first === 'admin') {
    return { tab: 'beyonders', params };
  }
  if (first === 'group-detail') {
    return { tab: 'group-detail', params };
  }
  if (LEGACY_MAP[first]) {
    return { tab: LEGACY_MAP[first], params };
  }
  if (PUBLIC_TABS.has(first as ParsedHashRoute['tab'])) {
    return { tab: first as ParsedHashRoute['tab'], params };
  }
  return { tab: 'beyonders', params };
}

export function buildHashPath(tab: string, query?: Record<string, string>): string {
  const qs = query && Object.keys(query).length
    ? `?${new URLSearchParams(query).toString()}`
    : '';
  return `#/${tab}${qs}`;
}

export function navigateHash(tab: string, query?: Record<string, string>) {
  window.location.hash = buildHashPath(tab, query).slice(1);
  window.scrollTo({ top: 0 });
}

export function getNextFromHash(): string | null {
  const { params } = parseHashRoute();
  const next = params.get('next');
  return next?.trim() || null;
}

export function resolvePostAuthHash(next: string | null): string {
  if (!next) return '#/portal';
  if (next.startsWith('#/')) return next;
  if (next.startsWith('/')) return `#${next}`;
  return `#/${next.replace(/^\//, '')}`;
}
