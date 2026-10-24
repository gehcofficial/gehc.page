/** Path hash portal untuk tautan pengisian penatalayan BOD. */
export function penatalayanBodLinkHash(
  token: string,
  namespace = 'mentor',
  domain?: 'HOST' | 'RESPONSIBLE' | '',
): string {
  const t = String(token || '').trim();
  const dom = domain ? `&domain=${domain}` : '';
  return `#/portal/${namespace}/penatalayan-tautan?token=${encodeURIComponent(t)}${dom}`;
}

/** URL absolut (preview / produksi) dari token. */
export function penatalayanBodLinkUrl(
  token: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  domain?: 'HOST' | 'RESPONSIBLE' | '',
): string {
  const base = String(origin || '').replace(/\/$/, '');
  const hash = penatalayanBodLinkHash(token, 'mentor', domain);
  return `${base}/${hash.startsWith('#') ? hash : `#${hash}`}`;
}
