// PWA Registration & Push Notification Manager
// Load this in index.html or main.tsx

(function () {
  'use strict';

  const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

  const isPWASupported = () => 'serviceWorker' in navigator;

  async function registerSW() {
    if (!isPWASupported()) {
      console.log('PWA not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('SW registered:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateAvailable();
          }
        });
      });

      return registration;
    } catch (err) {
      console.error('SW registration failed:', err);
      return null;
    }
  }

  async function subscribeToPush(registration) {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
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
    return await registration.pushManager.getSubscription();
  }

  async function sendSubscriptionToServer(subscription) {
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      await fetch('/api/paw/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  async function deleteSubscriptionFromServer(subscription) {
    console.log('Subscription removed locally', subscription && subscription.endpoint);
  }

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  function getNotificationPermission() {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPrompt = e;
    showInstallButton();
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

  function showUpdateAvailable() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }

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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        window.dispatchEvent(new CustomEvent('pwa-notification-click', {
          detail: event.data,
        }));
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.__gehcSwRefreshing) return;
      window.__gehcSwRefreshing = true;
      window.location.reload();
    });
  }

  window.PWA = {
    register: registerSW,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    getSubscription,
    requestPermission: requestNotificationPermission,
    getPermission: getNotificationPermission,
    install: installPWA,
    isSupported: isPWASupported,
    VAPID_PUBLIC_KEY,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSW);
  } else {
    registerSW();
  }
})();
