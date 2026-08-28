// Service Worker for GEHC Youth Portal PWA
// Handles: caching, push notifications, background sync, offline support

const CACHE_NAME = 'gehc-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // In development (localhost), always go to network — never cache Vite chunks
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Skip API calls - let them go to network
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return offline response for API calls
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      })
    );
    return;
  }

  // For static assets: cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'GEHC', body: event.data.text() };
  }

  const options = {
    body: payload.body || payload.message || 'Ada notifikasi baru',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: payload.image,
    data: payload.data || {},
    tag: payload.tag || 'gehc-notification',
    renotify: true,
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || [
      { action: 'open', title: 'Buka' },
      { action: 'dismiss', title: 'Tutup' },
    ],
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'GEHC Youth', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  let url = data.url || '/';

  if (action === 'dismiss') {
    return;
  }

  // Handle different notification types
  if (data.type === 'warta') {
    url = '/#/warta';
  } else if (data.type === 'gallery') {
    url = '/#/gallery';
  } else if (data.type === 'schedule') {
    url = '/#/penatalayan';
  } else if (data.type === 'order') {
    url = '/#/benzarpreneurship';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url, data });
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  // Track dismissal analytics if needed
  const data = event.notification.data || {};
  if (data.notificationId) {
    // Could send analytics here
    console.log('Notification dismissed:', data.notificationId);
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  } else if (event.tag === 'sync-gallery-upload') {
    event.waitUntil(syncGalleryUploads());
  }
});

async function syncNotifications() {
  // Sync pending notification subscriptions
  try {
    const cache = await caches.open('gehc-offline');
    const requests = await cache.keys();
    for (const request of requests) {
      if (request.url.includes('/api/paw/subscribe')) {
        await fetch(request);
        await cache.delete(request);
      }
    }
  } catch (err) {
    console.error('Sync notifications failed:', err);
  }
}

async function syncGalleryUploads() {
  // Sync pending gallery uploads
  try {
    const cache = await caches.open('gehc-offline');
    const requests = await cache.keys();
    for (const request of requests) {
      if (request.url.includes('/api/gallery')) {
        await fetch(request);
        await cache.delete(request);
      }
    }
  } catch (err) {
    console.error('Sync gallery uploads failed:', err);
  }
}

// Message event - communicate with main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'GET_SUBSCRIPTION') {
    // Return current push subscription
    self.registration.pushManager.getSubscription().then((sub) => {
      event.ports[0].postMessage({ subscription: sub });
    });
  } else if (event.data.type === 'SUBSCRIBE') {
    // Subscribe to push
    subscribeToPush(event.data.vapidKey).then((sub) => {
      event.ports[0].postMessage({ subscription: sub });
    });
  } else if (event.data.type === 'UNSUBSCRIBE') {
    // Unsubscribe from push
    self.registration.pushManager.getSubscription().then((sub) => {
      if (sub) {
        sub.unsubscribe();
      }
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Helper: Subscribe to push
async function subscribeToPush(vapidKey) {
  try {
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey || VAPID_PUBLIC_KEY),
    });
    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

// Helper: Convert base64 to Uint8Array
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

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    // Check for new warta, gallery items, etc.
    const response = await fetch('/api/warta?limit=1');
    if (response.ok) {
      const data = await response.json();
      // Could show badge notification if new content
    }
  } catch (err) {
    console.error('Periodic sync failed:', err);
  }
}