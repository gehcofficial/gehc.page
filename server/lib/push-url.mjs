/**
 * Normalisasi URL tujuan push notification.
 *
 * Konteks: `clients.openWindow(url)` di service worker me-resolve URL relatif
 * terhadap URL script SW (`/sw.js`), BUKAN terhadap root. URL telanjang
 * `#/portal/...` akan menjadi `/sw.js#/portal/...` dan browser menampilkan
 * source SW sebagai halaman. Semua URL hash-router WAJIB berbentuk `/#/…`.
 */
export const PUSH_URL_FALLBACK = '/#/portal';

export function normalizePushUrl(href) {
  const s = String(href || '').trim();
  if (!s) return PUSH_URL_FALLBACK;
  if (/^https?:\/\//i.test(s)) return s;
  if (s === '/') return '/';
  if (s.startsWith('/#/')) return s;
  if (s.startsWith('#/')) return `/${s}`;
  if (s.startsWith('#')) return `/#/${s.slice(1)}`;
  if (s.startsWith('/')) return `/#${s}`;
  return `/#/${s}`;
}
