// Service Worker for GEHC Youth Portal PWA
// Handles: app-shell freshness, offline fallback, push notifications, background sync.
//
// Strategi cache (penting untuk sinkronisasi versi):
// - Navigasi/HTML  : NETWORK-ONLY. TIDAK PERNAH menyajikan index.html dari cache,
//   karena HTML lama menunjuk aset ber-hash yang sudah dihapus deploy baru →
//   aset 404 → React gagal mount → "section hilang"/layar kosong di iOS Safari.
//   Saat offline ditampilkan /offline.html statis, bukan app shell lama.
// - Aset ber-hash  : stale-while-revalidate (aman karena nama file berubah tiap build).
// - /api/*         : network-only (tidak pernah di-cache).
// BUILD_ID disuntik saat build oleh plugin vite (lihat vite.config.ts) sehingga
// byte file ini SELALU berubah tiap deploy → browser mendeteksi update SW.

const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `gehc-${BUILD_ID}`;
const PRECACHE = [
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';

// Install — precache hanya aset statis (BUKAN index.html).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined)
  );
  // Tetap ambil alih segera: user yang masih terjebak di cache lama (gehc-v3)
  // otomatis keluar dari cache basi pada navigasi berikutnya.
  self.skipWaiting();
});

// Activate — buang semua cache versi lama.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.postMessage({ type: 'SW_ACTIVATED', buildId: BUILD_ID });
    })()
  );
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

function isHashedAsset(url) {
  return /\/assets\//.test(url.pathname) || /\/icons\//.test(url.pathname);
}

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Dev: jangan pernah cache chunk Vite.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(fetch(request));
    return;
  }

  // API: network-only, fallback JSON offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'Offline', offline: true }),
        { headers: { 'Content-Type': 'application/json' }, status: 503 }
      ))
    );
    return;
  }

  // Navigasi / HTML: NETWORK-ONLY — jangan pernah menyajikan dokumen basi.
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const offline = await cache.match('/offline.html');
        if (offline) return offline;
        return new Response('Offline — sambungkan kembali lalu muat ulang.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
    );
    return;
  }

  // Aset ber-hash: stale-while-revalidate.
  if (isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || new Response('', { status: 504 });
      })()
    );
    return;
  }

  // Sisanya: network-first, fallback cache.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok && !request.url.endsWith('/sw.js')) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone()).catch(() => undefined);
        }
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('offline');
      }
    })()
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
    url = '/#/bulletin';
  } else if (data.type === 'gallery') {
    url = '/#/bulletin';
  } else if (data.type === 'schedule') {
    url = data.url || '/#/portal';
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
  const data = event.notification.data || {};
  if (data.notificationId) {
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

// Message event - communicate with main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data?.type === 'GET_BUILD_ID') {
    event.ports?.[0]?.postMessage({ buildId: BUILD_ID });
  } else if (event.data?.type === 'GET_SUBSCRIPTION') {
    self.registration.pushManager.getSubscription().then((sub) => {
      event.ports[0].postMessage({ subscription: sub });
    });
  } else if (event.data?.type === 'SUBSCRIBE') {
    subscribeToPush(event.data.vapidKey).then((sub) => {
      event.ports[0].postMessage({ subscription: sub });
    });
  } else if (event.data?.type === 'UNSUBSCRIBE') {
    self.registration.pushManager.getSubscription().then((sub) => {
      if (sub) sub.unsubscribe();
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
    const response = await fetch('/api/warta?limit=1');
    if (response.ok) {
      await response.json();
    }
  } catch (err) {
    console.error('Periodic sync failed:', err);
  }
}
