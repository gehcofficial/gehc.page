// Service Worker for GEHC Youth Portal PWA
// Network-first for HTML so deploys never leave iOS/Safari on a blank cached shell.

const CACHE_NAME = 'gehc-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        STATIC_ASSETS.map((url) => cache.add(url).catch(() => undefined)),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      }),
    );
    return;
  }

  // Never serve a stale index.html — hashed Vite assets 404 and iOS shows a white screen.
  if (isNavigationRequest(event.request) || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request)),
  );
});

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
    self.registration.showNotification(payload.title || 'GEHC Youth', options),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  let url = data.url || '/';

  if (action === 'dismiss') {
    return;
  }

  if (data.type === 'warta' || data.type === 'bulletin') {
    url = '/#/bulletin';
  } else if (data.type === 'gallery') {
    url = '/#/gallery';
  } else if (data.type === 'schedule') {
    url = '/#/penatalayan';
  } else if (data.type === 'order') {
    url = '/#/benzarpreneurship';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url, data });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  if (data.notificationId) {
    console.log('Notification dismissed:', data.notificationId);
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  } else if (event.tag === 'sync-gallery-upload') {
    event.waitUntil(syncGalleryUploads());
  }
});

async function syncNotifications() {
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

self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'GET_SUBSCRIPTION') {
    self.registration.pushManager.getSubscription().then((sub) => {
      event.ports[0].postMessage({ subscription: sub });
    });
  } else if (event.data.type === 'SUBSCRIBE') {
    subscribeToPush(event.data.vapidKey).then((sub) => {
      event.ports[0].postMessage({ subscription: sub });
    });
  } else if (event.data.type === 'UNSUBSCRIBE') {
    self.registration.pushManager.getSubscription().then((sub) => {
      if (sub) {
        sub.unsubscribe();
      }
      event.ports[0].postMessage({ success: true });
    });
  }
});

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

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    await fetch('/api/warta?limit=1');
  } catch (err) {
    console.error('Periodic sync failed:', err);
  }
}
