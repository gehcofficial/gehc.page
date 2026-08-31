import { requireRole } from '../auth.mjs';
import { getPrisma } from '../db.mjs';
import { KOMISION_CORE } from '../lib/rbac-constants.mjs';
import { syncWaitingPoolFromUser, ensureWaitingPoolForNewPemuda } from '../onboarding-sync.mjs';

/** Waiting pool & pending-approval routes */
export function registerOnboardingRoutes(app, { wrap }) {
  app.get('/api/waiting-pool', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const status = req.query.status ? String(req.query.status) : 'WAITING_POOL';
    const sourceEvent = req.query.sourceEvent ? String(req.query.sourceEvent) : undefined;
    const domicileKind = req.query.domicileKind ? String(req.query.domicileKind) : undefined;
    const includeUser = status === 'ROLE_ASSIGNED' || status === 'REGISTERED';

    const where = { status };
    if (sourceEvent) where.sourceEvent = sourceEvent;
    if (domicileKind) where.domicileKind = domicileKind;
    const pool = await prisma.waitingPool.findMany({
      where,
      orderBy: status === 'ROLE_ASSIGNED' ? { profileCompletedAt: 'desc' } : { registeredAt: 'desc' },
      include: includeUser
        ? {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                roles: { select: { role: true, groupId: true, tenantId: true } },
              },
            },
          }
        : undefined,
    });
    res.json({ pool });
  }));

  app.post('/api/waiting-pool', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const { userId, sourceEvent } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId wajib.' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const entry = await ensureWaitingPoolForNewPemuda(userId, { sourceEvent: sourceEvent || 'Manual add' });
    const synced = await syncWaitingPoolFromUser(userId);
    res.json({ ok: true, entry: synced || entry });
  }));

  app.get('/api/pending-approval', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const pending = await prisma.waitingPool.findMany({
      where: { status: 'PROFILE_COMPLETED' },
      orderBy: { profileCompletedAt: 'desc' },
    });
    res.json({ pending });
  }));

  app.post('/api/waiting-pool/:id/reminder', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const entry = await prisma.waitingPool.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'Entry tidak ditemukan.' });

    const updated = await prisma.waitingPool.update({
      where: { id: req.params.id },
      data: {
        lastReminder: new Date(),
        reminderCount: { increment: 1 },
      },
    });

    res.json({ ok: true, entry: updated, message: 'Reminder terkirim (placeholder).' });
  }));

  app.post('/api/waiting-pool/reset-status', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array wajib.' });
    }

    const updated = await prisma.waitingPool.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'PROFILE_COMPLETED',
        profileCompletedAt: new Date(),
      },
    });

    res.json({ ok: true, updated: updated.count });
  }));

  app.post('/api/waiting-pool/clear-role-assigned', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const updated = await prisma.waitingPool.updateMany({
      where: { status: 'ROLE_ASSIGNED' },
      data: {
        status: 'PROFILE_COMPLETED',
        profileCompletedAt: new Date(),
      },
    });

    res.json({ ok: true, updated: updated.count });
  }));
}
