import { getPrisma } from '../db.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import { resolveAudience, sendNotification, pushToUsers } from '../lib/notify.mjs';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function authorize(req) {
  const cronSecret = process.env.CRON_SECRET || '';
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (cronSecret && bearer === cronSecret) return true;
  return Boolean(req.authUser && isKomisiOrSuperadmin(req.authUser));
}

/** Kirim pengumuman terjadwal yang sudah jatuh tempo. */
export async function runAnnouncementDispatch(prisma) {
  const due = await prisma.announcement.findMany({
    where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
    orderBy: { publishAt: 'asc' },
    take: 50,
  });
  let sent = 0;
  let recipients = 0;
  for (const ann of due) {
    const audience = {
      type: ann.audienceType,
      roles: ann.audienceRoles,
      divisions: ann.audienceDivisions,
      groupIds: ann.audienceGroupIds,
      userIds: ann.audienceUserIds,
    };
    const result = await sendNotification({
      type: 'ANNOUNCEMENT',
      category: ann.category,
      title: ann.title,
      message: ann.message || '',
      href: ann.href,
      senderRole: ann.senderRole,
      audience,
      priority: ann.priority,
      announcementId: ann.id,
    });
    await prisma.announcement.update({
      where: { id: ann.id },
      data: { status: 'SENT', sentAt: new Date(), sentCount: result.count },
    });
    sent += 1;
    recipients += result.count;
  }
  return { sent, recipients };
}

/** Pengingat H-1 (besok) ke semua pelanggan push. */
export async function runEventReminders(prisma) {
  const wibNow = new Date(Date.now() + WIB_OFFSET_MS);
  const startTomorrow = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + 1) - WIB_OFFSET_MS;
  const endTomorrow = startTomorrow + 24 * 60 * 60 * 1000;

  const events = await prisma.eventProgram.findMany({
    where: {
      eventDate: { gte: new Date(startTomorrow), lt: new Date(endTomorrow) },
      status: { in: ['PLANNING', 'ACTIVE'] },
    },
    select: { name: true },
    orderBy: { eventDate: 'asc' },
  }).catch(() => []);

  if (!events.length) return { events: 0, recipients: 0, pushed: 0 };

  const names = events.map((e) => e.name).slice(0, 6).join(', ');
  const userIds = await resolveAudience(prisma, { type: 'PUBLIC' });
  let pushed = 0;
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    await prisma.notification.createMany({
      data: chunk.map((userId) => ({
        id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'RUNBOOK_DUE',
        memberId: userId,
        title: 'Pengingat besok',
        message: `Besok: ${names}`,
        payload: { href: '/#/portal', category: 'pengingat', priority: 'INFO' },
        category: 'pengingat',
        status: 'OPEN',
      })),
    }).catch(() => {});
    pushed += await pushToUsers(prisma, chunk, {
      title: 'Pengingat besok',
      message: `Besok: ${names}`,
      href: '/#/portal',
      category: 'pengingat',
      priority: 'INFO',
    });
  }
  return { events: events.length, recipients: userIds.length, pushed };
}

/**
 * Cron notifikasi (rencana Hobby: maksimum 2 cron/hari):
 * - /api/cron/notif-daily — dispatch pengumuman terjadwal + pengingat H-1.
 * - /api/cron/notif-dispatch, /api/cron/reminders — pemanggilan manual per bagian.
 * Auth: Bearer CRON_SECRET (Vercel Cron) atau sesi Komisi/Superadmin.
 */
export function registerNotifCronRoutes(app, { wrap }) {
  const dispatch = wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!authorize(req)) return res.status(403).json({ error: 'Butuh CRON_SECRET atau peran Komisi.' });
    const r = await runAnnouncementDispatch(prisma);
    res.json({ ok: true, dispatch: r.sent, recipients: r.recipients });
  });

  const reminders = wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!authorize(req)) return res.status(403).json({ error: 'Butuh CRON_SECRET atau peran Komisi.' });
    const r = await runEventReminders(prisma);
    res.json({ ok: true, ...r });
  });

  const daily = wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!authorize(req)) return res.status(403).json({ error: 'Butuh CRON_SECRET atau peran Komisi.' });
    const dispatchResult = await runAnnouncementDispatch(prisma);
    const reminderResult = await runEventReminders(prisma);
    res.json({ ok: true, dispatch: dispatchResult, reminders: reminderResult });
  });

  app.get('/api/cron/notif-daily', daily);
  app.post('/api/cron/notif-daily', daily);
  app.get('/api/cron/notif-dispatch', dispatch);
  app.post('/api/cron/notif-dispatch', dispatch);
  app.get('/api/cron/reminders', reminders);
  app.post('/api/cron/reminders', reminders);
}
