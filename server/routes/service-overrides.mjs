import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { listOverrides, upsertOverride, deleteOverride, OVERRIDE_CONDITIONS } from '../lib/service-overrides.mjs';
import { wibDateOnly } from '../lib/event-venue.mjs';

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

  // PUT /api/service-overrides/:date — GABUNGAN (partnerLabel) | LIBUR | ALIH (linkedEventId) | GESER (newEventDate)
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
      const newEventDate = req.body?.newEventDate || null;
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
          newEventDate,
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

  // POST /api/service-overrides/geser — pindah ibadah ke tanggal efektif.
  // Body: { from: 'YYYY-MM-DD' (slot Minggu), to: 'YYYY-MM-DD', note?, dryRun? }
  // dryRun=true → preview baris terdampak tanpa menulis. apply → override GESER +
  // pindah servingAssignment + eventProgram serving. Session/check-in/Drive ikut eventId.
  app.post(
    '/api/service-overrides/geser',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const from = toISODate(req.body?.from);
      const to = toISODate(req.body?.to);
      // Aman secara default: preview dulu; apply hanya bila dryRun:false eksplisit.
      const dryRun = req.body?.dryRun !== false;
      if (!from) return res.status(400).json({ error: 'from wajib (YYYY-MM-DD).' });
      if (!to) return res.status(400).json({ error: 'to wajib (YYYY-MM-DD, tanggal efektif).' });
      if (from === to) return res.status(400).json({ error: 'Tanggal geser harus berbeda dari tanggal asal.' });

      const dayRange = (iso) => {
        const day = new Date(`${iso}T00:00:00.000Z`);
        return { gte: new Date(day.getTime() - 24 * 3600 * 1000), lt: new Date(day.getTime() + 2 * 24 * 3600 * 1000) };
      };
      const onDay = async (iso) => {
        const r = dayRange(iso);
        const [assignments, events] = await Promise.all([
          prisma.servingAssignment.findMany({
            where: { eventDate: { gte: r.gte, lt: r.lt } },
            include: {
              responsibleGroup: { select: { id: true, name: true } },
              hostGroup: { select: { id: true, name: true } },
            },
          }).catch(() => []),
          prisma.eventProgram.findMany({
            where: { eventDate: { gte: r.gte, lt: r.lt } },
            select: { id: true, name: true, serviceType: true, eventDate: true, status: true },
          }).catch(() => []),
        ]);
        return {
          assignments: assignments.filter((a) => wibDateOnly(a.eventDate) === iso),
          events: events.filter((e) => wibDateOnly(e.eventDate) === iso),
        };
      };

      const src = await onDay(from);
      const dst = await onDay(to);
      const movingEvents = src.events.filter((e) => ['SERVING_DAY', 'MENTORING_DAY'].includes(String(e.serviceType || '').toUpperCase()));
      let sessionCount = 0;
      if (movingEvents.length) {
        sessionCount = await prisma.worshipSession.count({ where: { eventId: { in: movingEvents.map((e) => e.id) } } }).catch(() => 0);
      }
      const collisions = [
        ...dst.assignments.map((a) => ({ kind: 'assignment', id: a.id })),
        ...dst.events.map((e) => ({ kind: 'event', id: e.id, name: e.name })),
      ];
      const preview = {
        from,
        to,
        assignments: src.assignments.map((a) => ({
          id: a.id,
          cycleIndex: a.cycleIndex,
          responsible: a.responsibleGroup?.name || null,
          host: a.hostGroup?.name || null,
        })),
        events: movingEvents.map((e) => ({ id: e.id, name: e.name, serviceType: e.serviceType, status: e.status })),
        otherEventsOnDay: src.events.filter((e) => !movingEvents.some((m) => m.id === e.id)).map((e) => ({ id: e.id, name: e.name })),
        worshipSessionsFollow: sessionCount,
        collisions,
        driveNote: 'Folder Drive berbasis nama+slug — tidak perlu rename; QR/WA/check-in ikut eventId.',
      };
      if (collisions.length) {
        return res.status(409).json({ error: `Tanggal ${to} sudah terisi (${collisions.length} baris) — pilih tanggal lain atau kosongkan dulu.`, preview });
      }
      if (!src.assignments.length && !movingEvents.length) {
        return res.status(404).json({ error: `Tidak ada jadwal/event serving pada ${from}.`, preview });
      }
      if (dryRun) {
        return res.json({ ok: true, dryRun: true, preview });
      }

      const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
      await upsertOverride(prisma, {
        eventDate: from,
        condition: 'GESER',
        note,
        newEventDate: to,
        createdById: req.authUser?.id || null,
      });
      const target = new Date(`${to}T00:00:00.000Z`);
      let movedAssignments = 0;
      let movedEvents = 0;
      for (const a of src.assignments) {
        await prisma.servingAssignment.update({ where: { id: a.id }, data: { eventDate: target } }).catch(() => null);
        movedAssignments += 1;
      }
      for (const e of movingEvents) {
        await prisma.eventProgram.update({ where: { id: e.id }, data: { eventDate: target } }).catch(() => null);
        movedEvents += 1;
      }
      res.json({ ok: true, dryRun: false, preview, moved: { assignments: movedAssignments, events: movedEvents } });
    }),
  );
}
