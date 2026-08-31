/**
 * Hash route map — synced with AppContext publicTab.
 */
export const PUBLIC_ROUTES = [
  'beyonders',
  'leaders',
  'events',
  'bulletin',
  'join',
  'login',
  'register',
  'gallery',
  'benzarpreneurship',
] as const;

export type PublicRouteId = (typeof PUBLIC_ROUTES)[number] | 'event-signup';

export const LEGACY_HASH_MAP: Record<string, PublicRouteId> = {
  home: 'beyonders',
  groups: 'beyonders',
  struktur: 'leaders',
  komisi: 'leaders',
  'weekly-info': 'bulletin',
  activity: 'events',
  warta: 'bulletin',
};

export function tabFromHash(hash: string): PublicRouteId {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path.startsWith('event/')) return 'event-signup';
  if ((PUBLIC_ROUTES as readonly string[]).includes(path)) return path as PublicRouteId;
  if (LEGACY_HASH_MAP[path]) return LEGACY_HASH_MAP[path];
  return 'beyonders';
}

export function eventSlugFromHash(hash: string): string | undefined {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path.startsWith('event/')) {
    const slug = path.slice('event/'.length);
    return slug || undefined;
  }
  return undefined;
}
