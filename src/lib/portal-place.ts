/**
 * Posisi portal terakhir (untuk tombol Kembali di rute standalone).
 * localStorage (bukan sessionStorage) agar terbaca tab baru (target _blank).
 */

const LAST_PORTAL_KEY = 'gehc_last_portal';
const LAST_PORTAL_AT_KEY = 'gehc_last_portal_at';
const LAST_PORTAL_TTL_MS = 24 * 3600 * 1000;

/** Simpan posisi portal terakhir sebelum membuka halaman standalone. */
export function rememberPortalPlace(hash?: string): void {
  try {
    const h = hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
    if (/^#\/(portal|event|beyonders)/.test(h)) {
      window.localStorage.setItem(LAST_PORTAL_KEY, h);
      window.localStorage.setItem(LAST_PORTAL_AT_KEY, String(Date.now()));
    }
  } catch {
    /* storage diblokir */
  }
}

/** Hash kembali: posisi portal terakhir (<24 jam), fallback #/portal. */
export function lastPortalPlace(fallback = '#/portal'): string {
  try {
    const at = Number(window.localStorage.getItem(LAST_PORTAL_AT_KEY) || 0);
    const h = window.localStorage.getItem(LAST_PORTAL_KEY);
    if (h && /^#\//.test(h) && !h.startsWith('#/materi') && !h.startsWith('#/paparan') && Date.now() - at < LAST_PORTAL_TTL_MS) return h;
  } catch {
    /* abaikan */
  }
  return fallback;
}

/**
 * Tujuan tombol "Portal Liturgia": posisi div-liturgia terakhir bila ada,
 * lalu tab Liturgia namespace aktif, lalu posisi portal terakhir, lalu #/portal.
 */
export function portalLiturgiaHref(
  lastPlace?: string | null,
  activeNamespace?: string | null,
): string {
  if (lastPlace && lastPlace.includes('div-liturgia')) return lastPlace;
  const ns = String(activeNamespace || '').trim();
  if (ns) return `#/portal/${ns}/div-liturgia`;
  if (lastPlace) return lastPlace;
  return '#/portal';
}
