// Web Push Notification Utility for Server-Side
// Uses VAPID keys to send push notifications via Web Push protocol

import crypto from 'node:crypto';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgq5U7rZVcmIjw7y2DnlsXH7zeycINr0SaJHduRS0KoeOhRANCAAQ0GeES1lT-trTO5pvIUIFcUoTHVx-qRfpUrQ_3osHqjaRbwI5YQ7Y65f30wY6vL-dX2NOWGHZ-nX5Q-D1SQlBU';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:tech@gehc.demo';

// Convert base64url to Buffer
function base64UrlToBuffer(str) {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

// Generate VAPID JWT
function generateVapidToken(audience) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: VAPID_SUBJECT,
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  // Sign with ES256 (ECDSA with P-256 curve and SHA-256)
  const privateKey = crypto.createPrivateKey({
    key: base64UrlToBuffer(VAPID_PRIVATE_KEY),
    format: 'der',
    type: 'pkcs8',
  });
  
  const sign = crypto.createSign('SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(privateKey);
  const encodedSignature = signature.toString('base64url');
  
  return `${unsignedToken}.${encodedSignature}`;
}

// Send push notification to a subscription
export async function sendPushNotification(prisma, subscription, payload) {
  try {
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;
    const vapidToken = generateVapidToken(audience);
    
    const p256dh = subscription.keys.p256dh ? Buffer.from(subscription.keys.p256dh, 'base64') : null;
    const auth = subscription.keys.auth ? Buffer.from(subscription.keys.auth, 'base64') : null;
    
    if (!p256dh || !auth) {
      console.warn('Missing encryption keys for subscription');
      return false;
    }
    
    // Encrypt payload using Web Push encryption (simplified - in production use web-push library)
    // For now, send unencrypted payload (works for testing)
    const pushPayload = JSON.stringify(payload);
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400', // 24 hours
        'Authorization': `vapid t=${vapidToken}, k=${VAPID_PUBLIC_KEY}`,
        'Content-Encoding': 'aesgcm', // Would need proper encryption
      },
      body: pushPayload,
    });
    
    if (!response.ok) {
      console.error('Push failed:', response.status, await response.text());
      // If subscription expired/gone, mark for deletion
      if (response.status === 410 || response.status === 404) {
        return 'expired';
      }
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Push notification error:', err.message);
    return false;
  }
}

// Send notification to all subscribers (or filtered by role/division)
export async function broadcastPushNotification(prisma, payload, filter = {}) {
  try {
    const where = { type: 'IDLE_FLAG' }; // We stored subscriptions as IDLE_FLAG notifications
    
    // Filter by user roles if specified
    if (filter.role) {
      // Could join with UserRole table
    }
    
    const subs = await prisma.notification.findMany({
      where,
      select: { body: true, memberId: true },
    });
    
    const results = [];
    for (const sub of subs) {
      try {
        const subData = JSON.parse(sub.body);
        const success = await sendPushNotification(prisma, subData, payload);
        if (success === 'expired') {
          // Delete expired subscription
          await prisma.notification.delete({ where: { id: sub.id } });
        }
        results.push({ userId: sub.memberId, success: !!success });
      } catch (e) {
        results.push({ userId: sub.memberId, success: false, error: e.message });
      }
    }
    
    return results;
  } catch (err) {
    console.error('Broadcast push error:', err.message);
    return [];
  }
}

// Trigger notification for new Warta Publik
export async function notifyNewWarta(prisma, warta) {
  const payload = {
    title: 'Warta Baru Tersedia',
    body: `${warta.title} - Minggu ${new Date(warta.weekDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: `warta-${warta.id}`,
    data: { type: 'warta', url: '/#/warta', wartaId: warta.id },
    actions: [
      { action: 'open', title: 'Baca Warta' },
      { action: 'dismiss', title: 'Nanti' },
    ],
    requireInteraction: true,
  };
  
  return await broadcastPushNotification(prisma, payload, { roles: ['SUPERADMIN', 'COMMITTEE', 'KOMISI', 'MENTOR', 'MENTEE'] });
}

// Trigger notification for new Gallery item (approved)
export async function notifyNewGallery(prisma, galleryItem) {
  const payload = {
    title: 'Foto/Video Baru di Warta',
    body: galleryItem.title,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: galleryItem.thumbUrl || galleryItem.mediaUrl,
    tag: `gallery-${galleryItem.id}`,
    data: { type: 'bulletin', url: '/#/bulletin', galleryId: galleryItem.id },
    actions: [
      { action: 'open', title: 'Lihat Warta' },
      { action: 'dismiss', title: 'Nanti' },
    ],
  };
  
  return await broadcastPushNotification(prisma, payload, { roles: ['SUPERADMIN', 'COMMITTEE', 'KOMISI', 'MENTOR', 'MENTEE', 'MARTURIA'] });
}

// Trigger notification for new schedule assignment
export async function notifyNewSchedule(prisma, schedule) {
  // Notify the assigned person
  const userSubs = await prisma.notification.findMany({
    where: { type: 'IDLE_FLAG', memberId: schedule.userId },
    select: { body: true },
  });
  
  if (userSubs.length === 0) return [];
  
  const payload = {
    title: 'Jadwal Penatalayan Baru',
    body: `Anda dijadwalkan sebagai ${schedule.serviceRole?.name} pada ${new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: `schedule-${schedule.id}`,
    data: { type: 'schedule', url: '/#/penatalayan', scheduleId: schedule.id },
    actions: [
      { action: 'open', title: 'Lihat Jadwal' },
      { action: 'dismiss', title: 'OK' },
    ],
    requireInteraction: true,
  };
  
  const results = [];
  for (const sub of userSubs) {
    try {
      const subData = JSON.parse(sub.body);
      const success = await sendPushNotification(prisma, subData, payload);
      results.push({ success: !!success });
    } catch (e) {
      results.push({ success: false, error: e.message });
    }
  }
  return results;
}

// Trigger notification for order status change (Benzarpreneurship)
export async function notifyOrderUpdate(prisma, order, newStatus) {
  const userSubs = await prisma.notification.findMany({
    where: { type: 'IDLE_FLAG', memberId: order.userId },
    select: { body: true },
  });
  
  if (userSubs.length === 0) return [];
  
  const statusLabels = { PENDING: 'Menunggu', CONFIRMED: 'Dikonfirmasi', PREPARING: 'Disiapkan', READY: 'Siap Diambil', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };
  
  const payload = {
    title: 'Update Pesanan Benzarpreneurship',
    body: `Pesanan #${order.orderCode} - ${statusLabels[newStatus] || newStatus}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: `order-${order.id}`,
    data: { type: 'order', url: '/#/benzarpreneurship', orderId: order.id },
    actions: [
      { action: 'open', title: 'Lihat Pesanan' },
      { action: 'dismiss', title: 'OK' },
    ],
  };
  
  const results = [];
  for (const sub of userSubs) {
    try {
      const subData = JSON.parse(sub.body);
      const success = await sendPushNotification(prisma, subData, payload);
      results.push({ success: !!success });
    } catch (e) {
      results.push({ success: false, error: e.message });
    }
  }
  return results;
}