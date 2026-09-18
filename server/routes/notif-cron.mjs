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
 * Pengingat Doa Minggu — hanya pada Sabtu (WIB) agar pendoa menyiapkan daftar
 * sebelum ibadah. Tanpa detail sensitif: hanya jumlah konteks.
 */
export async function runPrayerReminder(prisma, now = new Date()) {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  if (wibNow.getUTCDay() !== 6) return { skipped: true, reason: 'bukan Sabtu WIB' };

  const open = await prisma.pastoralCareNote.count({ where: { status: 'OPEN' } }).catch(() => 0);
  if (!open) return { skipped: true, reason: 'tidak ada konteks doa aktif', open: 0 };

  const weekStart = new Date(now.getTime() - 6 * 86400000);
  const prayedThisWeek = await prisma.pastoralPrayerLog
    .findMany({ where: { prayedOn: { gte: weekStart } }, select: { noteId: true }, distinct: ['noteId'] })
    .then((rows) => rows.length)
    .catch(() => 0);
  const notPrayed = Math.max(0, open - prayedThisWeek);

  const emails = new Set();
  const strukur = await prisma.strukturMember
    .findMany({
      where: {
        OR: [
          { division: { equals: 'LITURGIA' } },
          { division: { equals: 'DIAKONIA' } },
        ],
      },
      select: { email: true },
    })
    .catch(() => []);
  for (const s of strukur) if (s.email) emails.add(String(s.email).toLowerCase());
  const komisi = await prisma.userRole
    .findMany({ where: { role: { in: ['KOMISI', 'SUPERADMIN'] } }, select: { user: { select: { email: true } } } })
    .catch(() => []);
  for (const k of komisi) if (k.user?.email) emails.add(String(k.user.email).toLowerCase());

  const mentors = await prisma.groupMember
    .findMany({
      where: { status: 'ACTIVE', familyRole: { in: ['MENTOR', 'COMENTOR'] } },
      select: { user: { select: { email: true } } },
    })
    .catch(() => []);
  for (const m of mentors) if (m.user?.email) emails.add(String(m.user.email).toLowerCase());

  if (!emails.size) return { skipped: true, reason: 'tidak ada penerima', open };

  const users = await prisma.user.findMany({
    where: { email: { in: [...emails] }, accountStatus: 'ACTIVE' },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (!userIds.length) return { skipped: true, reason: 'tidak ada penerima aktif', open };

  const title = 'Pengingat Doa Minggu';
  const message = `${open} konteks doa aktif${notPrayed ? `, ${notPrayed} belum didoakan` : ''}. Siapkan daftar untuk ibadah besok.`;
  let pushed = 0;
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    await prisma.notification.createMany({
      data: chunk.map((userId) => ({
        id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'IDLE_FLAG',
        memberId: userId,
        title,
        message,
        payload: { href: '/#/portal/superadmin/pastoral-care', category: 'pengingat', priority: 'INFO' },
        category: 'pengingat',
        status: 'OPEN',
      })),
    }).catch(() => {});
    pushed += await pushToUsers(prisma, chunk, {
      title,
      message,
      href: '/#/portal/superadmin/pastoral-care',
      category: 'pengingat',
      priority: 'INFO',
    });
  }
  return { open, notPrayed, recipients: userIds.length, pushed };
}

/**
 * Pengingat Kamis: komponen penatalayan ibadah Minggu depan yang belum ada petugas.
 * Audiens: Komisi, COMMITTEE, BOD Tim Kerja, dan Superadmin (pihak yang boleh mengisi jadwal).
 */
export async function runPenatalayanReminder(prisma, now = new Date()) {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  if (wibNow.getUTCDay() !== 4) return { skipped: true, reason: 'bukan Kamis WIB' };

  const today = wibNow.toISOString().slice(0, 10);
  const t = Date.parse(`${today}T00:00:00Z`);
  const dow = new Date(t).getUTCDay();
  const sunday = new Date(t + (dow === 0 ? 0 : 7 - dow) * 86400000).toISOString().slice(0, 10);
  const sundayDate = new Date(`${sunday}T00:00:00.000Z`);

  const [roles, filled] = await Promise.all([
    prisma.serviceRole.findMany({ where: { isActive: true }, select: { id: true, name: true } }).catch(() => []),
    prisma.serviceSchedule
      .findMany({ where: { date: sundayDate, status: { not: 'CANCELLED' } }, select: { serviceRoleId: true } })
      .catch(() => []),
  ]);
  if (!roles.length) return { skipped: true, reason: 'belum ada komponen penatalayan' };
  const filledIds = new Set(filled.map((f) => f.serviceRoleId));
  const missing = roles.filter((r) => !filledIds.has(r.id));
  if (!missing.length) return { skipped: true, reason: 'semua komponen sudah terisi', total: roles.length };

  const users = await prisma.userRole
    .findMany({
      where: { role: { in: ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'] } },
      select: { userId: true, user: { select: { id: true, accountStatus: true } } },
    })
    .catch(() => []);
  const userIds = [...new Set(users
    .map((u) => u.userId || u.user?.id)
    .filter(Boolean))]
    .filter((id) => users.some((u) => (u.userId || u.user?.id) === id && u.user?.accountStatus === 'ACTIVE'));
  if (!userIds.length) return { skipped: true, reason: 'tidak ada penerima', missing: missing.length };

  const title = 'Pengingat penatalayan ibadah';
  const message = `${missing.length} komponen Minggu ${sunday} belum ada petugas: ${missing.slice(0, 4).map((r) => r.name).join(', ')}${missing.length > 4 ? ', …' : ''}`;
  let pushed = 0;
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    await prisma.notification.createMany({
      data: chunk.map((userId) => ({
        id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'IDLE_FLAG',
        memberId: userId,
        title,
        message,
        payload: { href: '/#/portal', category: 'penatalayan', priority: 'TASK' },
        category: 'penatalayan',
        status: 'OPEN',
      })),
    }).catch(() => {});
    pushed += await pushToUsers(prisma, chunk, {
      title,
      message,
      href: '/#/portal',
      category: 'penatalayan',
      priority: 'TASK',
    });
  }
  return { sunday, total: roles.length, missing: missing.length, recipients: userIds.length, pushed };
}

/**
 * Cron notifikasi (rencana Hobby: maksimum 2 cron/hari):
 * - /api/cron/notif-daily — dispatch pengumuman terjadwal + pengingat H-1 + pengingat Doa Minggu (Sabtu).
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
    const prayerResult = await runPrayerReminder(prisma).catch(() => ({ skipped: true }));
    const penatalayanResult = await runPenatalayanReminder(prisma).catch(() => ({ skipped: true }));
    res.json({
      ok: true,
      dispatch: dispatchResult,
      reminders: reminderResult,
      prayer: prayerResult,
      penatalayan: penatalayanResult,
    });
  });

  app.get('/api/cron/notif-daily', daily);
  app.post('/api/cron/notif-daily', daily);
  app.get('/api/cron/notif-dispatch', dispatch);
  app.post('/api/cron/notif-dispatch', dispatch);
  app.get('/api/cron/reminders', reminders);
  app.post('/api/cron/reminders', reminders);
}
