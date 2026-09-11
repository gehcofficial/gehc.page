// Web Push via web-push lib (proper aesgcm encryption for FCM/APNs)
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAENBnhEtZU_ra0zuabyFCBXFKEx1cfqkX6VK0P96LB6o2kW8COWEO2OuX99MGOry_nV9jTlhh2fp1-UPg9UkJQVA';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgq5U7rZVcmIjw7y2DnlsXH7zeycINr0SaJHduRS0KoeOhRANCAAQ0GeES1lT-trTO5pvIUIFcUoTHVx-qRfpUrQ_3osHqjaRbwI5YQ7Y65f30wY6vL-dX2NOWGHZ-nX5Q-D1SQlBU';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:tech@gehc.demo';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn('[push] setVapidDetails failed:', e.message);
}

export async function sendPushNotification(_prisma, subscription, payload) {
  try {
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;
    if (!p256dh || !auth) {
      console.warn('[push] missing keys');
      return false;
    }
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload),
      { TTL: 86400 }
    );
    return true;
  } catch (err) {
    const status = err?.statusCode;
    console.error('[push] failed:', status, err?.body || err.message);
    if (status === 410 || status === 404) return 'expired';
    return false;
  }
}

export async function broadcastPushNotification(prisma, payload) {
  try {
    const subs = await prisma.notification.findMany({
      where: { type: 'IDLE_FLAG', title: 'Push Subscription' },
      select: { id: true, body: true, memberId: true },
    });
    const results = [];
    for (const sub of subs) {
      try {
        const subData = typeof sub.body === 'string' ? JSON.parse(sub.body) : sub.body;
        const endpoint = subData?.endpoint;
        const keys = subData?.keys;
        if (!endpoint || !keys?.p256dh || !keys?.auth) continue;
        const r = await sendPushNotification(prisma, { endpoint, keys }, payload);
        if (r === 'expired') await prisma.notification.delete({ where: { id: sub.id } }).catch(() => {});
        results.push({ userId: sub.memberId, success: !!r && r !== 'expired' });
      } catch (e) {
        results.push({ userId: sub.memberId, success: false, error: e.message });
      }
    }
    return results;
  } catch (err) {
    console.error('[push] broadcast error:', err.message);
    return [];
  }
}

export async function notifyNewWarta(prisma, warta) {
  const payload = {
    title: 'Warta Baru Tersedia',
    body: `${warta.title} - Minggu ${new Date(warta.weekDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: `warta-${warta.id}`,
    data: { type: 'warta', url: '/#/warta', wartaId: warta.id },
    actions: [{ action: 'open', title: 'Baca Warta' }, { action: 'dismiss', title: 'Nanti' }],
    requireInteraction: true,
  };
  return broadcastPushNotification(prisma, payload);
}

export async function notifyNewGallery(prisma, galleryItem) {
  const payload = {
    title: 'Foto/Video Baru di Galeri',
    body: galleryItem.title,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: galleryItem.thumbUrl || galleryItem.mediaUrl,
    tag: `gallery-${galleryItem.id}`,
    data: { type: 'gallery', url: '/#/gallery', galleryId: galleryItem.id },
    actions: [{ action: 'open', title: 'Lihat Galeri' }, { action: 'dismiss', title: 'Nanti' }],
  };
  return broadcastPushNotification(prisma, payload);
}

export async function notifyNewSchedule(prisma, schedule) {
  const userSubs = await prisma.notification.findMany({
    where: { type: 'IDLE_FLAG', title: 'Push Subscription', memberId: schedule.userId },
    select: { body: true },
  });
  if (!userSubs.length) return [];
  const payload = {
    title: 'Jadwal Penatalayan Baru',
    body: `Anda dijadwalkan sebagai ${schedule.serviceRole?.name} pada ${new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: `schedule-${schedule.id}`,
    data: { type: 'schedule', url: '/#/penatalayan', scheduleId: schedule.id },
    actions: [{ action: 'open', title: 'Lihat Jadwal' }, { action: 'dismiss', title: 'OK' }],
    requireInteraction: true,
  };
  const results = [];
  for (const sub of userSubs) {
    try {
      const subData = typeof sub.body === 'string' ? JSON.parse(sub.body) : sub.body;
      const r = await sendPushNotification(prisma, { endpoint: subData.endpoint, keys: subData.keys }, payload);
      results.push({ success: !!r && r !== 'expired' });
    } catch (e) {
      results.push({ success: false, error: e.message });
    }
  }
  return results;
}

export async function notifyOrderUpdate(prisma, order, newStatus) {
  const userSubs = await prisma.notification.findMany({
    where: { type: 'IDLE_FLAG', title: 'Push Subscription', memberId: order.userId },
    select: { body: true },
  });
  if (!userSubs.length) return [];
  const statusLabels = { PENDING: 'Menunggu', CONFIRMED: 'Dikonfirmasi', PREPARING: 'Disiapkan', READY: 'Siap Diambil', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };
  const payload = {
    title: 'Update Pesanan Toko',
    body: `Pesanan #${order.orderCode} - ${statusLabels[newStatus] || newStatus}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: `order-${order.id}`,
    data: { type: 'order', url: '/#/benzarpreneurship', orderId: order.id },
    actions: [{ action: 'open', title: 'Lihat Pesanan' }, { action: 'dismiss', title: 'OK' }],
  };
  const results = [];
  for (const sub of userSubs) {
    try {
      const subData = typeof sub.body === 'string' ? JSON.parse(sub.body) : sub.body;
      const r = await sendPushNotification(prisma, { endpoint: subData.endpoint, keys: subData.keys }, payload);
      results.push({ success: !!r && r !== 'expired' });
    } catch (e) {
      results.push({ success: false, error: e.message });
    }
  }
  return results;
}
