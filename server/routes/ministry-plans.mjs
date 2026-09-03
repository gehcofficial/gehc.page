import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { sundaysInMonth, toISODate } from '../lib/church-year.mjs';

const DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
const KINDS = ['MODULE', 'RUNDOWN', 'BENZUAR', 'BENZINEMA', 'LOGISTICS', 'DOCS', 'CASHIER'];
const STATUSES = ['TODO', 'DOING', 'DONE', 'BLOCKED'];
const ymRe = /^\d{4}-\d{2}$/;
const idPlan = () => `mplan-${crypto.randomUUID()}`;
const idDel = () => `mdel-${crypto.randomUUID()}`;

/**
 * Satu baris per hari Minggu sebenarnya — bulan bisa punya 4 atau 5 minggu,
 * jadi grid tidak lagi dipaku ke empat baris tanggal 7/14/21/28.
 */
function defaultWeeks(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return sundaysInMonth(y, m).map((sunday, i) => ({
    index: i + 1,
    date: toISODate(sunday),
    theme: '',
    verse: '',
    liturgiaPic: '',
    year: y,
    month: m,
  }));
}

function weekCount(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return sundaysInMonth(y, m).length;
}

export function registerMinistryPlanRoutes(app, { wrap }) {
  app.get(
    '/api/ministry-plans/:yearMonth',
    requireRole('KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      let plan = await prisma.ministryMonthPlan.findUnique({
        where: { yearMonth },
        include: { deliverables: { orderBy: [{ weekIndex: 'asc' }, { division: 'asc' }] } },
      });
      res.json({
        plan: plan || { yearMonth, theme: '', notes: '', weeks: defaultWeeks(yearMonth), deliverables: [] },
        divisions: DIVISIONS,
        kinds: KINDS,
      });
    }),
  );

  app.put(
    '/api/ministry-plans/:yearMonth',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const theme = req.body?.theme ? String(req.body.theme).slice(0, 190) : null;
      const notes = req.body?.notes ? String(req.body.notes) : null;
      const weeks = Array.isArray(req.body?.weeks) ? req.body.weeks : defaultWeeks(yearMonth);
      const existing = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const plan = existing
        ? await prisma.ministryMonthPlan.update({
            where: { id: existing.id },
            data: { theme, notes, weeks },
            include: { deliverables: true },
          })
        : await prisma.ministryMonthPlan.create({
            data: {
              id: idPlan(),
              yearMonth,
              theme,
              notes,
              weeks,
              createdById: req.authUser.id,
            },
            include: { deliverables: true },
          });
      res.json({ plan });
    }),
  );

  app.post(
    '/api/ministry-plans/:yearMonth/deliverables',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const weekIndex = Number(req.body?.weekIndex);
      const division = String(req.body?.division || '').toUpperCase();
      const title = String(req.body?.title || '').trim();
      const kind = req.body?.kind ? String(req.body.kind).toUpperCase() : null;
      const maxWeek = weekCount(yearMonth);
      if (!weekIndex || weekIndex < 1 || weekIndex > maxWeek || !DIVISIONS.includes(division) || !title) {
        return res.status(400).json({ error: `weekIndex (1–${maxWeek}), division, dan title wajib.` });
      }
      if (kind && !KINDS.includes(kind)) return res.status(400).json({ error: 'kind tidak valid.' });
      let plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      if (!plan) {
        plan = await prisma.ministryMonthPlan.create({
          data: {
            id: idPlan(),
            yearMonth,
            weeks: defaultWeeks(yearMonth),
            createdById: req.authUser.id,
          },
        });
      }
      const item = await prisma.ministryWeekDeliverable.create({
        data: {
          id: idDel(),
          planId: plan.id,
          weekIndex,
          division,
          kind,
          title,
          notes: req.body?.notes || null,
        },
      });
      res.status(201).json({ deliverable: item });
    }),
  );

  app.patch(
    '/api/ministry-plans/deliverables/:id',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const status = req.body?.status ? String(req.body.status).toUpperCase() : undefined;
      const title = req.body?.title ? String(req.body.title).trim() : undefined;
      const kind = req.body?.kind ? String(req.body.kind).toUpperCase() : undefined;
      if (status && !STATUSES.includes(status)) {
        return res.status(400).json({ error: `status harus salah satu dari ${STATUSES.join(', ')}.` });
      }
      if (kind && !KINDS.includes(kind)) return res.status(400).json({ error: 'kind tidak valid.' });

      const data = {};
      if (status) data.status = status;
      if (title) data.title = title;
      if (kind) data.kind = kind;
      if (req.body?.notes !== undefined) data.notes = req.body.notes ? String(req.body.notes) : null;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });

      const item = await prisma.ministryWeekDeliverable.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ deliverable: item });
    }),
  );

  app.delete(
    '/api/ministry-plans/deliverables/:id',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const deleted = await prisma.ministryWeekDeliverable.deleteMany({ where: { id: req.params.id } });
      if (!deleted.count) return res.status(404).json({ error: 'Deliverable tidak ditemukan.' });
      res.json({ ok: true });
    }),
  );
}
