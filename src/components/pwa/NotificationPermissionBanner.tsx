import React, { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, Download, Smartphone, CheckCircle2, XCircle, Loader2, AlertCircle, Info } from 'lucide-react';

interface NotificationPermissionBannerProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export default function NotificationPermissionBanner({ onDismiss, compact = false }: NotificationPermissionBannerProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPermission(Notification.permission);
    checkSubscription();
    registerSW();
  }, []);

  const registerSW = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      setSwRegistered(true);
      console.log('SW registered:', reg.scope);
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  };

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch { /* skip */ }
  };

  const requestPermission = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        await subscribe();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = (window as any).PWA?.VAPID_PUBLIC_KEY || 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send to server
      await fetch('/api/paw/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
            auth: arrayBufferToBase64(sub.getKey('auth')),
          },
        }),
      });

      setSubscribed(true);
    } catch (err) {
      console.error('Subscribe failed:', err);
    }
  };

  const unsubscribe = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        setSubscribed(false);
      }
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  };

  const installPWA = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      (window as any).deferredPrompt = null;
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer | null) => {
    if (!buffer) return '';
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  // Don't show if already subscribed and not compact
  if (!compact && subscribed && permission === 'granted') return null;

  // Don't show if denied and not compact
  if (!compact && permission === 'denied') return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-[#D9D7D0]/50">
        <div className="flex-1">
          <p className="text-sm font-bold text-[#1B1B1B]">Notifikasi Push</p>
          <p className="text-xs text-[#8C8880]">
            {subscribed ? 'Aktif - Anda akan menerima notifikasi' :
              permission === 'granted' ? 'Izin diberikan, mengaktifkan...' :
                permission === 'denied' ? 'Diblokir - aktifkan di pengaturan browser' : 'Klik untuk mengaktifkan'}
          </p>
        </div>
        <div className="flex gap-2">
          {!subscribed && permission !== 'denied' && (
            <button
              onClick={requestPermission}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-bold bg-[#F6AE4A] text-[#1B1B1B] rounded-lg disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aktifkan'}
            </button>
          )}
          {subscribed && (
            <button
              onClick={unsubscribe}
              className="px-3 py-1.5 text-xs font-bold border border-[#D9D7D0] text-[#8C8880] rounded-lg hover:bg-gray-50"
            >
              Nonaktifkan
            </button>
          )}
          {permission === 'denied' && (
            <a href="#" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-bold text-[#F6AE4A] hover:underline">
              Pengaturan
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#F6AE4A]/10 to-[#F6AE4A]/5 border border-[#F6AE4A]/30 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-[#F6AE4A]/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-[#F6AE4A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1B1B1B]">Aktifkan Notifikasi Push</p>
            <p className="text-xs text-[#8C8880] mt-0.5">
              Dapatkan update real-time: warta baru, jadwal penatalayan, galeri event, & info toko.
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-white/50 text-[#8C8880] shrink-0">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FeatureIcon icon={<Bell className="w-5 h-5" />} title="Warta Publik" desc="Warta mingguan siap baca" />
        <FeatureIcon icon={<Smartphone className="w-5 h-5" />} title="Penatalayan" desc="Jadwal ibadah & reminder" />
        <FeatureIcon icon={<Download className="w-5 h-5" />} title="Galeri & Toko" desc="Foto event & promo merchandise" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {permission === 'default' && (
          <button
            onClick={requestPermission}
            disabled={loading}
            className="flex-1 min-w-[140px] py-2.5 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {loading ? 'Mengaktifkan...' : 'Izinkan Notifikasi'}
          </button>
        )}

        {permission === 'granted' && !subscribed && (
          <button
            onClick={subscribe}
            disabled={loading}
            className="flex-1 min-w-[140px] py-2.5 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {loading ? 'Mendaftarkan...' : 'Daftarkan Push'}
          </button>
        )}

        {subscribed && (
          <>
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-bold">
              <CheckCircle2 className="w-4 h-4" /> Push aktif
            </span>
            <button
              onClick={unsubscribe}
              className="px-4 py-2 rounded-xl border border-[#D9D7D0] text-sm font-bold text-[#8C8880] hover:bg-gray-50"
            >
              Nonaktifkan
            </button>
          </>
        )}

        {permission === 'denied' && (
          <div className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-bold">
            <AlertCircle className="w-4 h-4" /> Diblokir browser
          </div>
        )}

        {/* Install PWA button */}
        {!isStandalone() && (
          <button
            onClick={installPWA}
            className="flex-1 min-w-[140px] py-2.5 rounded-xl border border-[#D9D7D0] text-sm font-bold text-[#8C8880] hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Install App
          </button>
        )}
      </div>

      {swRegistered && (
        <p className="mt-3 text-[10px] text-[#8C8880] flex items-center gap-1">
          <Info className="w-3 h-3" /> Service Worker aktif — mendukung offline & background sync
        </p>
      )}
    </div>
  );
}

function FeatureIcon({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-white/50 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] flex items-center justify-center text-[#F6AE4A] shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-[#1B1B1B]">{title}</p>
        <p className="text-[10px] text-[#8C8880]">{desc}</p>
      </div>
    </div>
  );
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}