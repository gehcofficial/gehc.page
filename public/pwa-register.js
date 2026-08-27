// PWA Registration & Push Notification Manager
// Load this in index.html or main.tsx

(function () {
  'use strict';

  const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

  // Check PWA support
  const isPWASupported = () => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  };

  // Register service worker
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

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
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

  // Subscribe to push notifications
  async function subscribeToPush(registration) {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      await sendSubscriptionToServer(subscription);
      return subscription;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return null;
    }
  }

  // Unsubscribe from push
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

  // Get current subscription
  async function getSubscription(registration) {
    return await registration.pushManager.getSubscription();
  }

  // Send subscription to server
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

  // Delete subscription from server
  async function deleteSubscriptionFromServer(subscription) {
    // Could implement DELETE endpoint if needed
    console.log('Subscription removed locally');
  }

  // Request notification permission
  async function requestNotificationPermission() {
    if (!isPWASupported()) return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Check notification permission
  function getNotificationPermission() {
    return Notification.permission;
  }

  // Show install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
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
      hideInstallButton();
      return true;
    }
    return false;
  }

  function hideInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
  }

  // Show update available toast
  function showUpdateAvailable() {
    if (confirm('Versi baru tersedia. Muat ulang?')) {
      window.location.reload();
    }
  }

  // Helper: Get auth token from cookie
  function getAuthToken() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'gehc_session') return value;
    }
    return null;
  }

  // Helper: ArrayBuffer to base64
  function arrayBufferToBase64(buffer) {
    if (!buffer) return '';
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  // Helper: base64 to Uint8Array
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

  // Listen for messages from SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'NOTIFICATION_CLICK') {
      // Handle notification click in app
      window.dispatchEvent(new CustomEvent('pwa-notification-click', {
        detail: event.data,
      }));
    }
  });

  // Expose API globally
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

  // Auto-register on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerSW);
  } else {
    registerSW();
  }
})();