/**
 * Navigasi saat notifikasi push diklik dan aplikasi SUDAH terbuka.
 *
 * Alur: SW `notificationclick` → focus tab + postMessage NOTIFICATION_CLICK →
 * `pwa-register.js` dispatch CustomEvent `pwa-notification-click` → listener
 * ini memindahkan hash router ke halaman tujuan. Tanpa ini, klik notif saat
 * app terbuka hanya memfokuskan tab tanpa navigasi ke mana pun.
 */
export function initPwaNotificationNav(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  if (w.__gehcPwaNotifNav) return;
  w.__gehcPwaNotifNav = true;
  window.addEventListener('pwa-notification-click', (ev) => {
    const detail = (ev as CustomEvent)?.detail || {};
    const raw = typeof detail.url === 'string' ? detail.url.trim() : '';
    if (!raw) return;
    // URL absolut: hanya same-origin (anti open-redirect).
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw, window.location.origin);
        if (u.origin === window.location.origin && window.location.href !== u.href) {
          window.location.href = u.href;
        }
      } catch {
        /* abaikan URL rusak */
      }
      return;
    }
    // '/#/portal/x' → '#/portal/x'; '#/x' → '#/x' (picu hashchange → router).
    const hash = raw.startsWith('/') ? raw.slice(1) : raw;
    if (hash.startsWith('#') && window.location.hash !== hash) {
      window.location.hash = hash;
    }
  });
}
