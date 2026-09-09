import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import { lifecycleAction, todayWibKey } from '../lib/event-lifecycle.mjs';

/**
 * Cron harian: PLANNING/ACTIVE yang eventDate-nya lewat (WIB) → DONE;
 * DONE lebih dari 7 hari → ARCHIVED + notifikasi Komisi.
 *
 * Auth: Bearer CRON_SECRET (Vercel Cron otomatis) atau sesi Komisi/Superadmin
 * (pemicu manual dari portal).
 */
export function registerEventLifecycleRoutes(app, { wrap }) {
  const handler = wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const cronSecret = process.env.CRON_SECRET || '';
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const viaCron = cronSecret && bearer === cronSecret;
    if (!viaCron) {
      if (!req.authUser || !isKomisiOrSuperadmin(req.authUser)) {
        return res.status(403).json({ error: 'Butuh CRON_SECRET atau peran Komisi.' });
      }
    }

    const rows = await prisma.eventProgram.findMany({
      where: {
        status: { in: ['PLANNING', 'ACTIVE', 'DONE'] },
        eventDate: { not: null },
      },
      select: { id: true, name: true, status: true, eventDate: true },
    });

    const done = [];
    const archived = [];
    for (const ev of rows) {
      const action = lifecycleAction(ev);
      if (action === 'done') {
        await prisma.eventProgram.update({ where: { id: ev.id }, data: { status: 'DONE' } }).catch(() => null);
        done.push(ev.name);
      } else if (action === 'archive') {
        await prisma.eventProgram.update({ where: { id: ev.id }, data: { status: 'ARCHIVED' } }).catch(() => null);
        archived.push({ id: ev.id, name: ev.name });
      }
    }

    let notified = 0;
    if (archived.length) {
      try {
        const holders = await prisma.userRole.findMany({
          where: { role: { in: ['KOMISI', 'SUPERADMIN'] } },
          select: { userId: true },
          take: 100,
        });
        const recipients = [...new Set(holders.map((h) => h.userId).filter(Boolean))];
        if (recipients.length) {
          const data = [];
          for (const ev of archived) {
            for (const userId of recipients) {
              data.push({
                id: `ntf-${crypto.randomUUID()}`,
                type: 'EVENT_ARCHIVED',
                memberId: userId,
                title: `Event diarsipkan: ${ev.name}`,
                message: 'Selesai >7 hari — otomatis diarsip. Dokumentasi via draf Warta.',
                payload: { eventId: ev.id },
                status: 'OPEN',
              });
            }
          }
          await prisma.notification.createMany({ data });
          notified = recipients.length;
        }
      } catch (e) {
        console.warn('[event-lifecycle] notifikasi EVENT_ARCHIVED gagal:', e?.message || e);
      }
    }

    let birthday = { wished: [], digested: 0 };
    try {
      const { runBirthdayWishes } = await import('./birthday.mjs');
      birthday = await runBirthdayWishes(prisma);
    } catch (e) {
      console.warn('[event-lifecycle] ucapan HUT gagal:', e?.message || e);
    }

    res.json({ ok: true, today: todayWibKey(), done, archived: archived.map((a) => a.name), notified, birthday });
  });

  app.get('/api/cron/event-lifecycle', handler);
  app.post('/api/cron/event-lifecycle', requireRole('SUPERADMIN', 'KOMISI'), handler);
}
