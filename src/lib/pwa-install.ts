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

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const win = window as Window & {
    deferredPrompt?: BeforeInstallPromptEvent;
    PWA?: { install?: () => Promise<boolean> };
  };
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
