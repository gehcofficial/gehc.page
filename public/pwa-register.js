// PWA Registration, Update Manager & Push Notification Manager
// Dimuat dari index.html. Tidak di-bundle â€” perubahan di sini langsung berlaku
// pada deploy berikutnya (file tidak di-cache karena Vercel memasang no-cache
// untuk /sw.js dan app shell selalu network-first).
//
// Penting: service worker baru HARUS terdeteksi tiap deploy. Deteksi itu
// bergantung pada perubahan byte /sw.js (lihat stempel BUILD_ID di vite.config.ts).

(function () {
  'use strict';

  const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';
  const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 menit
  // Build id disuntik saat build oleh plugin vite sebagai baris assignment
  // di awal file ini; bernilai 'dev' saat serve lokal.
  const BUILD_ID = (typeof self !== 'undefined' && self.__GEHC_BUILD_ID__) || 'dev';

  let swRegistration = null;
  let reloading = false;

  // ---------------------------------------------------------------------------
  // Utilitas
  // ---------------------------------------------------------------------------

  const emit = (name, detail) => {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch { /* noop */ }
  };

  function isPWASupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Service worker + update manager
  // ---------------------------------------------------------------------------

  async function registerSW() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service worker tidak didukung');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      swRegistration = registration;
      console.log('SW registered:', registration.scope);

      // SW baru selesai install & ada controller lama â†’ tawarkan muat ulang.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            emit('pwa-update-available', { buildId: BUILD_ID });
          }
        });
      });

      // Sinkronkan build id SW dengan bundle aplikasi.
      registration.active?.postMessage({ type: 'GET_BUILD_ID' });

      checkForUpdate();
      return registration;
    } catch (err) {
      console.error('SW registration failed:', err);
      return null;
    }
  }

  /** Minta browser memeriksa /sw.js terbaru (dipanggil berkala & saat fokus). */
  async function checkForUpdate() {
    try {
      const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
      if (reg) await reg.update();
    } catch { /* offline / tidak didukung */ }
  }

  /** Terapkan update: minta SW baru aktif, lalu reload saat controller berganti. */
  async function applyUpdate() {
    try {
      const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Tidak ada SW menunggu â†’ cukup muat ulang.
        hardReload();
      }
    } catch {
      hardReload();
    }
  }

  /** Buang SW + cache lalu muat ulang â€” jalur pemulihan bila app terjebak versi lama. */
  async function hardReload() {
    if (reloading) return;
    reloading = true;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* tetap reload */ }
    window.location.reload();
  }

  // Reload sekali ketika SW baru mengambil alih halaman.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'NOTIFICATION_CLICK') {
        window.dispatchEvent(new CustomEvent('pwa-notification-click', { detail: data }));
      } else if (data.type === 'SW_ACTIVATED' && data.buildId && data.buildId !== BUILD_ID) {
        emit('pwa-update-available', { buildId: data.buildId });
      }
    });
  }

  // Cek update saat tab kembali aktif & secara berkala (PWA jarang cold-start).
  window.addEventListener('focus', () => { void checkForUpdate(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  setInterval(() => { void checkForUpdate(); }, UPDATE_CHECK_INTERVAL_MS);

  // ---------------------------------------------------------------------------
  // Push notification
  // ---------------------------------------------------------------------------

  async function subscribeToPush(registration) {
    try {
      let key = VAPID_PUBLIC_KEY;
      try {
        const r = await fetch('/api/push/config');
        if (r.ok) { const j = await r.json(); if (j.publicKey) key = j.publicKey; }
      } catch {}
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      await sendSubscriptionToServer(subscription);
      return subscription;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return null;
    }
  }

  async function unsubscribeFromPush(registration) {
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await deleteSubscriptionFromServer(subscription);
      }
      return true;
    } catch (err) {
      console.error('Push unsubscription failed:', err);
      return false;
    }
  }

  async function getSubscription(registration) {
    return registration.pushManager.getSubscription();
  }

  async function sendSubscriptionToServer(subscription) {
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      await fetch('/api/paw/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
          },
        }),
      });
    } catch (err) {
      console.error('Failed to send subscription to server:', err);
    }
  }

  async function deleteSubscriptionFromServer() {
    console.log('Subscription removed locally');
  }

  async function requestNotificationPermission() {
    if (!isPWASupported()) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  function getNotificationPermission() {
    return Notification.permission;
  }

  // ---------------------------------------------------------------------------
  // Install prompt (dipakai tombol install di landing & portal)
  // ---------------------------------------------------------------------------

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPrompt = e;
    emit('pwa-installable', { available: true });
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'block';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.deferredPrompt = null;
    emit('pwa-installed', {});
    hideInstallButton();
  });

  function showInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'block';
  }

  async function installPWA() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      window.deferredPrompt = null;
      hideInstallButton();
      return true;
    }
    return false;
  }

  function hideInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
  }

  function canInstall() {
    return !!deferredPrompt;
  }

  // ---------------------------------------------------------------------------
  // Helper
  // ---------------------------------------------------------------------------

  function getAuthToken() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'gehc_session') return value;
    }
    return null;
  }

  function arrayBufferToBase64(buffer) {
    if (!buffer) return '';
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.PWA = {
    register: registerSW,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    getSubscription,
    requestPermission: requestNotificationPermission,
    getPermission: getNotificationPermission,
    install: installPWA,
    canInstall,
    isInstalled: isStandalone,
    isSupported: isPWASupported,
    checkForUpdate,
    applyUpdate,
    hardReload,
    BUILD_ID,
    VAPID_PUBLIC_KEY,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSW);
  } else {
    registerSW();
  }
})();
