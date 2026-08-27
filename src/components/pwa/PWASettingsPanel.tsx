import React, { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, CheckCircle2, XCircle, Loader2, Smartphone, Globe, WifiOff, Download, Trash2, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface PWASettingsPanelProps {
  onClose?: () => void;
}

export default function PWASettingsPanel({ onClose }: PWASettingsPanelProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [cacheSize, setCacheSize] = useState<string>('...');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    init();
    setupListeners();
  }, []);

  const init = async () => {
    setPermission(Notification.permission);
    setIsOnline(navigator.onLine);
    setIsStandalone(checkStandalone());
    await checkSW();
    await checkSubscription();
    await measureCache();
  };

  const setupListeners = () => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    window.addEventListener('beforeinstallprompt', () => { /* handled */ });
  };

  const checkStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
  };

  const checkSW = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      setSwRegistered(true);
    } catch { /* skip */ }
  };

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setSubscription(sub);
    } catch { /* skip */ }
  };

  const measureCache = async () => {
    if (!('caches' in window)) return;
    try {
      let total = 0;
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        for (const req of keys) {
          const resp = await cache.match(req);
          if (resp) {
            const blob = await resp.blob();
            total += blob.size;
          }
        }
      }
      setCacheSize(formatBytes(total));
    } catch { /* skip */ }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const requestPermission = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') await subscribe();
    } finally {
      setLoading(false);
    }
  }, []);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = (window as any).PWA?.VAPID_PUBLIC_KEY || 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

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
      setSubscription(sub);
    } catch (err) {
      console.error('Subscribe failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!('serviceWorker' in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        setSubscribed(false);
        setSubscription(null);
      }
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    if (!('caches' in window)) return;
    try {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
      await measureCache();
      // Re-register SW to repopulate
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
      }
    } catch (err) {
      console.error('Clear cache failed:', err);
    }
  };

  const unregisterSW = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
      setSwRegistered(false);
    } catch (err) {
      console.error('Unregister SW failed:', err);
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

  const copyEndpoint = () => {
    if (subscription) {
      navigator.clipboard.writeText(subscription.endpoint);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#1B1B1B]">PWA & Notifikasi</h2>
          <p className="text-sm text-[#8C8880]">Kelola Progressive Web App & push notifications</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-[#8C8880]">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusCard
          icon={isStandalone ? <Smartphone className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
          title="Mode Aplikasi"
          value={isStandalone ? 'Standalone (PWA)' : 'Browser Tab'}
          color={isStandalone ? 'green' : 'blue'}
        />
        <StatusCard
          icon={isOnline ? <WifiOff className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          title="Koneksi"
          value={isOnline ? 'Online' : 'Offline'}
          color={isOnline ? 'green' : 'red'}
        />
        <StatusCard
          icon={swRegistered ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          title="Service Worker"
          value={swRegistered ? 'Aktif' : 'Tidak Aktif'}
          color={swRegistered ? 'green' : 'amber'}
        />
        <StatusCard
          icon={subscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          title="Push Notifikasi"
          value={subscribed ? 'Berlangganan' : permission === 'denied' ? 'Diblokir' : 'Belum Aktif'}
          color={subscribed ? 'green' : permission === 'denied' ? 'red' : 'amber'}
        />
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-5">
        <h3 className="text-lg font-bold text-[#1B1B1B] mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#F6AE4A]" /> Notifikasi Push
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F5]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${permission === 'granted' ? 'bg-green-100 text-green-600' : permission === 'denied' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                {permission === 'granted' ? <CheckCircle2 className="w-5 h-5" /> : permission === 'denied' ? <XCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-sm text-[#1B1B1B]">Izin Browser</p>
                <p className="text-xs text-[#8C8880]">
                  {permission === 'granted' ? 'Diizinkan' : permission === 'denied' ? 'Ditolak - ubah di pengaturan browser' : 'Belum ditanyakan'}
                </p>
              </div>
            </div>
            {permission === 'default' && (
              <button onClick={requestPermission} disabled={loading} className="px-4 py-2 rounded-lg bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Minta Izin'}
              </button>
            )}
            {permission === 'denied' && (
              <a href="#" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg border border-[#D9D7D0] text-sm font-bold text-[#8C8880] hover:bg-gray-50">
                Buka Pengaturan
              </a>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F5]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${subscribed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {subscribed ? <CheckCircle2 className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-sm text-[#1B1B1B]">Push Subscription</p>
                <p className="text-xs text-[#8C8880]">
                  {subscribed ? 'Aktif - menerima notifikasi real-time' : 'Tidak berlangganan'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!subscribed && permission === 'granted' && (
                <button onClick={subscribe} disabled={loading} className="px-4 py-2 rounded-lg bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Berlangganan'}
                </button>
              )}
              {subscribed && (
                <>
                  <button onClick={copyEndpoint} className="px-3 py-2 rounded-lg border border-[#D9D7D0] text-xs font-bold text-[#8C8880] hover:bg-gray-50">
                    Salin Endpoint
                  </button>
                  <button onClick={unsubscribe} disabled={loading} className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Batalkan'}
                  </button>
                </>
              )}
            </div>
          </div>

          {subscription && (
            <details className="border border-[#D9D7D0]/50 rounded-xl">
              <summary className="p-3 cursor-pointer text-xs font-bold text-[#8C8880] uppercase tracking-wider">
                Detail Subscription
              </summary>
              <div className="px-3 pb-3 text-[10px] font-mono bg-[#FAF9F5]">
                <p className="truncate">Endpoint: {subscription.endpoint}</p>
                <p className="truncate mt-1">p256dh: {subscription.getKey('p256dh') ? arrayBufferToBase64(subscription.getKey('p256dh')!).slice(0, 32) + '...' : 'null'}</p>
                <p className="truncate mt-1">auth: {subscription.getKey('auth') ? arrayBufferToBase64(subscription.getKey('auth')!).slice(0, 32) + '...' : 'null'}</p>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Cache & Offline */}
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-5">
        <h3 className="text-lg font-bold text-[#1B1B1B] mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-[#F6AE4A]" /> Cache & Offline
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-[#FAF9F5]">
            <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider mb-1">Ukuran Cache</p>
            <p className="text-lg font-bold text-[#1B1B1B]">{cacheSize}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF9F5]">
            <p className="text-xs font-bold text-[#8C8880] uppercase tracking-wider mb-1">Mode Offline</p>
            <p className="text-lg font-bold text-[#1B1B1B]">{swRegistered ? 'Didukung' : 'Tidak Tersedia'}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={clearCache} className="px-4 py-2 rounded-lg border border-[#D9D7D0] text-sm font-bold text-[#8C8880] hover:bg-gray-50 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Bersihkan Cache
          </button>
          <button onClick={unregisterSW} className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Unregister SW
          </button>
        </div>
      </div>

      {/* Install PWA */}
      {!isStandalone && (
        <div className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-5">
          <h3 className="text-lg font-bold text-[#1B1B1B] mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#F6AE4A]" /> Install Aplikasi
          </h3>
          <p className="text-sm text-[#8C8880] mb-4">
            Install GEHC Youth sebagai aplikasi native untuk akses cepat, notifikasi push, & dukungan offline.
          </p>
          <button onClick={installPWA} className="px-6 py-3 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4" /> Install Sekarang
          </button>
        </div>
      )}

      {isStandalone && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800">Aplikasi Terinstall</p>
              <p className="text-sm text-green-700">Anda menjalankan GEHC Youth sebagai PWA standalone</p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>PWA (Progressive Web App)</strong> memungkinkan GEHC Youth bekerja seperti aplikasi native.</p>
            <p>• <strong>Offline:</strong> Halaman static & cache tersedia tanpa internet</p>
            <p>• <strong>Push:</strong> Notifikasi real-time walau browser tertutup</p>
            <p>• <strong>Install:</strong> Tambah ke homescreen tanpa app store</p>
            <p>• <strong>Update:</strong> Otomatis saat versi baru tersedia</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string; color: 'green' | 'blue' | 'amber' | 'red' }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}