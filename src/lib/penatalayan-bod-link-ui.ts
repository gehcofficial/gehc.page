/** Path hash portal untuk tautan pengisian penatalayan BOD. */
export function penatalayanBodLinkHash(token: string, namespace = 'mentor'): string {
  const t = String(token || '').trim();
  return `#/portal/${namespace}/penatalayan-tautan?token=${encodeURIComponent(t)}`;
}

/** URL absolut (preview / produksi) dari token. */
export function penatalayanBodLinkUrl(token: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  const base = String(origin || '').replace(/\/$/, '');
  return `${base}/${penatalayanBodLinkHash(token)}`;
}
