import { requirePlatformRoot } from '../lib/platform-rbac.mjs';
import { getPrisma } from '../db.mjs';

/** Admin utility routes — SUPERADMIN only. */
export function registerAdminRoutes(app, { wrap }) {
  app.post('/api/admin/clean-staging', requirePlatformRoot(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const demoPattern = '%@gehc.demo%';
    const removed = { attendanceRecords: 0, waitlistEntries: 0 };

    try {
      removed.attendanceRecords = await prisma.$executeRawUnsafe(
        "DELETE FROM `attendance_records` WHERE `user_id` NOT IN (SELECT `id` FROM `users` WHERE `email` LIKE ?)",
        demoPattern
      );
    } catch { /* skip */ }

    try {
      removed.waitlistEntries = await prisma.$executeRawUnsafe(
        "DELETE FROM `waitlist_entries` WHERE `email` NOT LIKE ?",
        demoPattern
      );
    } catch { /* skip */ }

    res.json({ ok: true, removed });
  }));
}
