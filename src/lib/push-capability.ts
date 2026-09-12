export type PushCapability =
  | 'supported'
  | 'ios-need-install'
  | 'ios-old'
  | 'inapp-browser'
  | 'insecure'
  | 'no-sw'
  | 'denied'
  | 'default';

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
}

export function isIosDevice(): boolean {
  const n = ua();
  if (/iPad|iPhone|iPod/i.test(n)) return true;
  return typeof navigator !== 'undefined'
    && (navigator as unknown as { platform?: string }).platform === 'MacIntel'
    && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints > 1;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isInAppBrowser(): boolean {
  const n = ua();
  return /wv|FBAN|FBAV|Instagram|Line|WhatsApp|MiuiBrowser|FB_IAB|FBAN|FBAV/i.test(n);
}

function iosMajor(): number | null {
  const n = ua();
  const m = n.match(/OS (\d+)_/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function isSecure(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Kemampuan push.
 *
 * Urutan penting: di iOS, `PushManager`/`Notification` hanya tersedia saat web
 * app dijalankan dari Home Screen (standalone). Kalau kita cek `PushManager`
 * lebih dulu, pengguna Safari tab (iOS 16.4+) salah mendapat pesan "browser
 * tidak dukung". Karena itu deteksi iOS didahulukan, baru API generic.
 */
export function pushCapability(): { state: PushCapability; reason: string } {
  try {
    const ios = isIosDevice();

    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      return { state: 'denied', reason: 'Izin notifikasi diblokir di browser.' };
    }
    if (!isSecure()) return { state: 'insecure', reason: 'Butuh HTTPS untuk push (buka https://youth.gehc.page).' };
    if (isInAppBrowser()) return { state: 'inapp-browser', reason: 'Buka dari WhatsApp/Instagram — perlu buka di Chrome/Safari asli.' };

    // iOS lebih dulu: Safari tab tidak punya PushManager walau iOS 16.4+.
    if (ios) {
      const major = iosMajor();
      if (major !== null && major < 16) return { state: 'ios-old', reason: 'Butuh iOS 16.4+ untuk push.' };
      if (major === 16) {
        const m2 = ua().match(/OS 16_(\d+)/i);
        const minor = m2 ? parseInt(m2[1], 10) : 0;
        if (minor < 4) return { state: 'ios-old', reason: 'Butuh iOS 16.4+ (update iOS).' };
      }
      if (!isStandalone()) return { state: 'ios-need-install', reason: 'iPhone perlu Install ke Home Screen dulu.' };
      if (
        typeof Notification === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        return { state: 'no-sw', reason: 'Buka ulang dari ikon GEHC di Home Screen untuk mengaktifkan notifikasi.' };
      }
      return { state: 'supported', reason: 'Siap.' };
    }

    if (typeof Notification === 'undefined') return { state: 'no-sw', reason: 'Browser tidak dukung notifikasi.' };
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { state: 'no-sw', reason: 'Browser tidak dukung push.' };
    return { state: 'supported', reason: 'Siap.' };
  } catch {
    return { state: 'no-sw', reason: 'Tidak didukung.' };
  }
}

export function pushCapabilityMessage(state: PushCapability): { title: string; body: string; action: string } {
  switch (state) {
    case 'ios-need-install':
      return { title: 'Install dulu di iPhone', body: 'Safari → Share (kotak panah) → Add to Home Screen → buka dari ikon GEHC → Aktifkan lagi. Butuh iOS 16.4+.', action: 'Cara Install' };
    case 'ios-old':
      return { title: 'Update iOS', body: 'Push di iPhone butuh iOS 16.4+. Update di Pengaturan → Umum → Pembaruan.', action: 'Update' };
    case 'inapp-browser':
      return { title: 'Buka di browser asli', body: 'Anda buka dari WhatsApp/IG. Tap ⋮ (kanan atas) → Open in Chrome / Open in Safari → Aktifkan.', action: 'Buka' };
    case 'insecure':
      return { title: 'Butuh HTTPS', body: 'Buka https://youth.gehc.page (bukan http) untuk aktifkan notifikasi.', action: 'Buka' };
    case 'no-sw':
      return isIosDevice()
        ? { title: 'Buka dari ikon iPhone', body: 'Pastikan dibuka dari ikon GEHC yang sudah ditambahkan ke Home Screen (Safari → Share → Add to Home Screen), bukan tab Safari.', action: 'Cara Install' }
        : { title: 'Browser tidak dukung', body: 'Coba Chrome terbaru atau Safari terbaru.', action: '' };
    case 'denied':
      return { title: 'Izin diblokir', body: 'Android: tap gembok di address bar → Site settings → Notifications → Allow. iPhone: Settings → Apps → Safari → Notifications.', action: 'Coba lagi' };
    default:
      return { title: 'Siap', body: '', action: '' };
  }
}
