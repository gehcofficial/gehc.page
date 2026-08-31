/**
 * Hash route map — synced with AppContext publicTab.
 * React Router HashRouter wraps the app for forward-compatible deep links.
 */
export const PUBLIC_ROUTES = [
  'beyonders',
  'leaders',
  'events',
  'bulletin',
  'join',
  'gallery',
  'benzarpreneurship',
] as const;

export type PublicRouteId = (typeof PUBLIC_ROUTES)[number];

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
  if ((PUBLIC_ROUTES as readonly string[]).includes(path)) return path as PublicRouteId;
  if (LEGACY_HASH_MAP[path]) return LEGACY_HASH_MAP[path];
  return 'beyonders';
}
