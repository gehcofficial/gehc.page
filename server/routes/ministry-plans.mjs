import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { sundaysInMonth, toISODate } from '../lib/church-year.mjs';
import { formatServiceName, formatServiceNameByType, servicePrefix, servicePrefixByType, sundayInstant, sundayWIBInstant } from '../lib/service-events.mjs';
import { resolvePairIds } from '../lib/serving-cycle.mjs';
import { requireServiceTheme } from '../lib/service-approvers.mjs';
import { EVENT_ACTIVITY_CATEGORIES } from './content-public.mjs';

// Tema/generate = hasil rembuk BOD Tim Kerja + Didaskalia (+ Komisi)
const themeGate = (req, res, next) => {
  requireServiceTheme(req, res).then((ok) => { if (ok) next(); }).catch(next);
};

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
    serviceType: d.serviceType || null,
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
    mentoringTheme: '',
    servingTheme: '',
    verse: '',
    mentoringVerse: '',
    servingVerse: '',
    liturgiaPic: '',
    year: y,
    month: m,
  }));
}

function normalizeWeeks(weeks) {
  if (!Array.isArray(weeks)) return null;
  return weeks.map((w) => {
    const base = { ...w };
    // Backward compat: old `theme`/`verse` → map ke mentoring (W1) atau serving (W>1)
    if (!base.mentoringTheme && !base.servingTheme && base.theme) {
      if (Number(base.index) === 1) base.mentoringTheme = base.theme;
      else base.servingTheme = base.theme;
    }
    if (!base.mentoringVerse && !base.servingVerse && base.verse) {
      if (Number(base.index) === 1) base.mentoringVerse = base.verse;
      else base.servingVerse = base.verse;
    }
    return base;
  });
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
      if (plan) {
        const normalizedWeeks = normalizeWeeks(plan.weeks) || plan.weeks;
        plan = { ...plan, weeks: normalizedWeeks, deliverables: plan.deliverables.map(serializeDeliverable) };
      }
      res.json({
        plan: plan || { yearMonth, theme: '', notes: '', weeks: defaultWeeks(yearMonth), deliverables: [] },
        divisions: DIVISIONS,
        kinds: KINDS,
      });
    }),
  );

  app.put(
    '/api/ministry-plans/:yearMonth',
    themeGate,
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const theme = req.body?.theme ? String(req.body.theme).slice(0, 190) : null;
      const notes = req.body?.notes ? String(req.body.notes) : null;
      let weeks = Array.isArray(req.body?.weeks) ? normalizeWeeks(req.body.weeks) : defaultWeeks(yearMonth);
      if (!weeks) weeks = defaultWeeks(yearMonth);
      // Sanitize strings to length limits
      weeks = weeks.map((w) => ({
        ...w,
        theme: String(w.theme || '').slice(0, 190),
        mentoringTheme: String(w.mentoringTheme || '').slice(0, 190),
        servingTheme: String(w.servingTheme || '').slice(0, 190),
        verse: String(w.verse || '').slice(0, 500),
        mentoringVerse: String(w.mentoringVerse || '').slice(0, 500),
        servingVerse: String(w.servingVerse || '').slice(0, 500),
      }));
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
      const serviceType = req.body?.serviceType ? String(req.body.serviceType).toUpperCase() : null;
      const allowedServiceTypes = new Set(['MENTORING', 'SERVING']);
      const maxWeek = weekCount(yearMonth);
      if (!weekIndex || weekIndex < 1 || weekIndex > maxWeek || !DIVISIONS.includes(division) || !title) {
        return res.status(400).json({ error: `weekIndex (1–${maxWeek}), division, dan title wajib.` });
      }
      if (kind && !KINDS.includes(kind)) return res.status(400).json({ error: 'kind tidak valid.' });
      if (serviceType && !allowedServiceTypes.has(serviceType)) return res.status(400).json({ error: 'serviceType harus MENTORING atau SERVING.' });
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
          serviceType,
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
      if (req.body?.serviceType !== undefined) {
        const st = req.body.serviceType ? String(req.body.serviceType).toUpperCase() : null;
        if (st && !['MENTORING', 'SERVING'].includes(st)) return res.status(400).json({ error: 'serviceType harus MENTORING atau SERVING.' });
        data.serviceType = st;
      }
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
        // Infer serviceType untuk ibadah mingguan bila deliverable terkait ibadah
        const inferredServiceType = (() => {
          const st = String(item.serviceType || '').toUpperCase();
          if (st === 'MENTORING') return 'MENTORING_DAY';
          if (st === 'SERVING') return 'SERVING_DAY';
          if (Number(item.weekIndex) === 1) return 'MENTORING_DAY';
          return 'SERVING_DAY';
        })();
        const isIbadahShare = SHAREABLE_KINDS.has(String(item.kind || '').toUpperCase()) && week?.date;
        const instant = week?.date ? sundayWIBInstant(week.date, 9) : null;
        event = await prisma.eventProgram.create({
          data: {
            id: `evt-${slug}`,
            tenantId: 'tenant-youth',
            slug,
            name: item.title.slice(0, 160),
            description: item.notes || `Dari Rencana bulan ${item.plan?.yearMonth || ''} minggu ${item.weekIndex}.`,
            status: 'PLANNING',
            kind: isIbadahShare ? 'RECURRING' : 'INTERNAL',
            serviceType: isIbadahShare ? inferredServiceType : null,
            metadata: isIbadahShare ? { weekIndex: item.weekIndex, yearMonth: item.plan?.yearMonth || null, source: 'share', deliverableId: item.id } : null,
            startDate: instant,
            eventDate: instant,
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
          data: { id: `evd-${crypto.randomUUID()}`, eventId: event.id, division },
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
   * ibadah mingguan dari tema tiap minggu.
   * W1 MENTORING_DAY = mentoringTheme (Komisi+Tim Kerja), W2+ SERVING_DAY = servingTheme (bergilir 10 pasang).
   * Legacy `theme` tetap didukung (fallback).
   * Idempoten: name atau (eventDate+serviceType) atau ServingAssignment sudah ada → skip.
   * Body: { bipra?, kolom?, division?, serviceSet? } serviceSet = BOTH|MENTORING|SERVING (default BOTH).
   */
  app.post(
    '/api/ministry-plans/:yearMonth/generate-services',
    themeGate,
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const division = String(req.body?.division || 'LITURGIA').toUpperCase();
      if (!DIVISIONS.includes(division)) return res.status(400).json({ error: 'Divisi tidak dikenal.' });
      const serviceSet = String(req.body?.serviceSet || 'BOTH').toUpperCase();
      if (!['BOTH', 'MENTORING', 'SERVING'].includes(serviceSet)) return res.status(400).json({ error: 'serviceSet harus BOTH, MENTORING, atau SERVING.' });

      // Auto-save weeks bila dikirim dari UI (hapus ritual Simpan → Buatkan 2 klik)
      if (Array.isArray(req.body?.weeks) && req.body.weeks.length) {
        const incoming = normalizeWeeks(req.body.weeks);
        if (incoming) {
          const sanitized = incoming.map((w) => ({
            ...w,
            theme: String(w.theme || '').slice(0, 190),
            mentoringTheme: String(w.mentoringTheme || '').slice(0, 190),
            servingTheme: String(w.servingTheme || '').slice(0, 190),
            verse: String(w.verse || '').slice(0, 500),
            mentoringVerse: String(w.mentoringVerse || '').slice(0, 500),
            servingVerse: String(w.servingVerse || '').slice(0, 500),
          }));
          const existingPlan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
          if (existingPlan) {
            await prisma.ministryMonthPlan.update({ where: { id: existingPlan.id }, data: { weeks: sanitized } });
          } else {
            await prisma.ministryMonthPlan.create({
              data: {
                id: idPlan(),
                yearMonth,
                weeks: sanitized,
                createdById: req.authUser.id,
              },
            });
          }
        }
      }

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const rawWeeks = Array.isArray(plan?.weeks) && plan.weeks.length ? plan.weeks : defaultWeeks(yearMonth);
      const weeks = normalizeWeeks(rawWeeks) || rawWeeks;
      // Kondisi khusus minggu (GABUNGAN/LIBUR/ALIH) — LIBUR/ALIH tidak consume cycle
      const { listOverrides } = await import('../lib/service-overrides.mjs');
      const weekDates = weeks.map((w) => String(w?.date || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      const overrides = weekDates.length
        ? await listOverrides(prisma, weekDates[0], weekDates[weekDates.length - 1])
        : new Map();
      // Kumpulkan kandidat layanan per minggu sesuai serviceSet + tema terisi
      const candidates = [];
      const skipped = [];
      for (const w of weeks) {
        if (!w?.date) continue;
        const iso = String(w.date).slice(0, 10);
        const ov = overrides.get(iso);
        if (ov && (ov.condition === 'LIBUR' || ov.condition === 'ALIH')) {
          skipped.push(`${iso} (${ov.condition === 'LIBUR' ? 'libur' : 'dialihkan'}${ov.note ? ` — ${ov.note}` : ''}${ov.partnerLabel ? ` — ${ov.partnerLabel}` : ''})`);
          continue;
        }
        if (ov && ov.condition === 'GABUNGAN') {
          const theme = String(w.servingTheme || w.mentoringTheme || w.theme || '').trim();
          if (theme) candidates.push({ week: w, serviceType: 'GABUNGAN', theme, override: ov });
          continue;
        }
        const idx = Number(w.index);
        const mentoringTheme = String(w.mentoringTheme || w.theme || '').trim();
        const servingTheme = String(w.servingTheme || w.theme || '').trim();
        // W1 mentoring
        if (idx === 1 && mentoringTheme && ['BOTH', 'MENTORING'].includes(serviceSet)) {
          candidates.push({ week: w, serviceType: 'MENTORING_DAY', theme: mentoringTheme });
        }
        // W2+ serving (idx>1)
        if (idx > 1 && servingTheme && ['BOTH', 'SERVING'].includes(serviceSet)) {
          candidates.push({ week: w, serviceType: 'SERVING_DAY', theme: servingTheme });
        }
        // Edge: jika hanya legacy theme dan idx=1 already handled, untuk idx>1 yang belum handle tapi theme legacy ada dan servingTheme kosong? already covered via servingTheme fallback to theme for idx>1
        // Jika serviceSet BOTH dan W1 punya servingTheme terisi tapi idx=1 we still skip serving on W1 per spec (W1 hanya mentoring)
      }
      if (!candidates.length) {
        return res.status(400).json({ error: 'Tema mingguan masih kosong. Isi tema di tabel atas (W1 = Mentoring, W2+ = Serving), klik Simpan tema dulu, baru Buatkan event ibadah.' });
      }
      // Sort kronologis
      candidates.sort((a, b) => String(a.week.date).localeCompare(String(b.week.date)));

      // Hitung starting cycleIndex untuk SERVING_DAY: jumlah assignment existing
      let servingBase = 0;
      try {
        const cnt = await prisma.servingAssignment.count();
        servingBase = cnt;
      } catch {}
      const groups = await prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []);

      const created = [];
      let servingCreatedInThisBatch = 0;
      for (const cand of candidates) {
        const { week, serviceType, theme } = cand;
        const isGabungan = serviceType === 'GABUNGAN';
        const name = isGabungan
          ? formatServiceName(`Ibadah Gabungan${cand.override?.partnerLabel ? ` ${cand.override.partnerLabel}` : ''}`, theme, week.date)
          : formatServiceNameByType(req.body?.bipra, req.body?.kolom, serviceType, theme, week.date);
        if (!name) continue;
        const instant = sundayWIBInstant(week.date, 9);
        // Dup cek: name exact
        const dupName = await prisma.eventProgram.findFirst({ where: { name }, select: { id: true } });
        if (dupName) { skipped.push(`${name} (nama sudah ada)`); continue; }
        // Dup cek: eventDate + serviceType (bila sudah ada)
        if (instant) {
          const dupDateType = await prisma.eventProgram.findFirst({ where: { eventDate: instant, serviceType }, select: { id: true } }).catch(() => null);
          if (dupDateType) { skipped.push(`${name} (tanggal+tipe sudah ada)`); continue; }
          // Serv assignment dup for SERVING_DAY
          if (serviceType === 'SERVING_DAY') {
            const existingAssign = await prisma.servingAssignment.findFirst({ where: { eventDate: instant } }).catch(() => null);
            if (existingAssign) { skipped.push(`${name} (jadwal serving sudah ada)`); continue; }
          }
        }
        const slugBase = String(name).toLowerCase().normalize('NFKD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40) || 'ibadah';
        const slug = `${slugBase}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
        let cycleIndex = null;
        let metadata = { weekIndex: week.index, yearMonth, generatedAt: new Date().toISOString() };
        let servingPair = null;
        if (serviceType === 'SERVING_DAY') {
          cycleIndex = (servingBase + servingCreatedInThisBatch) % 10;
          metadata.cycleIndex = cycleIndex;
          if (groups.length) {
            servingPair = resolvePairIds(cycleIndex, groups);
            if (!servingPair.responsibleGroupId || !servingPair.hostGroupId) {
              // tetap buat event meski group belum seed — assignment tidak dibuat
              console.warn(`[generate-services] group id untuk cycle ${cycleIndex} tidak ditemukan: ${servingPair.responsibleName}/${servingPair.hostName}`);
              servingPair = null;
            }
          }
        }
        const ev = await prisma.eventProgram.create({
          data: {
            id: `evt-${slug}`,
            tenantId: 'tenant-youth',
            slug,
            name,
            description: isGabungan
              ? `Ibadah gabungan${cand.override?.partnerLabel ? ` ${cand.override.partnerLabel}` : ''}${cand.override?.note ? ` — ${cand.override.note}` : ''} — tema: ${theme}.`
              : `Ibadah ${serviceType === 'MENTORING_DAY' ? 'Mentoring' : 'Raya'} ${servicePrefixByType(req.body?.bipra, req.body?.kolom, serviceType)} — tema: ${theme}.`,
            status: 'PLANNING',
            kind: isGabungan ? 'KHUSUS' : 'RECURRING',
            serviceType,
            metadata: isGabungan ? { ...metadata, joint: true, partnerLabel: cand.override?.partnerLabel || null } : metadata,
            startDate: instant,
            eventDate: instant,
            createdById: req.authUser.id,
          },
        });
        await prisma.eventDivision.create({
          data: { id: `evd-${crypto.randomUUID()}`, eventId: ev.id, division },
        }).catch(() => null);
        // Untuk serving/gabungan: aktifkan juga DIDASKALIA bila division != DIDASKALIA agar modul langsung punya folder
        if ((serviceType === 'SERVING_DAY' || isGabungan) && division !== 'DIDASKALIA') {
          await prisma.eventDivision.create({
            data: { id: `evd-${crypto.randomUUID()}`, eventId: ev.id, division: 'DIDASKALIA' },
          }).catch(() => null);
        }
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
        // Auto-create/link MinistryWeekDeliverable agar Division langsung lihat badge (dedup, tidak duplikat eventId)
        // GABUNGAN dilewati — deliverable dibuat manual di Program & Event (KHUSUS)
        if (!isGabungan) try {
          const planForDel = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
          if (planForDel) {
            const needed = [];
            if (serviceType === 'MENTORING_DAY') needed.push({ division: 'DIDASKALIA', kind: 'MODULE', serviceType: 'MENTORING', title: `Modul W${week.index} - ${theme}` });
            else if (serviceType === 'SERVING_DAY') {
              needed.push({ division: 'DIDASKALIA', kind: 'MODULE', serviceType: 'SERVING', title: `Modul W${week.index} - ${theme}` });
              needed.push({ division: 'LITURGIA', kind: 'RUNDOWN', serviceType: 'SERVING', title: `Rundown W${week.index} - ${theme}` });
            }
            for (const nd of needed) {
              const exists = await prisma.ministryWeekDeliverable.findFirst({ where: { planId: planForDel.id, weekIndex: week.index, division: nd.division, kind: nd.kind, serviceType: nd.serviceType } });
              if (!exists) {
                await prisma.ministryWeekDeliverable.create({
                  data: {
                    id: idDel(),
                    planId: planForDel.id,
                    weekIndex: week.index,
                    division: nd.division,
                    kind: nd.kind,
                    serviceType: nd.serviceType,
                    title: nd.title.slice(0, 190),
                    status: 'TODO',
                    eventId: ev.id,
                  },
                }).catch(() => null);
              } else if (!exists.eventId) {
                await prisma.ministryWeekDeliverable.update({ where: { id: exists.id }, data: { eventId: ev.id } }).catch(() => null);
              } else if (exists.eventId !== ev.id) {
                // Terpisah per hari sudah ada, tapi beda event (Mentoring vs Serving same week can't happen karena weekIndex beda, namun jaga agar tidak timpa)
                const dup = await prisma.ministryWeekDeliverable.findFirst({ where: { planId: planForDel.id, weekIndex: week.index, division: nd.division, kind: nd.kind, serviceType: nd.serviceType, eventId: ev.id } });
                if (!dup) {
                  await prisma.ministryWeekDeliverable.create({
                    data: {
                      id: idDel(),
                      planId: planForDel.id,
                      weekIndex: week.index,
                      division: nd.division,
                      kind: nd.kind,
                      serviceType: nd.serviceType,
                      title: `${nd.title} (${nd.serviceType})`.slice(0, 190),
                      status: 'TODO',
                      eventId: ev.id,
                    },
                  }).catch(() => null);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[generate-services] deliverable auto-link skip', e.message);
        }
        if (serviceType === 'SERVING_DAY' && servingPair && instant) {
          try {
            await prisma.servingAssignment.create({
              data: {
                id: `sva-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
                eventId: ev.id,
                eventDate: instant,
                serviceType,
                responsibleGroupId: servingPair.responsibleGroupId,
                hostGroupId: servingPair.hostGroupId,
                cycleIndex,
              },
            });
          } catch (e) {
            console.warn('[generate-services] gagal buat servingAssignment', e.message);
          }
          servingCreatedInThisBatch += 1;
        }
        created.push({ id: ev.id, name, eventDate: week.date, serviceType, cycleIndex });
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
