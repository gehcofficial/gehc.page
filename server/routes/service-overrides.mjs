import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { listOverrides, upsertOverride, deleteOverride, OVERRIDE_CONDITIONS } from '../lib/service-overrides.mjs';

function toISODate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function registerServiceOverrideRoutes(app, { wrap }) {
  // GET /api/service-overrides?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get(
    '/api/service-overrides',
    requireRole('KOMISI', 'COMMITTEE', 'SUPERADMIN', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const from = toISODate(req.query?.from) || '2000-01-01';
      const to = toISODate(req.query?.to) || '2100-12-31';
      const map = await listOverrides(prisma, from, to);
      res.json({
        overrides: [...map.entries()].map(([eventDate, o]) => ({ eventDate, ...o })),
        conditions: OVERRIDE_CONDITIONS,
      });
    }),
  );

  // PUT /api/service-overrides/:date — GABUNGAN (partnerLabel) | LIBUR | ALIH (linkedEventId)
  app.put(
    '/api/service-overrides/:date',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const iso = toISODate(req.params.date);
      if (!iso) return res.status(400).json({ error: 'Tanggal tidak valid (YYYY-MM-DD).' });
      const condition = String(req.body?.condition || '').toUpperCase();
      const linkedEventId = req.body?.linkedEventId || null;
      if (condition === 'ALIH' && linkedEventId) {
        const ev = await prisma.eventProgram.findUnique({ where: { id: linkedEventId }, select: { id: true } }).catch(() => null);
        if (!ev) return res.status(404).json({ error: 'Event alihan tidak ditemukan.' });
      }
      try {
        const saved = await upsertOverride(prisma, {
          eventDate: iso,
          condition,
          note: req.body?.note ?? null,
          partnerLabel: req.body?.partnerLabel ?? null,
          linkedEventId,
          createdById: req.authUser?.id || null,
        });
        res.json({ ok: true, override: saved });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    }),
  );

  // DELETE /api/service-overrides/:date — kembali NORMAL
  app.delete(
    '/api/service-overrides/:date',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        res.json({ ok: true, ...(await deleteOverride(prisma, req.params.date)) });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    }),
  );
}
