export type PwaInstallKind = 'chromium' | 'ios' | 'macos-safari' | 'other';

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
}

export function isIosDevice(): boolean {
  const n = ua();
  if (/iPad|iPhone|iPod/i.test(n)) return true;
  return typeof navigator !== 'undefined'
    && navigator.platform === 'MacIntel'
    && navigator.maxTouchPoints > 1;
}

export function isSafariBrowser(): boolean {
  const n = ua();
  if (!/safari/i.test(n)) return false;
  return !/crios|fxios|edgios|chrome|chromium|android/i.test(n);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function detectPwaInstallKind(): PwaInstallKind {
  if (isIosDevice()) return 'ios';
  const n = ua();
  if (/Macintosh|Mac OS X/i.test(n) && isSafariBrowser()) return 'macos-safari';
  if (/Edg|Chrome|Chromium|OPR|SamsungBrowser/i.test(n) && !isIosDevice()) return 'chromium';
  return 'other';
}

export function notificationPermission(): NotificationPermission {
  try {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  } catch {
    return 'denied';
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PwaWindow = Window & {
  deferredPrompt?: BeforeInstallPromptEvent;
  PWA?: {
    install?: () => Promise<boolean>;
    canInstall?: () => boolean;
    isInstalled?: () => boolean;
    checkForUpdate?: () => Promise<void>;
    applyUpdate?: () => Promise<void> | void;
    hardReload?: () => Promise<void> | void;
    BUILD_ID?: string;
  };
};

function pwaApi() {
  return (typeof window === 'undefined' ? {} : (window as PwaWindow).PWA) || {};
}

/** Build id bundle saat ini (disuntik Vite; 'dev' di server lokal). */
export function pwaBuildId(): string {
  try {
    return pwaApi().BUILD_ID || __BUILD_ID__;
  } catch {
    return 'dev';
  }
}

export function canInstallPwa(): boolean {
  if (isStandaloneDisplay()) return false;
  const win = window as PwaWindow;
  if (win.PWA?.canInstall) return win.PWA.canInstall();
  return Boolean(win.deferredPrompt?.prompt);
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const win = window as PwaWindow;
  if (win.deferredPrompt?.prompt) {
    win.deferredPrompt.prompt();
    const { outcome } = await win.deferredPrompt.userChoice;
    win.deferredPrompt = undefined;
    return outcome === 'accepted' ? 'accepted' : 'dismissed';
  }
  if (win.PWA?.install) {
    const ok = await win.PWA.install();
    return ok ? 'accepted' : 'unavailable';
  }
  return 'unavailable';
}

/** Minta browser memeriksa service worker terbaru. */
export async function checkPwaUpdate(): Promise<void> {
  try {
    await pwaApi().checkForUpdate?.();
  } catch {
    /* offline */
  }
}

/** Aktifkan SW baru lalu muat ulang (fallback: bersihkan cache + reload). */
export async function applyPwaUpdate(): Promise<void> {
  const api = pwaApi();
  if (api.applyUpdate) {
    await api.applyUpdate();
    return;
  }
  await recoverBrokenClientCache();
  window.location.reload();
}

/** Pemulihan paksa untuk klien yang terjebak versi lama. */
export async function refreshPwaClient(): Promise<void> {
  const api = pwaApi();
  if (api.hardReload) {
    await api.hardReload();
    return;
  }
  await recoverBrokenClientCache();
  window.location.reload();
}

/** Dengarkan event 'pwa-update-available' dari pwa-register.js. */
export function onPwaUpdateAvailable(cb: (buildId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ buildId?: string }>).detail;
    cb(detail?.buildId || '');
  };
  window.addEventListener('pwa-update-available', handler);
  return () => window.removeEventListener('pwa-update-available', handler);
}

/** Dengarkan event 'pwa-installable' (beforeinstallprompt tersedia). */
export function onPwaInstallable(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('pwa-installable', cb);
  return () => window.removeEventListener('pwa-installable', cb);
}

export async function recoverBrokenClientCache(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* continue reload */
  }
}
