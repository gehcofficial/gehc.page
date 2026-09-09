import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { sundaysInMonth, toISODate } from '../lib/church-year.mjs';
import { formatServiceName, servicePrefix, sundayInstant } from '../lib/service-events.mjs';
import { EVENT_ACTIVITY_CATEGORIES } from './content-public.mjs';

const EVENT_DIVISIONS = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
const SHAREABLE_KINDS = new Set(['MODULE', 'RUNDOWN']);

function slugifyEvent(name) {
  return (
    String(name || 'event')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'event'
  );
}

function serializeDeliverable(d) {
  return {
    id: d.id,
    weekIndex: d.weekIndex,
    division: d.division,
    kind: d.kind,
    title: d.title,
    notes: d.notes,
    status: d.status,
    eventId: d.eventId || null,
    event: d.event ? { id: d.event.id, name: d.event.name, status: d.event.status } : null,
  };
}

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
        include: {
          deliverables: {
            orderBy: [{ weekIndex: 'asc' }, { division: 'asc' }],
            include: { event: { select: { id: true, name: true, status: true } } },
          },
        },
      });
      if (plan) plan = { ...plan, deliverables: plan.deliverables.map(serializeDeliverable) };
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
      if (req.body?.eventId !== undefined) {
        const eventId = String(req.body.eventId || '').trim() || null;
        if (eventId) {
          const ev = await prisma.eventProgram.findUnique({ where: { id: eventId } });
          if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
        }
        data.eventId = eventId;
      }
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });

      const item = await prisma.ministryWeekDeliverable.update({
        where: { id: req.params.id },
        data,
        include: { event: { select: { id: true, name: true, status: true } } },
      });
      res.json({ deliverable: serializeDeliverable(item) });
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

  /**
   * POST /api/ministry-plans/deliverables/:id/share — bagikan deliverable
   * MODULE/RUNDOWN ke Event Tim Kerja.
   * Body: { eventId? } — tanpa eventId = buat EventProgram PLANNING baru
   * (nama = judul deliverable, tanggal = Minggu berjalan, divisi pemilik aktif).
   */
  app.post(
    '/api/ministry-plans/deliverables/:id/share',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const item = await prisma.ministryWeekDeliverable.findUnique({
        where: { id: req.params.id },
        include: { plan: true },
      });
      if (!item) return res.status(404).json({ error: 'Deliverable tidak ditemukan.' });
      if (item.kind && !SHAREABLE_KINDS.has(String(item.kind).toUpperCase())) {
        return res.status(400).json({ error: 'Hanya baris MODULE/RUNDOWN yang bisa dibagikan ke event.' });
      }
      if (!EVENT_DIVISIONS.includes(String(item.division || '').toUpperCase())) {
        return res.status(400).json({ error: 'Divisi deliverable tidak dikenal.' });
      }

      let eventId = String(req.body?.eventId || '').trim() || null;
      let event = null;
      if (eventId) {
        event = await prisma.eventProgram.findUnique({
          where: { id: eventId },
          include: { divisions: true },
        });
        if (!event) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      } else {
        const weeks = Array.isArray(item.plan?.weeks) ? item.plan.weeks : [];
        const week = weeks.find((w) => Number(w.index) === item.weekIndex);
        const slug = `${slugifyEvent(item.title)}-${Date.now().toString(36)}`;
        event = await prisma.eventProgram.create({
          data: {
            id: `evt-${slug}`,
            tenantId: 'tenant-youth',
            slug,
            name: item.title.slice(0, 160),
            description: item.notes || `Dari Rencana bulan ${item.plan?.yearMonth || ''} minggu ${item.weekIndex}.`,
            status: 'PLANNING',
            kind: 'INTERNAL',
            startDate: week?.date ? new Date(`${week.date}T00:00:00Z`) : null,
            createdById: req.authUser.id,
          },
          include: { divisions: true },
        });
        eventId = event.id;
      }

      // Aktifkan divisi pemilik bila belum ada.
      const division = String(item.division).toUpperCase();
      if (!event.divisions?.some((d) => String(d.division).toUpperCase() === division)) {
        await prisma.eventDivision.create({
          data: { id: `evd-${event.slug}-${division}`, eventId: event.id, division },
        }).catch(() => null);
      }

      const updated = await prisma.ministryWeekDeliverable.update({
        where: { id: item.id },
        data: { eventId },
        include: { event: { select: { id: true, name: true, status: true } } },
      });
      res.json({ deliverable: serializeDeliverable(updated) });
    }),
  );

  /**
   * POST /api/ministry-plans/:yearMonth/generate-services — buatkan EventProgram
   * ibadah mingguan dari tema tiap minggu: "{Prefix}: {Tema} - {DD Mon YYYY}".
   * Idempoten: minggu yang namanya sudah ada dilewati. Tiap event baru langsung
   * dapat draf konten publik (isPublished false) + divisi pelaksana aktif.
   * Body: { bipra?, kolom?, division? }.
   */
  app.post(
    '/api/ministry-plans/:yearMonth/generate-services',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const division = String(req.body?.division || 'LITURGIA').toUpperCase();
      if (!DIVISIONS.includes(division)) return res.status(400).json({ error: 'Divisi tidak dikenal.' });
      const prefix = servicePrefix(req.body?.bipra, req.body?.kolom);

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = Array.isArray(plan?.weeks) && plan.weeks.length ? plan.weeks : defaultWeeks(yearMonth);
      const themed = weeks.filter((w) => String(w.theme || '').trim() && w.date);
      if (!themed.length) {
        return res.status(400).json({ error: 'Isi dulu tema minggunya, baru generate.' });
      }

      const created = [];
      const skipped = [];
      for (const w of themed) {
        const name = formatServiceName(prefix, w.theme, w.date);
        if (!name) continue;
        const dup = await prisma.eventProgram.findFirst({ where: { name }, select: { id: true } });
        if (dup) {
          skipped.push(name);
          continue;
        }
        const slugBase = String(name).toLowerCase().normalize('NFKD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40) || 'ibadah';
        const slug = `${slugBase}-${Date.now().toString(36)}`;
        const instant = sundayInstant(w.date);
        const ev = await prisma.eventProgram.create({
          data: {
            id: `evt-${slug}`,
            tenantId: 'tenant-youth',
            slug,
            name,
            description: `Ibadah mingguan ${prefix} — tema: ${String(w.theme).trim()}.`,
            status: 'PLANNING',
            kind: 'RECURRING',
            startDate: instant,
            eventDate: instant,
            createdById: req.authUser.id,
          },
        });
        await prisma.eventDivision.create({
          data: { id: `evd-${slug}-${division}`, eventId: ev.id, division },
        }).catch(() => null);
        await prisma.contentItem.create({
          data: {
            id: `cnt-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`,
            tenantId: 'tenant-youth',
            type: 'ACTIVITY',
            title: name,
            subtitle: plan?.theme || null,
            category: EVENT_ACTIVITY_CATEGORIES[0],
            isFeaturedEvent: false,
            isPublished: false,
            bannerUrl: '',
            eventId: ev.id,
          },
        }).catch(() => null);
        created.push({ id: ev.id, name, eventDate: w.date });
      }
      res.status(201).json({ created, skipped });
    }),
  );

  /**
   * GET /api/events/:id/deliverables — deliverable Rencana bulan yang tertaut
   * ke event ini (badge "dari Rencana bulan" + ringkasan divisi).
   */
  app.get(
    '/api/events/:id/deliverables',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ deliverables: [] });
      const rows = await prisma.ministryWeekDeliverable.findMany({
        where: { eventId: req.params.id },
        include: { plan: { select: { yearMonth: true, theme: true, weeks: true } } },
        orderBy: [{ weekIndex: 'asc' }, { division: 'asc' }],
      });
      res.json({
        deliverables: rows.map((d) => ({
          ...serializeDeliverable(d),
          yearMonth: d.plan?.yearMonth || null,
          weekDate: Array.isArray(d.plan?.weeks)
            ? (d.plan.weeks.find((w) => Number(w.index) === d.weekIndex)?.date || null)
            : null,
        })),
      });
    }),
  );
}
