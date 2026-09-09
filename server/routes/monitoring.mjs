/**
 * Monitoring kelompok — persistensi TiDB (tabel monitoring_records sudah ada).
 * Sebelumnya submitMonitoringRecord hanya localStorage: laporan mentor tidak
 * terlihat Komisi/perangkat lain. Route ini menutup celah itu.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import { isMentorOfGroup } from '../lib/drive-ownership.mjs';
import { filterVisibleMonitoring, serializeMonitoring } from '../lib/monitoring.mjs';

const recId = () => `mon-${crypto.randomUUID()}`;

async function withNames(prisma, rows) {
  const groupIds = [...new Set(rows.map((r) => r.groupId).filter(Boolean))];
  const mentorIds = [...new Set(rows.map((r) => r.mentorId).filter(Boolean))];
  const [groups, mentors] = await Promise.all([
    groupIds.length
      ? prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } })
      : [],
    mentorIds.length
      ? prisma.user.findMany({ where: { id: { in: mentorIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const gMap = new Map(groups.map((g) => [g.id, g.name]));
  const mMap = new Map(mentors.map((m) => [m.id, m.name]));
  return rows.map((r) => serializeMonitoring(r, { groupName: gMap.get(r.groupId) || null, mentorName: mMap.get(r.mentorId) || null }));
}

export function registerMonitoringRoutes(app, { wrap }) {
  app.get(
    '/api/monitoring',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ records: [] });
      const rows = await prisma.monitoringRecord.findMany({
        orderBy: { date: 'desc' },
        take: 500,
      });
      const visible = filterVisibleMonitoring(req.authUser, rows, {
        admin: isKomisiOrSuperadmin(req.authUser),
      });
      res.json({ records: await withNames(prisma, visible) });
    }),
  );

  app.post(
    '/api/monitoring',
    requireRole('SUPERADMIN', 'KOMISI', 'MENTOR', 'CO_MENTOR'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const groupId = String(req.body?.group_id || req.body?.groupId || '').trim();
      const dateRaw = String(req.body?.date || '').slice(0, 10);
      const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : null;
      if (!groupId) return res.status(400).json({ error: 'Kelompok wajib.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw) || !data) {
        return res.status(400).json({ error: 'Tanggal (YYYY-MM-DD) dan isi laporan wajib.' });
      }
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) return res.status(404).json({ error: 'Kelompok tidak ditemukan.' });
      if (!isMentorOfGroup(req.authUser, groupId) && !isKomisiOrSuperadmin(req.authUser)) {
        return res.status(403).json({ error: 'Hanya mentor/co rumah ini atau Komisi.' });
      }
      const row = await prisma.monitoringRecord.create({
        data: {
          id: recId(),
          groupId,
          mentorId: req.authUser.id,
          date: new Date(`${dateRaw}T00:00:00.000Z`),
          data,
        },
      });
      const [named] = await withNames(prisma, [row]);
      res.status(201).json({ record: named });
    }),
  );

  app.delete(
    '/api/monitoring/:id',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      await prisma.monitoringRecord.delete({ where: { id: req.params.id } }).catch(() => null);
      res.json({ ok: true });
    }),
  );
}
