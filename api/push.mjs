import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole, attachUser } from '../server/auth.mjs';
import { sendPushNotification, broadcastPushNotification, notifyNewWarta, notifyNewGallery, notifyNewSchedule, notifyOrderUpdate } from '../server/push.mjs';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[push] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

// Subscribe to push
app.post('/api/paw/subscribe', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint, keys.p256dh, keys.auth wajib diisi.' });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      id: `ps-${crypto.randomUUID()}`,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: req.authUser.id,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: req.authUser.id,
    },
  });

  res.json({ ok: true });
}));

// Unsubscribe
app.delete('/api/paw/unsubscribe', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint wajib diisi.' });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.authUser.id } });
  res.json({ ok: true });
}));

// Get subscriptions
app.get('/api/paw/subscriptions', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: req.authUser.id },
    select: { endpoint: true, p256dh: true, auth: true, createdAt: true },
  });
  res.json({ subscriptions: subs });
}));

// Admin: Broadcast notification
app.post('/api/paw/broadcast', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { title, body, icon, data, targetRoles, targetUserIds } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title dan body wajib diisi.' });

  let where = {};
  if (targetUserIds && targetUserIds.length > 0) {
    where = { userId: { in: targetUserIds } };
  } else if (targetRoles && targetRoles.length > 0) {
    const usersWithRoles = await prisma.user.findMany({
      where: { roles: { some: { role: { in: targetRoles } } } },
      select: { id: true },
    });
    where = { userId: { in: usersWithRoles.map(u => u.id) } };
  } else {
    // Broadcast to all
    where = {};
  }

  const subs = await prisma.pushSubscription.findMany({ where });
  let sent = 0;
  for (const sub of subs) {
    try {
      await sendPushNotification(sub.endpoint, sub.p256dh, sub.auth, { title, body, icon, data });
      sent++;
    } catch (e) {
      console.error('Push send failed:', e.message);
    }
  }

  res.json({ ok: true, sent, total: subs.length });
}));

// Admin: Send test notification
app.post('/api/paw/test', requireRole('SUPERADMIN'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const subs = await prisma.pushSubscription.findMany({ where: { userId: req.authUser.id } });
  if (subs.length === 0) return res.status(400).json({ error: 'Tidak ada subscription untuk user ini.' });

  let sent = 0;
  for (const sub of subs) {
    try {
      await sendPushNotification(sub.endpoint, sub.p256dh, sub.auth, {
        title: 'Test Notifikasi',
        body: 'Ini adalah notifikasi tes dari GEHC portal.',
        icon: '/icons/icon-192.png',
        data: { test: true },
      });
      sent++;
    } catch (e) {
      console.error('Test push failed:', e.message);
    }
  }
  res.json({ ok: true, sent });
}));

// Notify helpers (for internal use by other modules)
app.post('/api/paw/notify/warta', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'DIDASKALIA', 'KOINONIA', 'MARTURIA'), wrap(async (req, res) => {
  const { wartaId, title, status } = req.body || {};
  if (!wartaId || !title || !status) return res.status(400).json({ error: 'wartaId, title, status wajib.' });
  await notifyNewWarta(wartaId, title, status);
  res.json({ ok: true });
}));

app.post('/api/paw/notify/gallery', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MARTURIA'), wrap(async (req, res) => {
  const { galleryId, title } = req.body || {};
  if (!galleryId || !title) return res.status(400).json({ error: 'galleryId, title wajib.' });
  await notifyNewGallery(galleryId, title);
  res.json({ ok: true });
}));

app.post('/api/paw/notify/schedule', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const { scheduleId, title, date } = req.body || {};
  if (!scheduleId || !title || !date) return res.status(400).json({ error: 'scheduleId, title, date wajib.' });
  await notifyNewSchedule(scheduleId, title, date);
  res.json({ ok: true });
}));

app.post('/api/paw/notify/order', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BENZARPR'), wrap(async (req, res) => {
  const { orderId, status } = req.body || {};
  if (!orderId || !status) return res.status(400).json({ error: 'orderId, status wajib.' });
  await notifyOrderUpdate(orderId, status);
  res.json({ ok: true });
}));

export default app;