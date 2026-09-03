import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import {
  addDays,
  churchYearEntries,
  deriveSeason,
  findCollisions,
  toISODate,
  weekIndexForDate,
  yearMonthOf,
  TENANT_DEFAULT,
} from '../lib/church-year.mjs';
import { runbookTasks } from '../lib/runbook-template.mjs';

const LEVELS = ['SINODE', 'WILAYAH', 'JEMAAT', 'KOMISI', 'KOLOM'];
const SOURCES = ['LITURGICAL', 'GMIM_FIXED', 'JEMAAT'];
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

const idOf = () => `ccal-${crypto.randomUUID()}`;
const tenantOf = (req) => req.authUser?.tenantId || process.env.TENANT_ID || TENANT_DEFAULT;

/** Kolom DATE dibaca sebagai Date UTC; kirim sebagai YYYY-MM-DD saja. */
function serialize(entry) {
  return {
    id: entry.id,
    startDate: toISODate(entry.startDate),
    endDate: entry.endDate ? toISODate(entry.endDate) : null,
    allDay: entry.allDay,
    level: entry.level,
    source: entry.source,
    season: entry.season,
    name: entry.name,
    nameEn: entry.nameEn,
    scriptureRef: entry.scriptureRef,
    notes: entry.notes,
    isPublic: entry.isPublic,
    churchProgramId: entry.churchProgramId,
    churchProgram: entry.churchProgram || null,
  };
}

function parseRange(req) {
  const year = Number(req.query.year);
  if (year >= 1900 && year <= 2200) {
    return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) };
  }
  const from = isoRe.test(String(req.query.from || '')) ? new Date(`${req.query.from}T00:00:00Z`) : null;
  const to = isoRe.test(String(req.query.to || '')) ? new Date(`${req.query.to}T00:00:00Z`) : null;
  if (from && to) return { from, to };
  const now = new Date();
  const y = now.getUTCFullYear();
  return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 11, 31)) };
}

export function registerChurchCalendarRoutes(app, { wrap }) {
  /** Publik — hanya entri yang ditandai isPublic. Tanpa auth. */
  app.get(
    '/api/church-calendar/public',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ entries: [] });

      const { from, to } = parseRange(req);
      const tenantId = process.env.TENANT_ID || TENANT_DEFAULT;
      const rows = await prisma.churchCalendarEntry.findMany({
        where: { tenantId, isPublic: true, startDate: { gte: from, lte: to } },
        orderBy: { startDate: 'asc' },
        take: 200,
      });

      res.json({
        range: { from: toISODate(from), to: toISODate(to) },
        entries: rows.map((e) => ({
          id: e.id,
          startDate: toISODate(e.startDate),
          endDate: e.endDate ? toISODate(e.endDate) : null,
          name: e.name,
          nameEn: e.nameEn,
          level: e.level,
          source: e.source,
          season: e.season,
          scriptureRef: e.scriptureRef,
        })),
      });
    }),
  );

  app.get(
    '/api/church-calendar',
    requireRole('KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const { from, to } = parseRange(req);
      const rows = await prisma.churchCalendarEntry.findMany({
        where: { tenantId: tenantOf(req), startDate: { gte: from, lte: to } },
        include: { churchProgram: { select: { id: true, name: true, scope: true } } },
        orderBy: { startDate: 'asc' },
      });

      const entries = rows.map(serialize);
      res.json({
        range: { from: toISODate(from), to: toISODate(to) },
        entries,
        collisions: findCollisions(entries),
        levels: LEVELS,
        sources: SOURCES,
      });
    }),
  );

  app.post(
    '/api/church-calendar',
    requireRole('KOMISI', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const startDate = String(req.body?.startDate || '');
      const name = String(req.body?.name || '').trim();
      const level = String(req.body?.level || 'JEMAAT').toUpperCase();
      if (!isoRe.test(startDate) || !name) {
        return res.status(400).json({ error: 'startDate (YYYY-MM-DD) dan name wajib.' });
      }
      if (!LEVELS.includes(level)) return res.status(400).json({ error: 'level tidak valid.' });

      const start = new Date(`${startDate}T00:00:00Z`);
      const endDate = isoRe.test(String(req.body?.endDate || '')) ? new Date(`${req.body.endDate}T00:00:00Z`) : null;
      if (endDate && endDate < start) {
        return res.status(400).json({ error: 'endDate tidak boleh sebelum startDate.' });
      }

      const created = await prisma.churchCalendarEntry.create({
        data: {
          id: idOf(),
          tenantId: tenantOf(req),
          startDate: start,
          endDate,
          allDay: req.body?.allDay !== false,
          level,
          // Entri buatan tangan selalu JEMAAT — LITURGICAL/GMIM_FIXED milik seeder.
          source: 'JEMAAT',
          season: deriveSeason(start),
          name,
          nameEn: req.body?.nameEn || null,
          scriptureRef: req.body?.scriptureRef || null,
          notes: req.body?.notes || null,
          isPublic: req.body?.isPublic === true,
          churchProgramId: req.body?.churchProgramId || null,
          createdById: req.authUser.id,
        },
      });
      res.status(201).json({ entry: serialize(created) });
    }),
  );

  app.patch(
    '/api/church-calendar/:id',
    requireRole('KOMISI', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const existing = await prisma.churchCalendarEntry.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.tenantId !== tenantOf(req)) {
        return res.status(404).json({ error: 'Entri kalender tidak ditemukan.' });
      }

      const data = {};
      if (req.body?.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ error: 'name tidak boleh kosong.' });
        data.name = name;
      }
      if (req.body?.startDate !== undefined) {
        if (!isoRe.test(String(req.body.startDate))) return res.status(400).json({ error: 'startDate tidak valid.' });
        data.startDate = new Date(`${req.body.startDate}T00:00:00Z`);
        data.season = deriveSeason(data.startDate);
      }
      if (req.body?.endDate !== undefined) {
        data.endDate = isoRe.test(String(req.body.endDate || '')) ? new Date(`${req.body.endDate}T00:00:00Z`) : null;
      }
      if (req.body?.level !== undefined) {
        const level = String(req.body.level).toUpperCase();
        if (!LEVELS.includes(level)) return res.status(400).json({ error: 'level tidak valid.' });
        data.level = level;
      }
      if (req.body?.notes !== undefined) data.notes = req.body.notes || null;
      if (req.body?.scriptureRef !== undefined) data.scriptureRef = req.body.scriptureRef || null;
      if (req.body?.isPublic !== undefined) data.isPublic = req.body.isPublic === true;
      if (req.body?.churchProgramId !== undefined) data.churchProgramId = req.body.churchProgramId || null;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });

      const entry = await prisma.churchCalendarEntry.update({ where: { id: existing.id }, data });
      res.json({ entry: serialize(entry) });
    }),
  );

  app.delete(
    '/api/church-calendar/:id',
    requireRole('KOMISI', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const existing = await prisma.churchCalendarEntry.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.tenantId !== tenantOf(req)) {
        return res.status(404).json({ error: 'Entri kalender tidak ditemukan.' });
      }
      if (existing.source !== 'JEMAAT') {
        return res.status(409).json({
          error: 'Entri liturgis/GMIM dihasilkan seeder. Sembunyikan dari publik alih-alih menghapus.',
        });
      }
      await prisma.churchCalendarEntry.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    }),
  );

  /** Isi ulang entri terhitung untuk satu tahun tanpa menyentuh entri jemaat. */
  app.post(
    '/api/church-calendar/sync/:year',
    requireRole('KOMISI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const year = Number(req.params.year);
      if (!(year >= 1900 && year <= 2200)) return res.status(400).json({ error: 'Tahun tidak valid.' });

      const tenantId = tenantOf(req);
      const computed = churchYearEntries(year);
      const existing = await prisma.churchCalendarEntry.findMany({
        where: { tenantId, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
        select: { source: true, name: true, startDate: true },
      });
      const seen = new Set(existing.map((e) => `${e.source}|${e.name}|${toISODate(e.startDate)}`));

      const missing = computed.filter((e) => !seen.has(`${e.source}|${e.name}|${e.startDate}`));
      if (missing.length) {
        await prisma.churchCalendarEntry.createMany({
          data: missing.map((e) => ({
            id: idOf(),
            tenantId,
            startDate: new Date(`${e.startDate}T00:00:00Z`),
            allDay: true,
            level: e.level,
            source: e.source,
            season: e.season,
            name: e.name,
            nameEn: e.nameEn || null,
            isPublic: e.isPublic === true,
            createdById: req.authUser.id,
          })),
        });
      }

      res.json({ year, added: missing.length, total: computed.length });
    }),
  );

  /**
   * Terjemahkan satu entri kalender menjadi checklist runbook H-21 → H+7
   * pada MinistryMonthPlan bulan yang bersangkutan.
   */
  app.post(
    '/api/church-calendar/:id/generate-runbook',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const entry = await prisma.churchCalendarEntry.findUnique({ where: { id: req.params.id } });
      if (!entry || entry.tenantId !== tenantOf(req)) {
        return res.status(404).json({ error: 'Entri kalender tidak ditemukan.' });
      }

      const tasks = runbookTasks({ eventName: entry.name });

      // Kelompokkan per bulan — runbook H-21 bisa jatuh di bulan sebelumnya.
      const byMonth = new Map();
      for (const t of tasks) {
        const when = addDays(entry.startDate, t.offset);
        const ym = yearMonthOf(when);
        const bucket = byMonth.get(ym) || [];
        bucket.push({ ...t, weekIndex: weekIndexForDate(when) });
        byMonth.set(ym, bucket);
      }

      let created = 0;
      let skipped = 0;

      for (const [yearMonth, items] of byMonth) {
        let plan = await prisma.ministryMonthPlan.findUnique({
          where: { yearMonth },
          include: { deliverables: { select: { title: true } } },
        });
        if (!plan) {
          plan = await prisma.ministryMonthPlan.create({
            data: { id: `mplan-${crypto.randomUUID()}`, yearMonth, createdById: req.authUser.id },
          });
          plan.deliverables = [];
        }

        const existingTitles = new Set((plan.deliverables || []).map((d) => d.title));
        const fresh = items.filter((i) => !existingTitles.has(i.title));
        skipped += items.length - fresh.length;

        if (fresh.length) {
          await prisma.ministryWeekDeliverable.createMany({
            data: fresh.map((i) => ({
              id: `mdel-${crypto.randomUUID()}`,
              planId: plan.id,
              weekIndex: i.weekIndex,
              division: i.division,
              kind: i.kind,
              title: i.title,
            })),
          });
          created += fresh.length;
        }
      }

      await notifyRunbook(prisma, {
        entry,
        divisions: [...new Set(tasks.map((t) => t.division))],
        requestedById: req.authUser.id,
        created,
      });

      res.status(201).json({
        entry: serialize(entry),
        months: [...byMonth.keys()],
        created,
        skipped,
      });
    }),
  );
}

/**
 * Kabari pemegang peran di divisi yang tersentuh runbook. Kalau belum ada
 * penugasan divisi, cukup kabari yang men-generate supaya tidak membanjiri
 * lonceng semua orang.
 */
async function notifyRunbook(prisma, { entry, divisions, requestedById, created }) {
  if (!created) return;
  try {
    const holders = await prisma.roleAssignment.findMany({
      where: { isActive: true, division: { in: divisions } },
      select: { userId: true },
      take: 200,
    });
    const targets = [...new Set(holders.map((h) => h.userId))];
    const recipients = targets.length ? targets : [requestedById];

    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        id: `ntf-${crypto.randomUUID()}`,
        type: 'RUNBOOK_DUE',
        memberId: userId,
        title: `Runbook ${entry.name}`,
        message: `${created} deliverable H-21 → H+7 dibuat. Buka Program & Event → Rencana bulan.`,
        payload: {
          calendarEntryId: entry.id,
          startDate: toISODate(entry.startDate),
          divisions,
        },
        status: 'OPEN',
      })),
    });
  } catch (e) {
    console.warn('[church-calendar] notifikasi RUNBOOK_DUE gagal:', e?.message || e);
  }
}
