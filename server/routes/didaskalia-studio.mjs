/**
 * Didaskalia Studio — sumber konten 7 Path + Ringkasan Khotbah + Pembekalan,
 * jadwal ritual mingguan, dan link Google Meet tetap.
 *
 * Penyimpanan MVP: field `studio` di dalam `MinistryMonthPlan.weeks[]` (JSON),
 * jadi tidak perlu migrasi. Link Meet disimpan di `ChannelLink`.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { sundaysInMonth, toISODate, addDays } from '../lib/church-year.mjs';
import { wibDateOnly } from '../lib/event-venue.mjs';
import {
  generateWeekDraft,
  generateEnrichedDraft,
  generateSermon,
  refineField,
  RITUAL_TYPES,
  RITUAL_LABELS,
  HOMILETIC_METHODS,
} from '../lib/didaskalia-ai.mjs';
import { getDriveMode, getFileStream, listFolders, createFolder, uploadFile } from '../gdrive.mjs';

const ymRe = /^\d{4}-\d{2}$/;
const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
const RITUAL_KIND = 'DIDASKALIA_RITUAL';
const RITUAL_REFS = ['SYNC', 'SERVING', 'EQUIP'];

const RITUAL_REF_BY_TYPE = {
  INTERNAL_SYNC: 'SYNC',
  SERVING_BRIEFING: 'SERVING',
  GENERAL_EQUIPPING: 'EQUIP',
};

const DOCS = ['pembekalan', 'khutbah', 'rhb'];

/** Lima section baku RHB harian (urutan tetap) — sinkron dengan src/lib/didaskalia.ts. */
const RHB_SECTION_DEFS = [
  { key: 'PENGANTAR', title: 'Pengantar' },
  { key: 'PEMBAHASAN_TEMATIS', title: 'Pembahasan Tematis' },
  { key: 'MAKNA_IMPLIKASI', title: 'Makna & Implikasi bagi Beyonders' },
  { key: 'REFLEKSI_PRIBADI', title: 'Pertanyaan untuk Refleksi Pribadi' },
  { key: 'DISKUSI_KELOMPOK', title: 'Pertanyaan untuk Diskusi Kelompok' },
];

const uid = () => crypto.randomBytes(8).toString('hex');

function str(v, max = 8000) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Normalisasi 5 section RHB: key, judul baku & urutan tetap. */
function sanitizeRhbSections(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return RHB_SECTION_DEFS.map((def) => {
    const found = list.find((x) => x && typeof x === 'object' && x.key === def.key) || {};
    return {
      key: def.key,
      title: def.title,
      body: str(found.body, 20000),
      imageFileId: str(found.imageFileId, 190).trim(),
    };
  });
}

function sanitizePaths(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 7).map((p, i) => ({
    ...(p && typeof p === 'object' ? p : {}),
    pathIndex: Number(p?.pathIndex) || i + 1,
    rhbSections: sanitizeRhbSections(p?.rhbSections),
  }));
}

function sanitizeImages(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const mapOfStr = (v) => {
    const o = v && typeof v === 'object' ? v : {};
    const out = {};
    for (const [k, val] of Object.entries(o)) if (typeof val === 'string' && val) out[k] = val.slice(0, 190);
    return out;
  };
  const rhb = {};
  if (r.rhb && typeof r.rhb === 'object') {
    for (const [day, secs] of Object.entries(r.rhb)) rhb[day] = mapOfStr(secs);
  }
  return { cover: str(r.cover, 190).trim(), paths: mapOfStr(r.paths), rhb };
}

export function hashContent(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj ?? null)).digest('hex').slice(0, 16);
}

function defaultStudio() {
  return {
    chapterNo: '',
    fundamentalFirman: { ref: '', text: '' },
    kitabFokus: '',
    status: 'DRAFT',
    authorId: null,
    reviewerId: null,
    homileticMethods: [],
    methodMix: [],
    paths: [],
    sermon: { methods: [], rationale: '', summary: '', slideOutline: [] },
    discussion: [],
    rituals: [],
    presentation: {},
    render: {},
  };
}

function sanitizeStudio(raw) {
  const s = raw && typeof raw === 'object' ? { ...defaultStudio(), ...raw } : defaultStudio();
  s.paths = sanitizePaths(s.paths);
  s.presentation = sanitizeImages(s.presentation);
  return s;
}

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
    studio: defaultStudio(),
  }));
}

function weekCount(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return sundaysInMonth(y, m).length;
}

function readWeeks(plan) {
  return Array.isArray(plan?.weeks) ? plan.weeks : [];
}

function getWeekIndex(req) {
  const n = Number(req.params.weekIndex);
  if (!Number.isInteger(n) || n < 1 || n > 6) return null;
  return n;
}

async function ensurePlan(prisma, yearMonth, userId) {
  let plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
  if (!plan) {
    plan = await prisma.ministryMonthPlan.create({
      data: { id: `mplan-${crypto.randomUUID()}`, yearMonth, theme: null, weeks: defaultWeeks(yearMonth), createdById: userId },
    });
  }
  return plan;
}

function weekOrDefault(weeks, yearMonth, weekIndex) {
  const found = weeks.find((w) => Number(w?.index) === weekIndex);
  if (found) return { ...found, studio: sanitizeStudio(found.studio) };
  const fallback = defaultWeeks(yearMonth).find((w) => w.index === weekIndex);
  return fallback || { index: weekIndex, date: '', studio: defaultStudio() };
}

async function saveStudioWeek(prisma, yearMonth, weekIndex, mutator, userId) {
  const plan = await ensurePlan(prisma, yearMonth, userId);
  const weeks = readWeeks(plan).map((w) => ({ ...w }));
  let idx = weeks.findIndex((w) => Number(w?.index) === weekIndex);
  if (idx < 0) {
    const fallback = defaultWeeks(yearMonth).find((w) => w.index === weekIndex) || { index: weekIndex, date: '', studio: defaultStudio() };
    weeks.push(fallback);
    idx = weeks.length - 1;
  }
  const current = { ...weeks[idx], studio: sanitizeStudio(weeks[idx].studio) };
  const next = mutator(current) || current;
  weeks[idx] = next;
  const updated = await prisma.ministryMonthPlan.update({ where: { id: plan.id }, data: { weeks } });
  return weekOrDefault(readWeeks(updated), yearMonth, weekIndex);
}

/** Cari EventProgram yang jatuh pada tanggal Minggu tertentu (WIB). */
async function resolveEventId(prisma, dateISO) {
  if (!dateISO) return null;
  try {
    const day = new Date(`${dateISO}T00:00:00.000Z`);
    const from = new Date(day.getTime() - 24 * 3600 * 1000);
    const to = new Date(day.getTime() + 2 * 24 * 3600 * 1000);
    const rows = await prisma.eventProgram.findMany({
      where: { eventDate: { gte: from, lt: to } },
      select: { id: true, name: true, serviceType: true, eventDate: true },
      orderBy: { eventDate: 'asc' },
    });
    const onDate = rows.filter((r) => wibDateOnly(r.eventDate) === dateISO);
    // Utamakan ibadah (Mentoring/Serving) agar materi Didaskalia menempel ke event yang benar.
    const match = onDate.find((r) => r.serviceType === 'MENTORING_DAY' || r.serviceType === 'SERVING_DAY') || onDate[0];
    return match ? { id: match.id, name: match.name, serviceType: match.serviceType } : null;
  } catch {
    return null;
  }
}

async function readRitualLinks(prisma) {
  try {
    const rows = await prisma.channelLink.findMany({ where: { kind: RITUAL_KIND } });
    const byRef = new Map(rows.map((r) => [r.refId, r]));
    return RITUAL_REFS.map((ref) => ({
      refId: ref,
      label: byRef.get(ref)?.label || RITUAL_LABELS[Object.keys(RITUAL_REF_BY_TYPE).find((t) => RITUAL_REF_BY_TYPE[t] === ref)] || ref,
      url: byRef.get(ref)?.url || '',
    }));
  } catch {
    return RITUAL_REFS.map((ref) => ({ refId: ref, label: ref, url: '' }));
  }
}

function mondayOfSunday(dateISO, offsetDays) {
  // Sunday date → tanggal ritual (offset negatif dari Minggu).
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  return toISODate(addDays(d, offsetDays));
}

/** Bangun ICS untuk satu ritual. */
function buildIcs({ ritual, label, meetUrl, summaryPrefix }) {
  const [hh, mm] = String(ritual.timeStart || '20:00').split(':').map(Number);
  const [eh, em] = String(ritual.timeEnd || '21:00').split(':').map(Number);
  const startWib = new Date(`${ritual.date}T00:00:00.000Z`);
  // WIB = UTC+7
  const startUtc = new Date(startWib.getTime() + (hh * 60 + mm) * 60000 - 7 * 3600000);
  const endUtc = new Date(startWib.getTime() + (eh * 60 + em) * 60000 - 7 * 3600000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const title = `${summaryPrefix || 'Didaskalia'} — ${label}`;
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GEHC//Didaskalia//ID\r\n';
  ics += 'BEGIN:VEVENT\r\n';
  ics += `UID:${uid()}@gehc.page\r\n`;
  ics += `DTSTART:${fmt(startUtc)}\r\n`;
  ics += `DTEND:${fmt(endUtc)}\r\n`;
  ics += `SUMMARY:${title}\r\n`;
  if (meetUrl) ics += `URL:${meetUrl}\r\nLOCATION:${meetUrl}\r\n`;
  ics += 'END:VEVENT\r\nEND:VCALENDAR';
  return ics;
}

function defaultRitualTimes(options = {}) {
  return {
    internal: { offsetDays: -6, timeStart: '20:00', timeEnd: '21:00', ...(options.internal || {}) },
    serving: { offsetDays: -4, timeStart: '20:00', timeEnd: '21:00', ...(options.serving || {}) },
    equip: { offsetDays: -2, timeStart: '20:00', timeEnd: '21:30', ...(options.equip || {}) },
  };
}

export function registerDidaskaliaStudioRoutes(app, { wrap }) {
  // ---------- Ritual links (3 ruang Meet tetap) ----------
  app.get(
    '/api/didaskalia/ritual-links',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ links: RITUAL_REFS.map((ref) => ({ refId: ref, label: ref, url: '' })) });
      res.json({ links: await readRitualLinks(prisma) });
    })
  );

  app.put(
    '/api/didaskalia/ritual-links',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const links = Array.isArray(req.body?.links) ? req.body.links : [];
      for (const l of links) {
        const refId = RITUAL_REFS.includes(l?.refId) ? l.refId : null;
        if (!refId) continue;
        const url = String(l.url || '').trim();
        const label = String(l.label || '').trim() || refId;
        await prisma.channelLink.upsert({
          where: { kind_refId: { kind: RITUAL_KIND, refId } },
          update: { url, label, updatedById: req.authUser?.id || null },
          create: { id: `cl-${crypto.randomUUID()}`, kind: RITUAL_KIND, refId, url, label, updatedById: req.authUser?.id || null },
        });
      }
      res.json({ links: await readRitualLinks(prisma) });
    })
  );

  // ---------- Get satu minggu ----------
  app.get(
    '/api/didaskalia/studio/:yearMonth/:weekIndex',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      if (!weekIndex) return res.status(400).json({ error: 'weekIndex tidak valid.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const event = await resolveEventId(prisma, week.date);
      const links = await readRitualLinks(prisma);
      res.json({
        week: { index: week.index, date: week.date, theme: week.theme || '', mentoringTheme: week.mentoringTheme || '', servingTheme: week.servingTheme || '', studio: sanitizeStudio(week.studio) },
        event,
        links,
        methods: HOMILETIC_METHODS,
        ritualTypes: RITUAL_TYPES.map((t) => ({ type: t, label: RITUAL_LABELS[t] })),
      });
    })
  );

  // ---------- Simpan (editor + diskusi + ritual) ----------
  app.patch(
    '/api/didaskalia/studio/:yearMonth/:weekIndex',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
      const body = req.body?.studio && typeof req.body.studio === 'object' ? req.body.studio : req.body || {};
      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (week) => {
          const st = { ...week.studio };
          for (const k of ['chapterNo', 'fundamentalFirman', 'kitabFokus', 'status', 'homileticMethods', 'methodMix', 'paths', 'sermon', 'discussion', 'rituals', 'presentation', 'generation']) {
            if (body[k] !== undefined) st[k] = body[k];
          }
          if (st.status && st.status === 'REVIEW' && !st.reviewerId) st.reviewerId = req.authUser?.id || null;
          if (!st.authorId) st.authorId = req.authUser?.id || null;
          return { ...week, studio: st };
        },
        req.authUser?.id
      );
      res.json({ week: saved });
    })
  );

  // ---------- AI: draft minggu (7 Path + ringkasan) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/draft',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const prev = weekOrDefault(weeks, yearMonth, weekIndex - 1);
      const next = weekOrDefault(weeks, yearMonth, weekIndex + 1);
      const st = sanitizeStudio(week.studio);

      let draft;
      try {
        draft = await generateWeekDraft({
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || st.chapterNo || '',
          chapterNo: req.body?.chapterNo ?? st.chapterNo,
          fundamentalFirman: req.body?.fundamentalFirman ?? st.fundamentalFirman,
          kitabFokus: req.body?.kitabFokus ?? st.kitabFokus,
          prevTheme: prev.mentoringTheme || prev.servingTheme || prev.theme || '',
          nextTheme: next.mentoringTheme || next.servingTheme || next.theme || '',
          methods: req.body?.methods ?? st.homileticMethods,
          notes: req.body?.notes,
        });
      } catch (e) {
        return res.status(502).json({ error: `AI gagal menyusun draf: ${e.message}` });
      }

      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (w) => {
          const s = { ...w.studio };
          if (draft.chapterNo) s.chapterNo = draft.chapterNo;
          if (draft.fundamentalFirman?.ref || draft.fundamentalFirman?.text) s.fundamentalFirman = draft.fundamentalFirman;
          if (draft.kitabFokus) s.kitabFokus = draft.kitabFokus;
          s.homileticMethods = draft.homileticMethods || s.homileticMethods;
          if (Array.isArray(draft.methodMix) && draft.methodMix.length) s.methodMix = draft.methodMix;
          s.paths = draft.paths;
          s.sermon = draft.sermon;
          s.generation = (Number(s.generation) || 0) + 1;
          if (s.status === 'PUBLISHED') s.status = 'DRAFT';
          if (!s.authorId) s.authorId = req.authUser?.id || null;
          return { ...w, studio: s };
        },
        req.authUser?.id
      );
      res.json({ week: saved, draft });
    })
  );

  // ---------- AI: perkaya draf (tahap 2, dengan diskusi internal) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/enrich',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const prev = weekOrDefault(weeks, yearMonth, weekIndex - 1);
      const next = weekOrDefault(weeks, yearMonth, weekIndex + 1);
      const st = sanitizeStudio(week.studio);

      let draft;
      try {
        draft = await generateEnrichedDraft({
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || st.chapterNo || '',
          chapterNo: req.body?.chapterNo ?? st.chapterNo,
          fundamentalFirman: req.body?.fundamentalFirman ?? st.fundamentalFirman,
          kitabFokus: req.body?.kitabFokus ?? st.kitabFokus,
          prevTheme: prev.mentoringTheme || prev.servingTheme || prev.theme || '',
          nextTheme: next.mentoringTheme || next.servingTheme || next.theme || '',
          methods: req.body?.methods ?? st.homileticMethods,
          notes: req.body?.notes,
          current: st,
        });
      } catch (e) {
        return res.status(502).json({ error: `AI gagal memperkaya draf: ${e.message}` });
      }

      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (w) => {
          const s = { ...w.studio };
          if (draft.chapterNo) s.chapterNo = draft.chapterNo;
          if (draft.fundamentalFirman?.ref || draft.fundamentalFirman?.text) s.fundamentalFirman = draft.fundamentalFirman;
          if (draft.kitabFokus) s.kitabFokus = draft.kitabFokus;
          s.homileticMethods = draft.homileticMethods || s.homileticMethods;
          if (Array.isArray(draft.methodMix) && draft.methodMix.length) s.methodMix = draft.methodMix;
          s.paths = draft.paths;
          s.sermon = draft.sermon;
          s.generation = (Number(s.generation) || 0) + 1;
          if (s.status === 'PUBLISHED') s.status = 'DRAFT';
          if (!s.authorId) s.authorId = req.authUser?.id || null;
          return { ...w, studio: s };
        },
        req.authUser?.id
      );
      res.json({ week: saved, draft });
    })
  );

  // ---------- AI: ringkasan khotbah saja ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/sermon',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const st = sanitizeStudio(week.studio);
      const pathsOutline = (st.paths || []).map((p) => `Path ${p.pathIndex}: ${p.title}`).join('\n');

      let sermon;
      try {
        sermon = await generateSermon({
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || '',
          fundamentalFirman: st.fundamentalFirman,
          kitabFokus: st.kitabFokus,
          methods: req.body?.methods ?? st.homileticMethods,
          notes: req.body?.notes,
          pathsOutline,
        });
      } catch (e) {
        return res.status(502).json({ error: `AI gagal menyusun ringkasan: ${e.message}` });
      }

      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (w) => ({ ...w, studio: { ...w.studio, sermon } }),
        req.authUser?.id
      );
      res.json({ week: saved, sermon });
    })
  );

  // ---------- AI: perbaiki satu bagian ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/refine',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const { fieldLabel, current, instruction, context } = req.body || {};
      if (!current) return res.status(400).json({ error: 'current wajib.' });
      try {
        const text = await refineField({ fieldLabel, current, instruction, context });
        res.json({ text });
      } catch (e) {
        res.status(502).json({ error: `AI gagal memperbaiki: ${e.message}` });
      }
    })
  );

  // ---------- Presentasi materi (deck web per pekan/hari) ----------
  const PRESENTATION_IMAGE_SUBFOLDER = '04 Presentasi';

  function effectiveRoles(req) {
    if (req.activeRole) return [req.activeRole];
    return (req.authUser?.roles || []).map((r) => r.role);
  }

  /** RBAC materi: 01/02 mentor+staf, 03 beyonders+staf (mengikuti topeng peran aktif). */
  function canViewDoc(req, doc) {
    const roles = effectiveRoles(req);
    const isPriv = ['SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'].some((r) => roles.includes(r));
    const isMentor = roles.includes('MENTOR') || roles.includes('CO_MENTOR');
    const isBeyonder = isMentor || roles.includes('MENTEE');
    if (doc === 'rhb') return isBeyonder || isPriv;
    return isMentor || isPriv;
  }

  // GET /api/didaskalia/presentation/2026-09/1?doc=pembekalan|khutbah|rhb[&day=3]
  app.get(
    '/api/didaskalia/presentation/:yearMonth/:weekIndex',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      const doc = String(req.query?.doc || 'pembekalan');
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
      if (!DOCS.includes(doc)) return res.status(400).json({ error: 'Jenis materi tidak valid.' });
      if (!canViewDoc(req, doc)) {
        return res.status(403).json({
          error: doc === 'rhb' ? 'RHB hanya untuk Beyonders (mentor/mentee).' : 'Materi ini hanya untuk Mentor/Co-mentor & staf.',
        });
      }

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const studio = sanitizeStudio(week.studio);
      const render = studio.render?.[doc] || null;
      res.json({
        doc,
        meta: {
          weekIndex: week.index,
          date: week.date || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || '',
        },
        studio,
        published: studio.status === 'PUBLISHED' && Boolean(render),
        version: Number(render?.version) || 1,
        snapshot: render?.snapshot || null,
      });
    })
  );

  // GET /api/didaskalia/asset/:fileId — proxy gambar (login-gated, tanpa share publik)
  app.get(
    '/api/didaskalia/asset/:fileId',
    requireRole(),
    wrap(async (req, res) => {
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      const fileId = String(req.params.fileId || '');
      if (!fileId) return res.status(400).json({ error: 'fileId wajib.' });
      try {
        const { meta, stream } = await getFileStream(fileId);
        res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        stream.on('error', () => { try { res.end(); } catch { /* abaikan */ } });
        stream.pipe(res);
      } catch {
        res.status(404).json({ error: 'Gambar tidak ditemukan.' });
      }
    })
  );

  // POST /api/didaskalia/studio/:yearMonth/:weekIndex/presentation-image
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/presentation-image',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });

      const { filename, mimetype, data } = req.body || {};
      if (!filename || !data) return res.status(400).json({ error: 'filename dan data wajib.' });
      if (typeof data === 'string' && data.length > 6_000_000) return res.status(413).json({ error: 'Gambar terlalu besar (maks ~4MB).' });
      const mime = String(mimetype || '');
      if (!mime.startsWith('image/')) return res.status(400).json({ error: 'Hanya berkas gambar yang diizinkan.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const event = await resolveEventId(prisma, week.date);
      if (!event?.id) return res.status(400).json({ error: 'Belum ada event ibadah untuk pekan ini. Buat dulu di Ibadah Mingguan.' });

      try {
        let division = await prisma.eventDivision.findUnique({
          where: { eventId_division: { eventId: event.id, division: 'DIDASKALIA' } },
          select: { id: true, driveFolderId: true },
        });
        if (!division?.driveFolderId) {
          const { createEventFolder } = await import('../gdrive-events.mjs');
          const ev = await prisma.eventProgram.findUnique({ where: { id: event.id } });
          const fid = ev ? await createEventFolder(ev, 'DIDASKALIA') : null;
          if (fid && division) await prisma.eventDivision.update({ where: { id: division.id }, data: { driveFolderId: fid } }).catch(() => null);
          division = { id: division?.id || null, driveFolderId: fid };
        }
        if (!division?.driveFolderId) return res.status(400).json({ error: 'Folder Drive Didaskalia belum siap.' });

        const subs = await listFolders(division.driveFolderId, 100);
        let target = subs.find((f) => String(f.name || '').toLowerCase() === PRESENTATION_IMAGE_SUBFOLDER.toLowerCase());
        if (!target) target = await createFolder(division.driveFolderId, PRESENTATION_IMAGE_SUBFOLDER);
        const parentId = target?.id || division.driveFolderId;

        const buffer = Buffer.from(data, 'base64');
        if (buffer.length > 5_000_000) return res.status(413).json({ error: 'Gambar >5MB tidak didukung.' });
        const file = await uploadFile(parentId, { originalname: filename, mimetype: mime, buffer });
        res.status(201).json({ fileId: file.id, url: `/api/didaskalia/asset/${file.id}`, name: file.name });
      } catch (e) {
        res.status(500).json({ error: `Gagal mengunggah gambar: ${String(e.message || e).slice(0, 200)}` });
      }
    })
  );

  // ---------- Publish: catat versi + file Drive ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/publish',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      const doc = String(req.body?.doc || '');
      if (!ymRe.test(yearMonth) || !weekIndex || !DOCS.includes(doc)) return res.status(400).json({ error: 'Parameter publish tidak valid.' });
      const files = Array.isArray(req.body?.files) ? req.body.files.slice(0, 40) : [];
      const hash = String(req.body?.hash || '').slice(0, 32) || null;

      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (w) => {
          const s = { ...w.studio };
          const prev = s.render?.[doc] || {};
          const version = Number(req.body?.version) || (Number(prev.version) || 0) + 1;
          s.render = {
            ...(s.render || {}),
            [doc]: {
              version,
              renderedAt: new Date().toISOString(),
              driveFolder: req.body?.driveFolder || prev.driveFolder || null,
              files,
              contentHash: hash,
              snapshot: {
                doc,
                weekIndex: Number(w.index) || 0,
                date: w.date || '',
                theme: w.mentoringTheme || w.servingTheme || w.theme || '',
                chapterNo: s.chapterNo || '',
                fundamentalFirman: s.fundamentalFirman || { ref: '', text: '' },
                kitabFokus: s.kitabFokus || '',
                methodMix: Array.isArray(s.methodMix) ? s.methodMix : [],
                paths: sanitizePaths(s.paths),
                sermon: s.sermon || { methods: [], rationale: '', summary: '', slideOutline: [] },
                images: sanitizeImages(s.presentation),
              },
            },
          };
          if (doc === 'pembekalan' || doc === 'rhb') s.status = 'PUBLISHED';
          return { ...w, studio: s };
        },
        req.authUser?.id
      );
      res.json({ week: saved });
    })
  );

  // ---------- Jadwal ritual: generate dari bulan ----------
  app.post(
    '/api/didaskalia/schedule/:yearMonth/generate',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const options = defaultRitualTimes(req.body?.options || {});
      const total = weekCount(yearMonth);
      for (let i = 1; i <= total; i++) {
        await saveStudioWeek(
          prisma,
          yearMonth,
          i,
          (w) => {
            const date = w.date;
            const rituals = [];
            rituals.push({
              type: 'INTERNAL_SYNC',
              date: mondayOfSunday(date, options.internal.offsetDays),
              timeStart: options.internal.timeStart,
              timeEnd: options.internal.timeEnd,
              status: 'PLANNED',
              notes: '',
            });
            if (i > 1) {
              rituals.push({
                type: 'SERVING_BRIEFING',
                date: mondayOfSunday(date, options.serving.offsetDays),
                timeStart: options.serving.timeStart,
                timeEnd: options.serving.timeEnd,
                status: 'PLANNED',
                notes: '',
              });
            }
            rituals.push({
              type: 'GENERAL_EQUIPPING',
              date: mondayOfSunday(date, options.equip.offsetDays),
              timeStart: options.equip.timeStart,
              timeEnd: options.equip.timeEnd,
              status: 'PLANNED',
              notes: '',
            });
            return { ...w, studio: { ...w.studio, rituals } };
          },
          req.authUser?.id
        );
      }
      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      res.json({ weeks: readWeeks(plan).map((w) => ({ index: w.index, date: w.date, theme: w.theme || '', rituals: sanitizeStudio(w.studio).rituals })) });
    })
  );

  // ---------- Jadwal ritual: baca bulan ----------
  app.get(
    '/api/didaskalia/schedule/:yearMonth',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      if (!ymRe.test(yearMonth)) return res.status(400).json({ error: 'Format bulan YYYY-MM.' });
      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : defaultWeeks(yearMonth);
      const links = await readRitualLinks(prisma);
      const linkByRef = new Map(links.map((l) => [l.refId, l.url]));
      res.json({
        yearMonth,
        theme: plan?.theme || '',
        links,
        weeks: weeks.map((w) => {
          const st = sanitizeStudio(w.studio);
          return {
            index: w.index,
            date: w.date,
            theme: w.mentoringTheme || w.servingTheme || w.theme || '',
            rituals: (st.rituals || []).map((r) => ({ ...r, meetUrl: linkByRef.get(RITUAL_REF_BY_TYPE[r.type]) || '' })),
          };
        }),
      });
    })
  );

  // ---------- ICS per ritual ----------
  app.get(
    '/api/didaskalia/ritual/:yearMonth/:weekIndex/:type/ics',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      const type = String(req.params.type || '').toUpperCase();
      if (!ymRe.test(yearMonth) || !weekIndex || !RITUAL_TYPES.includes(type)) return res.status(400).json({ error: 'Parameter tidak valid.' });
      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const week = weekOrDefault(plan ? readWeeks(plan) : [], yearMonth, weekIndex);
      const st = sanitizeStudio(week.studio);
      const ritual = (st.rituals || []).find((r) => r.type === type);
      if (!ritual) return res.status(404).json({ error: 'Ritual belum di-generate.' });
      const links = await readRitualLinks(prisma);
      const url = links.find((l) => l.refId === RITUAL_REF_BY_TYPE[type])?.url || '';
      const ics = buildIcs({ ritual, label: RITUAL_LABELS[type], meetUrl: url, summaryPrefix: 'Didaskalia' });
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="didaskalia-${type.toLowerCase()}-${ritual.date}.ics"`);
      res.send(ics);
    })
  );
}
