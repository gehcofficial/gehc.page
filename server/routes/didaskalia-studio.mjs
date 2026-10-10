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
import { requireDivision } from '../lib/division-access.mjs';
import { sundaysInMonth, toISODate, addDays } from '../lib/church-year.mjs';
import { wibDateOnly } from '../lib/event-venue.mjs';
import { deleteEmptySession } from './worship.mjs';
import {
  generateWeekDraft,
  generateEnrichedDraft,
  generateWeekExtras,
  generateSermon,
  generateSessionDraft,
  refineField,
  summarizeWeek,
  RITUAL_TYPES,
  RITUAL_LABELS,
  HOMILETIC_METHODS,
} from '../lib/didaskalia-ai.mjs';
import { getDriveMode, getFileStream, listFolders, createFolder, uploadFile } from '../gdrive.mjs';
import { generateImageBase64 } from '../ai-provider.mjs';
import { computeRegenDiff, proposalFromDraft, richnessCheck } from '../lib/didaskalia-diff.mjs';
import { parseServiceMd, parseRhbMd } from '../lib/didaskalia-md.mjs';
import { isDriveAuthError, driveAuthErrorMessage } from '../lib/gdrive-user-oauth.mjs';
import { listOverrides, effectiveDate } from '../lib/service-overrides.mjs';
import { pushToUsers } from '../lib/notify.mjs';

/** Respons 503 yang ramah bila token Drive pemilik kedaluwarsa/dicabut. */
function driveAuthExpired(res) {
  return res.status(503).json({
    error: driveAuthErrorMessage(),
    code: 'DRIVE_AUTH_EXPIRED',
  });
}

const ymRe = /^\d{4}-\d{2}$/;
const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
const RITUAL_KIND = 'DIDASKALIA_RITUAL';
const RITUAL_REFS = ['SYNC', 'SERVING', 'READER', 'EQUIP'];

const RITUAL_REF_BY_TYPE = {
  INTERNAL_SYNC: 'SYNC',
  SERVING_BRIEFING: 'SERVING',
  READER_COACHING: 'READER',
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

const CALENDAR_DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function sanitizePaths(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 7).map((p, i) => ({
    ...(p && typeof p === 'object' ? p : {}),
    pathIndex: i + 1,
    // Hari kalender baku: Path 1 = Minggu — jangan percaya nilai tersimpan.
    dayLabel: CALENDAR_DAY_LABELS[i] || `Hari ${i + 1}`,
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
  const aiImages = Array.isArray(r.aiImages) ? r.aiImages.filter((x) => typeof x === 'string' && x).slice(0, 20) : [];
  /** Ilustrasi AI per bagian khotbah literal: { pengantar|bedahTeologis|jembatan|kesimpulan: fileId }. */
  const khutbahLiteral = mapOfStr(r.khutbahLiteral);
  /** Ilustrasi AI per hari RHB: { '1'..'7': fileId } — 1 gambar berlaku semua slide hari itu. */
  const rhbAi = mapOfStr(r.rhbAi);
  return { cover: str(r.cover, 190).trim(), paths: mapOfStr(r.paths), rhb, aiImages, khutbahLiteral, rhbAi };
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
    sermon: { bigIdea: '', teksUtama: { ref: '', text: '' }, outline: { pengantar: '', bedahTeologis: '', jembatan: '', kesimpulan: '' }, methods: [], rationale: '', summary: '', slideOutline: [], deliveryPlan: [], prepChecklist: [], discussionFlow: [] },
    /** MD acuan mingguan (input awal skenario baru): { service, rhb } hasil parse didaskalia-md. */
    sourceMd: { service: null, rhb: null },
    discussion: [],
    rituals: [],
    presentation: {},
    render: {},
  };
}

function sanitizeSermonShape(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const tu = s.teksUtama && typeof s.teksUtama === 'object' ? s.teksUtama : {};
  const ol = s.outline && typeof s.outline === 'object' ? s.outline : {};
  return {
    bigIdea: str(s.bigIdea, 500),
    teksUtama: { ref: str(tu.ref, 160), text: str(tu.text, 600) },
    outline: {
      pengantar: str(ol.pengantar, 6000),
      bedahTeologis: str(ol.bedahTeologis, 8000),
      jembatan: str(ol.jembatan, 6000),
      kesimpulan: str(ol.kesimpulan, 4000),
    },
    methods: Array.isArray(s.methods) ? s.methods : [],
    rationale: str(s.rationale, 8000),
    summary: str(s.summary, 20000),
    slideOutline: Array.isArray(s.slideOutline) ? s.slideOutline : [],
    deliveryPlan: Array.isArray(s.deliveryPlan) ? s.deliveryPlan : [],
    prepChecklist: Array.isArray(s.prepChecklist) ? s.prepChecklist : [],
    discussionFlow: Array.isArray(s.discussionFlow) ? s.discussionFlow : [],
  };
}

function sanitizeSourceMd(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const pick = (v) => (v && typeof v === 'object' ? v : null);
  return { service: pick(s.service), rhb: pick(s.rhb) };
}

function sanitizeStudio(raw) {
  const s = raw && typeof raw === 'object' ? { ...defaultStudio(), ...raw } : defaultStudio();
  s.paths = sanitizePaths(s.paths);
  s.presentation = sanitizeImages(s.presentation);
  s.sermon = sanitizeSermonShape(s.sermon);
  s.sourceMd = sanitizeSourceMd(s.sourceMd);
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
    patternCode: 'MONOLOG',
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
  if (found) return { ...found, patternCode: String(found.patternCode || 'MONOLOG').toUpperCase(), studio: sanitizeStudio(found.studio) };
  const fallback = defaultWeeks(yearMonth).find((w) => w.index === weekIndex);
  return fallback || { index: weekIndex, date: '', patternCode: 'MONOLOG', studio: defaultStudio() };
}

/**
 * Pola ibadah pekan ini (dropdown Studio; default MONOLOG).
 * Mengembalikan { code, name, summary, playbook } untuk prompt AI.
 */
async function resolveWeekPattern(prisma, week, override) {
  const code = String(override || week?.patternCode || 'MONOLOG').toUpperCase().slice(0, 40) || 'MONOLOG';
  const pick = async (c) => {
    try {
      const row = await prisma.worshipPattern.findUnique({ where: { code: c } });
      if (row) {
        let phases = [];
        try {
          const raw = typeof row.phases === 'string' ? JSON.parse(row.phases) : row.phases;
          if (Array.isArray(raw)) phases = raw.slice(0, 8).map((f) => ({ no: f?.no, title: String(f?.title || ''), minutes: Number(f?.minutes) || 0, owner: String(f?.owner || '') }));
        } catch { /* abaikan */ }
        return { code: row.code, name: row.name, summary: row.summary || '', phases, playbook: String(row.playbook || '').slice(0, 4000) };
      }
    } catch { /* tabel pola belum ada — fallback literal */ }
    return null;
  };
  return (await pick(code)) || (await pick('MONOLOG')) || { code: 'MONOLOG', name: 'Monolog & FGD (Standar)', summary: '', phases: [], playbook: '' };
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

/** Cari EventProgram yang jatuh pada tanggal Minggu tertentu (WIB).
 *  Bila ada override GESER, pakai tanggal efektif (mis. W3 18 Okt → event 17 Okt).
 *  Pekan materi tetap dari grid Minggu — hanya resolusi event yang mengikuti geser. */
async function resolveEventId(prisma, dateISO) {
  if (!dateISO) return null;
  let lookup = dateISO;
  try {
    const ov = await listOverrides(prisma, dateISO, dateISO);
    lookup = effectiveDate(dateISO, ov) || dateISO;
  } catch { /* tanpa override — perilaku lama */ }
  try {
    const day = new Date(`${lookup}T00:00:00.000Z`);
    const from = new Date(day.getTime() - 24 * 3600 * 1000);
    const to = new Date(day.getTime() + 2 * 24 * 3600 * 1000);
    const rows = await prisma.eventProgram.findMany({
      where: { eventDate: { gte: from, lt: to } },
      select: { id: true, name: true, serviceType: true, eventDate: true },
      orderBy: { eventDate: 'asc' },
    });
    const onDate = rows.filter((r) => wibDateOnly(r.eventDate) === lookup);
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
    reader: { offsetDays: -3, timeStart: '19:30', timeEnd: '20:30', ...(options.reader || {}) },
    equip: { offsetDays: -2, timeStart: '20:00', timeEnd: '21:30', ...(options.equip || {}) },
  };
}

export function registerDidaskaliaStudioRoutes(app, { wrap }) {
  /** Konteks tim untuk AI: instruksi khusus + knowledge base aktif (Gems-like). */
  async function loadTeamContext(prisma) {
    try {
      const [cfg, docs] = await Promise.all([
        prisma.didaskaliaAiConfig.findUnique({ where: { id: 'didaskalia-ai' } }).catch(() => null),
        prisma.didaskaliaKnowledge.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
          select: { title: true, category: true, content: true },
        }).catch(() => []),
      ]);
      return {
        instruction: cfg?.instruction || '',
        maxKnowledgeChars: Number(cfg?.maxKnowledgeChars) || 12000,
        knowledge: docs,
      };
    } catch {
      return { instruction: '', maxKnowledgeChars: 12000, knowledge: [] };
    }
  }

  /** Notifikasi pengajuan regenerate ke approver (kepala divisi Didaskalia/SUPERADMIN). */
  async function notifyRegen(prisma, { yearMonth, weekIndex, summary, byName, kind }) {
    try {
      const { didaskaliaApproverIds } = await import('../lib/didaskalia-approval.mjs');
      const ids = await didaskaliaApproverIds(prisma);
      if (!ids.length) return;
      const title = 'Persetujuan regenerate Didaskalia';
      const message = `${byName || 'Tim'} mengajukan ${kind === 'enrich' ? 'perkaya' : 'draf'} ${yearMonth} pekan ${weekIndex}. ${summary}`;
      const href = '#/portal';
      await prisma.notification.createMany({
        data: ids.map((uid) => ({
          id: `ntf-${crypto.randomUUID()}`,
          type: 'APPROVAL_ITEM',
          memberId: uid,
          title,
          message,
          payload: { href, category: 'tugas', queue: 'didaskalia-regen', itemId: `${yearMonth}-${weekIndex}` },
          category: 'tugas',
          status: 'OPEN',
        })),
      }).catch(() => null);
      await pushToUsers(prisma, ids, { title, message, href, category: 'tugas', priority: 'TASK' }).catch(() => {});
    } catch { /* notifikasi opsional */ }
  }
  /** Notifikasi hasil persetujuan ke pengusul. */
  async function notifyRequester(prisma, userId, title, message) {
    if (!userId) return;
    try {
      await prisma.notification.createMany({
        data: [{
          id: `ntf-${crypto.randomUUID()}`,
          type: 'APPROVAL_ITEM',
          memberId: userId,
          title,
          message,
          payload: { href: '#/portal', category: 'tugas' },
          category: 'tugas',
          status: 'OPEN',
        }],
      }).catch(() => null);
      await pushToUsers(prisma, [userId], { title, message, href: '#/portal', category: 'tugas', priority: 'TASK' }).catch(() => {});
    } catch { /* opsional */ }
  }
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
    requireDivision('DIDASKALIA'),
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

  // ---------- Knowledge base + instruksi AI (Gems-like) ----------
  app.get('/api/didaskalia/knowledge', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.json({ knowledge: [] });
    const all = String(req.query?.all || '') === '1';
    const knowledge = await prisma.didaskaliaKnowledge.findMany({
      where: all ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    }).catch(() => []);
    res.json({ knowledge });
  }));

  app.post('/api/didaskalia/knowledge', requireDivision('DIDASKALIA'), requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { title, content, category, source, fileName, tags, sortOrder } = req.body || {};
    const cleanTitle = String(title || '').trim().slice(0, 200);
    const cleanContent = String(content || '').trim();
    if (!cleanTitle || !cleanContent) return res.status(400).json({ error: 'title & content wajib.' });
    if (cleanContent.length > 300000) return res.status(413).json({ error: 'Dokumen terlalu besar (maks ~300 KB teks).' });
    const CATS = ['FORMAT', 'TEOLOGI', 'REFERENSI', 'CATATAN'];
    const cat = CATS.includes(String(category || '').toUpperCase()) ? String(category).toUpperCase() : 'REFERENSI';
    const knowledge = await prisma.didaskaliaKnowledge.create({
      data: {
        id: `dk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        content: cleanContent,
        category: cat,
        source: ['MANUAL', 'UPLOAD', 'DISCUSSION'].includes(String(source || '').toUpperCase()) ? String(source).toUpperCase() : 'MANUAL',
        fileName: fileName ? String(fileName).slice(0, 255) : null,
        tags: Array.isArray(tags) ? tags : [],
        sortOrder: Number(sortOrder) || 0,
        createdById: req.authUser?.id || null,
      },
    });
    res.status(201).json({ knowledge });
  }));

  app.patch('/api/didaskalia/knowledge/:id', requireDivision('DIDASKALIA'), requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { title, content, category, isActive, sortOrder, tags } = req.body || {};
    const data = {};
    if (title !== undefined) data.title = String(title).trim().slice(0, 200);
    if (content !== undefined) data.content = String(content);
    if (category !== undefined) data.category = String(category).toUpperCase();
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder) || 0;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : [];
    const knowledge = await prisma.didaskaliaKnowledge.update({ where: { id: req.params.id }, data });
    res.json({ knowledge });
  }));

  app.delete('/api/didaskalia/knowledge/:id', requireDivision('DIDASKALIA'), requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    await prisma.didaskaliaKnowledge.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ ok: true });
  }));

  // ---------- Parse MD mingguan (input awal skenario baru, tanpa AI) ----------
  // POST /api/didaskalia/parse-md { kind: 'service'|'rhb', content }
  // → { ok, missing[], info/paths } untuk prefill editor pekan.
  app.post('/api/didaskalia/parse-md', requireDivision('DIDASKALIA'), requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const kind = String(req.body?.kind || '').toLowerCase();
    const content = String(req.body?.content || '');
    if (!content.trim()) return res.status(400).json({ error: 'content MD wajib.' });
    if (content.length > 300000) return res.status(413).json({ error: 'Dokumen terlalu besar (maks ~300 KB teks).' });
    if (kind === 'service') return res.json({ kind, ...parseServiceMd(content) });
    if (kind === 'rhb') return res.json({ kind, ...parseRhbMd(content) });
    return res.status(400).json({ error: 'kind harus service atau rhb.' });
  }));

  // ---------- Verifikasi ayat via bolls.life (READ-ONLY, tanpa API key) ----------
  // GET /api/bible/verify?ref=2%20Korintus%205:21&ref2=Kolose%201:13-14&versions=TB,KJV,ESV
  // → { checks: [{ ref, parsed, results: [{ version, text, verses, ablated, attribution } | { version, error }] }] }
  // Canonical TB untuk materi prod; KJV/ESV pembanding studi. NIV ditolak
  // (ablated penerbit). TIDAK menulis DB — koreksi tetap manual via Studio.
  app.get('/api/bible/verify', requireRole(), wrap(async (req, res) => {
    const { verifyVerse, BOLLS_VERSIONS } = await import('../lib/bolls.mjs');
    const refs = [req.query?.ref, req.query?.ref2, req.query?.ref3]
      .map((r) => String(r || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!refs.length) return res.status(400).json({ error: 'Parameter ref wajib (contoh: ?ref=2 Korintus 5:21).' });
    const versions = String(req.query?.versions || 'TB')
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 4);
    if (!versions.length) return res.status(400).json({ error: 'Parameter versions kosong.' });
    const bad = versions.filter((v) => !BOLLS_VERSIONS[v]);
    if (bad.length) return res.status(400).json({ error: `Versi belum didukung: ${bad.join(', ')} (pakai ${Object.keys(BOLLS_VERSIONS).join('/')}).` });
    const checks = [];
    for (const ref of refs) checks.push(await verifyVerse(ref, versions));
    res.json({ checks, versions });
  }));

  app.get('/api/didaskalia/ai-config', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.json({ config: { instruction: '', maxKnowledgeChars: 12000 } });
    const cfg = await prisma.didaskaliaAiConfig.findUnique({ where: { id: 'didaskalia-ai' } }).catch(() => null);
    res.json({ config: { instruction: cfg?.instruction || '', maxKnowledgeChars: cfg?.maxKnowledgeChars || 12000 } });
  }));

  app.put('/api/didaskalia/ai-config', requireDivision('DIDASKALIA'), requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const { instruction, maxKnowledgeChars } = req.body || {};
    const cap = Math.min(60000, Math.max(1000, Number(maxKnowledgeChars) || 12000));
    const config = await prisma.didaskaliaAiConfig.upsert({
      where: { id: 'didaskalia-ai' },
      update: { instruction: instruction === undefined ? undefined : String(instruction), maxKnowledgeChars: cap, updatedById: req.authUser?.id || null },
      create: { id: 'didaskalia-ai', instruction: String(instruction || ''), maxKnowledgeChars: cap, updatedById: req.authUser?.id || null },
    });
    res.json({ config: { instruction: config.instruction || '', maxKnowledgeChars: config.maxKnowledgeChars } });
  }));

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
        week: { index: week.index, date: week.date, theme: week.theme || '', mentoringTheme: week.mentoringTheme || '', servingTheme: week.servingTheme || '', patternCode: week.patternCode || 'MONOLOG', studio: sanitizeStudio(week.studio) },
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
    requireDivision('DIDASKALIA'),
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
          for (const k of ['chapterNo', 'fundamentalFirman', 'kitabFokus', 'status', 'homileticMethods', 'methodMix', 'paths', 'sermon', 'sourceMd', 'discussion', 'rituals', 'presentation', 'generation']) {
            if (body[k] !== undefined) st[k] = body[k];
          }
          const next = { ...week, studio: st };
          const pc = req.body?.patternCode !== undefined ? req.body.patternCode : body.patternCode;
          if (pc !== undefined) next.patternCode = String(pc || 'MONOLOG').toUpperCase().slice(0, 40) || 'MONOLOG';
          if (st.status && st.status === 'REVIEW' && !st.reviewerId) st.reviewerId = req.authUser?.id || null;
          if (!st.authorId) st.authorId = req.authUser?.id || null;
          return next;
        },
        req.authUser?.id
      );
      res.json({ week: saved });
    })
  );

  // ---------- Reset pola pekan ke MONOLOG (+ hapus sesi DRAFT kosong tertaut) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/reset-pattern',
    requireDivision('DIDASKALIA'),
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
      const from = String(week.patternCode || 'MONOLOG').toUpperCase();
      const event = await resolveEventId(prisma, week.date);

      const linked = [];
      const deleted = [];
      const kept = [];
      if (event?.id) {
        const rows = await prisma.worshipSession.findMany({
          where: { eventId: event.id },
          select: { id: true, slug: true, title: true, status: true },
        });
        for (const r of rows) linked.push({ slug: r.slug, title: r.title, status: r.status });
        if (req.body?.deleteEmptySessions !== false) {
          for (const r of rows) {
            const full = await prisma.worshipSession.findUnique({ where: { id: r.id } });
            try {
              const out = await deleteEmptySession(prisma, full);
              deleted.push(out.slug);
            } catch (e) {
              kept.push({ slug: r.slug, reason: e.message || 'Ditolak.' });
            }
          }
        } else {
          for (const r of rows) kept.push({ slug: r.slug, reason: 'Dilewati (opsi hapus mati).' });
        }
      }

      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (w) => ({ ...w, patternCode: 'MONOLOG' }),
        req.authUser?.id
      );
      res.json({
        ok: true,
        from,
        to: 'MONOLOG',
        event,
        linked,
        deleted,
        kept,
        week: { index: saved.index, date: saved.date, patternCode: saved.patternCode || 'MONOLOG' },
      });
    })
  );

  // ---------- AI: draft minggu (7 Path + ringkasan) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/draft',
    requireDivision('DIDASKALIA'),
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
      const team = await loadTeamContext(prisma);
      const pattern = await resolveWeekPattern(prisma, week, req.body?.patternCode);
      if (pattern.code !== (week.patternCode || 'MONOLOG')) {
        await saveStudioWeek(prisma, yearMonth, weekIndex, (w) => ({ ...w, patternCode: pattern.code }), req.authUser?.id);
      }
      try {
        draft = await generateWeekDraft({
          ...team,
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || st.chapterNo || '',
          chapterNo: req.body?.chapterNo ?? st.chapterNo,
          fundamentalFirman: req.body?.fundamentalFirman ?? st.fundamentalFirman,
          kitabFokus: req.body?.kitabFokus ?? st.kitabFokus,
          pattern,
          prevTheme: prev.mentoringTheme || prev.servingTheme || prev.theme || '',
          nextTheme: next.mentoringTheme || next.servingTheme || next.theme || '',
          prevWeek: summarizeWeek(prev, sanitizeStudio(prev.studio)),
          nextWeek: summarizeWeek(next, sanitizeStudio(next.studio)),
          methods: req.body?.methods ?? st.homileticMethods,
          notes: req.body?.notes,
          serviceMd: req.body?.serviceMd ?? st.sourceMd?.service ?? null,
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
          const proposal = proposalFromDraft(draft, s);
          const { diff, summary } = computeRegenDiff(s, proposal);
          s.pendingRegen = {
            id: `regen-${Date.now().toString(36)}`,
            kind: 'draft',
            requestedById: req.authUser?.id || null,
            requestedByName: req.authUser?.name || null,
            requestedAt: new Date().toISOString(),
            targetGeneration: (Number(s.generation) || 0) + 1,
            summary,
            diff,
            proposal,
            status: 'PENDING',
            meta: (draft && draft._meta) || null,
          };
          if (s.status === 'PUBLISHED') s.status = 'DRAFT';
          if (!s.authorId) s.authorId = req.authUser?.id || null;
          return { ...w, studio: s };
        },
        req.authUser?.id
      );
      const pending = saved?.studio?.pendingRegen || null;
      await notifyRegen(prisma, { yearMonth, weekIndex, summary: pending?.summary || '', byName: req.authUser?.name, kind: 'draft' });
      res.json({ week: saved, pending: true, summary: pending?.summary || '', diff: pending?.diff || [] });
    })
  );

  // ---------- AI: perkaya draf (tahap 2, dengan diskusi internal) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/enrich',
    requireDivision('DIDASKALIA'),
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
      const team = await loadTeamContext(prisma);
      const pattern = await resolveWeekPattern(prisma, week, req.body?.patternCode);
      try {
        draft = await generateEnrichedDraft({
          ...team,
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || st.chapterNo || '',
          chapterNo: req.body?.chapterNo ?? st.chapterNo,
          fundamentalFirman: req.body?.fundamentalFirman ?? st.fundamentalFirman,
          kitabFokus: req.body?.kitabFokus ?? st.kitabFokus,
          pattern,
          prevTheme: prev.mentoringTheme || prev.servingTheme || prev.theme || '',
          nextTheme: next.mentoringTheme || next.servingTheme || next.theme || '',
          prevWeek: summarizeWeek(prev, sanitizeStudio(prev.studio)),
          nextWeek: summarizeWeek(next, sanitizeStudio(next.studio)),
          methods: req.body?.methods ?? st.homileticMethods,
          notes: req.body?.notes,
          current: st,
          serviceMd: req.body?.serviceMd ?? st.sourceMd?.service ?? null,
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
          const proposal = proposalFromDraft(draft, s);
          const { diff, summary } = computeRegenDiff(s, proposal);
          s.pendingRegen = {
            id: `regen-${Date.now().toString(36)}`,
            kind: 'enrich',
            requestedById: req.authUser?.id || null,
            requestedByName: req.authUser?.name || null,
            requestedAt: new Date().toISOString(),
            targetGeneration: (Number(s.generation) || 0) + 1,
            meta: (draft && draft._meta) || null,
            summary,
            diff,
            proposal,
            status: 'PENDING',
          };
          if (s.status === 'PUBLISHED') s.status = 'DRAFT';
          if (!s.authorId) s.authorId = req.authUser?.id || null;
          return { ...w, studio: s };
        },
        req.authUser?.id
      );
      const pending = saved?.studio?.pendingRegen || null;
      await notifyRegen(prisma, { yearMonth, weekIndex, summary: pending?.summary || '', byName: req.authUser?.name, kind: 'enrich' });
      res.json({ week: saved, pending: true, summary: pending?.summary || '', diff: pending?.diff || [], meta: pending?.meta || null });
    })
  );

  // ---------- AI: lengkapi Bagian A/B (jaring pengaman) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/extras',
    requireDivision('DIDASKALIA'),
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
      const pathsOutline = (st.paths || []).map((p) => `Path ${p.pathIndex}: ${p.title}${p.summary ? ` — ${p.summary}` : ''}`).join('\n');

      let extras;
      const team = await loadTeamContext(prisma);
      try {
        extras = await generateWeekExtras({
          ...team,
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || st.chapterNo || '',
          fundamentalFirman: st.fundamentalFirman,
          kitabFokus: st.kitabFokus,
          methods: st.homileticMethods,
          notes: req.body?.notes,
          pathsOutline,
          pattern: await resolveWeekPattern(prisma, week, req.body?.patternCode),
          prevWeek: summarizeWeek(prev, sanitizeStudio(prev.studio)),
          nextWeek: summarizeWeek(next, sanitizeStudio(next.studio)),
        });
      } catch (e) {
        return res.status(502).json({ error: `AI gagal melengkapi Bagian A/B: ${e.message}` });
      }

      const saved = await saveStudioWeek(
        prisma,
        yearMonth,
        weekIndex,
        (w) => {
          const s = { ...w.studio };
          const sermon = { ...(s.sermon || {}) };
          if (extras.deliveryPlan?.length) sermon.deliveryPlan = extras.deliveryPlan;
          if (extras.prepChecklist?.length) sermon.prepChecklist = extras.prepChecklist;
          if (extras.discussionFlow?.length) sermon.discussionFlow = extras.discussionFlow;
          s.sermon = sermon;
          return { ...w, studio: s };
        },
        req.authUser?.id
      );
      res.json({ week: saved, extras });
    })
  );

  // ---------- AI: isi draft sesi hari-H dari konteks pekan (usulan, tanpa tulis DB) ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/session-draft',
    requireDivision('DIDASKALIA'),
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
      const pathsOutline = (st.paths || []).map((p) => `Path ${p.pathIndex}: ${p.title}${p.summary ? ` — ${p.summary}` : ''}`).join('\n');
      const fieldKeys = Array.isArray(req.body?.fieldKeys)
        ? req.body.fieldKeys.slice(0, 40).map((f) => ({ key: String(f?.key || ''), label: String(f?.label || '') })).filter((f) => f.key)
        : [];

      const team = await loadTeamContext(prisma);
      const pattern = await resolveWeekPattern(prisma, week, req.body?.patternCode);
      let draft;
      try {
        draft = await generateSessionDraft({
          ...team,
          yearMonth,
          weekIndex,
          date: week.date,
          monthTheme: plan?.theme || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || st.chapterNo || '',
          fundamentalFirman: st.fundamentalFirman,
          kitabFokus: st.kitabFokus,
          pattern,
          pathsOutline,
          sermonSummary: st.sermon?.summary || '',
          fieldKeys,
        });
      } catch (e) {
        return res.status(502).json({ error: `AI gagal menyusun draft sesi: ${e.message}` });
      }
      res.json({ pattern: { code: pattern.code, name: pattern.name }, draft });
    })
  );

  // ---------- AI: ringkasan khotbah saja ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/sermon',
    requireDivision('DIDASKALIA'),
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
      const team = await loadTeamContext(prisma);
      try {
        sermon = await generateSermon({
          ...team,
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
          pattern: await resolveWeekPattern(prisma, week, req.body?.patternCode),
          serviceMd: req.body?.serviceMd ?? st.sourceMd?.service ?? null,
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
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const { fieldLabel, current, instruction, context } = req.body || {};
      if (!current) return res.status(400).json({ error: 'current wajib.' });
      try {
        const team = await loadTeamContext(prisma);
        const text = await refineField({ fieldLabel, current, instruction, context, teamInstruction: team.instruction });
        res.json({ text });
      } catch (e) {
        res.status(502).json({ error: `AI gagal memperbaiki: ${e.message}` });
      }
    })
  );

  // ---------- Presentasi materi (deck web per pekan/hari) ----------
  const PRESENTATION_IMAGE_SUBFOLDER = '04 Presentasi';
  /** Kuota AI gabung per pekan: 1 cover + 4 khutbah + 7 RHB harian = 12. */
  const MAX_AI_TOTAL = 12;
  /** Sub-cap: cover AI (riwayat aiImages). */
  const MAX_AI_IMAGES = 3;
  /** Sub-cap: ilustrasi AI per bagian khotbah literal. */
  const MAX_KHUTBAH_IMAGES = 4;
  /** Sub-cap: ilustrasi AI per hari RHB. */
  const MAX_RHB_IMAGES = 7;

  /** Total gambar AI pekan ini (cover + khutbah + RHB harian). */
  function aiTotalCount(pres) {
    const p = pres && typeof pres === 'object' ? pres : {};
    return (Array.isArray(p.aiImages) ? p.aiImages.length : 0)
      + Object.keys(p.khutbahLiteral && typeof p.khutbahLiteral === 'object' ? p.khutbahLiteral : {}).length
      + Object.keys(p.rhbAi && typeof p.rhbAi === 'object' ? p.rhbAi : {}).length;
  }

  /** Folder Drive `04 Presentasi` untuk event (auto-provision bila perlu). */
  async function resolvePresentationFolder(prisma, event) {
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
    if (!division?.driveFolderId) return null;
    const subs = await listFolders(division.driveFolderId, 100);
    let target = subs.find((f) => String(f.name || '').toLowerCase() === PRESENTATION_IMAGE_SUBFOLDER.toLowerCase());
    if (!target) target = await createFolder(division.driveFolderId, PRESENTATION_IMAGE_SUBFOLDER);
    return target?.id || division.driveFolderId;
  }

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

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const studio = sanitizeStudio(week.studio);
      const render = studio.render?.[doc] || null;
      const event = await resolveEventId(prisma, week.date);

      // RBAC: role ATAU ditugaskan sebagai petugas Didaskalia (mis. Pembaca Firman) pekan ini.
      if (!canViewDoc(req, doc)) {
        const { isAssignedDidaskaliaOfficer } = await import('../lib/penatalayan-access.mjs');
        const assigned = doc === 'rhb'
          ? false
          : await isAssignedDidaskaliaOfficer(req.authUser, { eventId: event?.id || undefined, date: week.date });
        if (!assigned) {
          return res.status(403).json({
            error: doc === 'rhb' ? 'RHB hanya untuk Beyonders (mentor/mentee).' : 'Materi ini hanya untuk Mentor/Co-mentor, staf, atau petugas yang ditugaskan.',
          });
        }
      }
      res.json({
        doc,
        meta: {
          weekIndex: week.index,
          date: week.date || '',
          theme: week.mentoringTheme || week.servingTheme || week.theme || '',
          serviceType: event?.serviceType || null,
          patternName: (await resolveWeekPattern(prisma, week)).name,
          patternCode: String(week.patternCode || 'MONOLOG').toUpperCase(),
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
    requireDivision('DIDASKALIA'),
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
        const parentId = await resolvePresentationFolder(prisma, event);
        if (!parentId) return res.status(400).json({ error: 'Folder Drive Didaskalia belum siap.' });

        const buffer = Buffer.from(data, 'base64');
        if (buffer.length > 5_000_000) return res.status(413).json({ error: 'Gambar >5MB tidak didukung.' });
        const file = await uploadFile(parentId, { originalname: filename, mimetype: mime, buffer });
        res.status(201).json({ fileId: file.id, url: `/api/didaskalia/asset/${file.id}`, name: file.name });
      } catch (e) {
        if (isDriveAuthError(e)) return driveAuthExpired(res);
        res.status(500).json({ error: `Gagal mengunggah gambar: ${String(e.message || e).slice(0, 200)}` });
      }
    })
  );

  // POST /api/didaskalia/studio/:yearMonth/:weekIndex/generate-image
  // AI membuat ilustrasi cover (tanpa teks) → unggah ke Drive → set sebagai cover.
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/generate-image',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const studio = sanitizeStudio(week.studio);
      const used = Array.isArray(studio.presentation?.aiImages) ? studio.presentation.aiImages.length : 0;
      if (used >= MAX_AI_IMAGES || aiTotalCount(studio.presentation) >= MAX_AI_TOTAL) {
        return res.status(429).json({ error: `Kuota gambar AI pekan ini sudah penuh (cover ${MAX_AI_IMAGES}, total ${MAX_AI_TOTAL}). Gunakan unggah manual.`, used, max: MAX_AI_IMAGES });
      }

      const event = await resolveEventId(prisma, week.date);
      if (!event?.id) return res.status(400).json({ error: 'Belum ada event ibadah untuk pekan ini.' });

      const theme = week.mentoringTheme || week.servingTheme || week.theme || '';
      const extra = String(req.body?.prompt || '').trim().slice(0, 600);
      const stylePreset = {
        cinematic: 'Gaya sinematik hangat, cahaya lembut keemasan.',
        community: 'Suasana komunitas hangat Indonesia: kebersamaan anak muda, alami, tidak posed.',
        minimal: 'Gaya minimal: satu objek simbolik kuat dengan latar tenang, ruang kosong luas.',
      }[String(req.body?.style || '')] || '';
      const sermon = studio.sermon || {};
      const prompt = [
        'Ilustrasi sampul untuk renungan/khotbah pemuda Kristen. Komposisi sinematik, kualitas tinggi, artistik.',
        theme ? `Tema minggu: ${theme}.` : '',
        studio.fundamentalFirman?.ref ? `Ayat: ${studio.fundamentalFirman.ref}.` : '',
        studio.kitabFokus ? `Bagian Alkitab: ${studio.kitabFokus}.` : '',
        sermon.bigIdea ? `Inti pesan: ${String(sermon.bigIdea).slice(0, 300)}.` : '',
        sermon?.teksUtama?.ref ? `Teks utama khotbah: ${sermon.teksUtama.ref}.` : '',
        stylePreset,
        extra ? `Arahan tambahan: ${extra}` : '',
        'PENTING: JANGAN menulis teks/huruf/angka/watermark apa pun di dalam gambar (teks ditambahkan terpisah).',
        'Sisakan ruang kosong (negative space) di bagian atas untuk overlay judul.',
        'Warna & suasana selaras tema; relevan untuk pemuda mahasiswa dan pekerja pabrik/kantor di Indonesia.',
      ].filter(Boolean).join(' ');
      const coverStyle = ['AI', 'UPLOAD', 'MOTIF'].includes(String(req.body?.coverStyle || '').toUpperCase())
        ? String(req.body.coverStyle).toUpperCase() : 'AI';

      let img;
      try {
        img = await generateImageBase64({
          prompt,
          size: String(req.body?.size || '1024x1536'),
          quality: String(req.body?.quality || 'medium'),
        });
      } catch (e) {
        const msg = String(e.message || e);
        if (/does not have access to model|model_not_found|permission|not have access/i.test(msg)) {
          return res.status(503).json({
            error: 'Model gambar AI belum aktif untuk kunci API ini. Aktifkan akses gpt-image-1-mini di project OpenAI (atau set AI_IMAGE_MODEL), lalu coba lagi. Sementara itu gunakan unggah manual.',
            code: 'IMAGE_MODEL_UNAVAILABLE',
          });
        }
        return res.status(502).json({ error: `AI gambar gagal: ${msg.slice(0, 200)}` });
      }

      try {
        const parentId = await resolvePresentationFolder(prisma, event);
        if (!parentId) return res.status(400).json({ error: 'Folder Drive Didaskalia belum siap.' });
        const buffer = Buffer.from(img.base64, 'base64');
        const file = await uploadFile(parentId, {
          originalname: `ai-cover-${yearMonth}-w${weekIndex}-${Date.now()}.jpg`,
          mimetype: img.mediaType,
          buffer,
        });

        let savedUsed = used + 1;
        const saved = await saveStudioWeek(
          prisma,
          yearMonth,
          weekIndex,
          (w) => {
            const s = { ...w.studio };
            const pres = { ...(s.presentation || {}) };
            pres.aiImages = [...(Array.isArray(pres.aiImages) ? pres.aiImages : []), file.id];
            pres.cover = file.id;
            pres.coverStyle = coverStyle;
            savedUsed = pres.aiImages.length;
            s.presentation = pres;
            return { ...w, studio: s };
          },
          req.authUser?.id
        );

        res.status(201).json({
          fileId: file.id,
          url: `/api/didaskalia/asset/${file.id}`,
          used: savedUsed,
          max: MAX_AI_IMAGES,
          model: img.model,
          week: saved,
        });
      } catch (e) {
        // Gambar AI sudah jadi (biaya model keluar) tapi gagal tersimpan ke Drive.
        // Bedakan jelas agar tidak dikira AI rusak; kuota pekan TIDAK bertambah.
        if (isDriveAuthError(e)) return driveAuthExpired(res);
        res.status(500).json({ error: `Gambar AI jadi, tapi gagal menyimpan: ${String(e.message || e).slice(0, 200)}` });
      }
    })
  );

  // POST /api/didaskalia/studio/:yearMonth/:weekIndex/sermon-image
  // AI mengilustrasikan SATU bagian khotbah literal (prompt = isi bagian itu).
  // Kuota: sub-cap khutbah + total gabung (di luar itu: cover, RHB harian).
  // Body: { section: 'pengantar'|'bedahTeologis'|'jembatan'|'kesimpulan' }.
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/sermon-image',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const studio = sanitizeStudio(week.studio);
      const SECTION_LABEL = { pengantar: 'Pengantar', bedahTeologis: 'Bedah Teologis', jembatan: 'Jembatan ke Tema Mingguan', kesimpulan: 'Kesimpulan' };
      const section = String(req.body?.section || '');
      if (!SECTION_LABEL[section]) {
        return res.status(400).json({ error: 'Parameter section tidak valid (pengantar/bedahTeologis/jembatan/kesimpulan).' });
      }
      const haveLiteral = studio.presentation?.khutbahLiteral && typeof studio.presentation.khutbahLiteral === 'object'
        ? studio.presentation.khutbahLiteral
        : {};
      const used = Object.keys(haveLiteral).length;
      if ((used >= MAX_KHUTBAH_IMAGES || aiTotalCount(studio.presentation) >= MAX_AI_TOTAL) && !haveLiteral[section]) {
        return res.status(429).json({ error: `Kuota ilustrasi bagian khotbah pekan ini penuh (khotbah ${MAX_KHUTBAH_IMAGES}, total ${MAX_AI_TOTAL}).`, used, max: MAX_KHUTBAH_IMAGES });
      }

      const event = await resolveEventId(prisma, week.date);
      if (!event?.id) return res.status(400).json({ error: 'Belum ada event ibadah untuk pekan ini.' });
      const theme = week.mentoringTheme || week.servingTheme || week.theme || '';
      // Konteks aman untuk prompt gambar: kupas markup MD + ringkas (teks mentah
      // seperti "darah/murka" sering memicu penolakan moderasi model gambar).
      const safeContext = (text) => String(text || '')
        .replace(/[*_>#`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
      const safeStyle = 'Gaya simbolis yang damai dan penuh harapan; hindari kekerasan, darah, dan figur manusia realistis.';
      const basePrompt = [
        'Ilustrasi untuk satu slide khotbah pemuda Kristen. Komposisi sinematik, kualitas tinggi, artistik.',
        'PENTING: JANGAN menulis teks/huruf/angka/watermark apa pun di dalam gambar (teks ditambahkan terpisah sebagai overlay).',
        'Sisakan ruang kosong (negative space) di bagian atas untuk overlay judul.',
        'Warna & suasana selaras tema; relevan untuk pemuda mahasiswa dan pekerja pabrik/kantor di Indonesia.',
      ];
      let prompt;
      const fileStem = `ai-khutbah-${yearMonth}-w${weekIndex}-${section}`;
      {
        const sectionText = safeContext(studio.sermon?.outline?.[section]);
        prompt = [
          'Ilustrasi sampul bagian khotbah pemuda Kristen. Komposisi sinematik, kualitas tinggi, artistik.',
          theme ? `Tema minggu: ${theme}. Bagian: ${SECTION_LABEL[section]}.` : `Bagian: ${SECTION_LABEL[section]}.`,
          sectionText ? `Konteks isi: ${sectionText}.` : '',
          safeStyle,
          ...basePrompt.slice(1),
        ].filter(Boolean).join(' ');
      }

      let img;
      try {
        img = await generateImageBase64({ prompt, size: '1536x1024', quality: 'medium' });
      } catch (e) {
        const msg = String(e.message || e);
        if (/does not have access to model|model_not_found|permission|not have access/i.test(msg)) {
          return res.status(503).json({ error: 'Model gambar AI belum aktif untuk kunci API ini.', code: 'IMAGE_MODEL_UNAVAILABLE' });
        }
        return res.status(502).json({ error: `AI gambar gagal: ${msg.slice(0, 200)}` });
      }

      try {
        const parentId = await resolvePresentationFolder(prisma, event);
        if (!parentId) return res.status(400).json({ error: 'Folder Drive Didaskalia belum siap.' });
        const buffer = Buffer.from(img.base64, 'base64');
        const file = await uploadFile(parentId, {
          originalname: `${fileStem}-${Date.now()}.jpg`,
          mimetype: img.mediaType,
          buffer,
        });
        const saved = await saveStudioWeek(
          prisma,
          yearMonth,
          weekIndex,
          (w) => {
            const s = { ...w.studio };
            const pres = { ...(s.presentation || {}) };
            pres.khutbahLiteral = { ...((pres.khutbahLiteral && typeof pres.khutbahLiteral === 'object') ? pres.khutbahLiteral : {}), [section]: file.id };
            s.presentation = pres;
            return { ...w, studio: s };
          },
          req.authUser?.id
        );
        const savedPres = saved?.studio?.presentation || {};
        const total = Object.keys(savedPres.khutbahLiteral || {}).length;
        res.status(201).json({ fileId: file.id, url: `/api/didaskalia/asset/${file.id}`, section, used: total, max: MAX_KHUTBAH_IMAGES, model: img.model, week: saved });
      } catch (e) {
        if (isDriveAuthError(e)) return driveAuthExpired(res);
        res.status(500).json({ error: `Gambar AI jadi, tapi gagal menyimpan: ${String(e.message || e).slice(0, 200)}` });
      }
    })
  );

  // POST /api/didaskalia/studio/:yearMonth/:weekIndex/rhb-image
  // AI mengilustrasikan SATU hari RHB sesuai tema harian (prompt = judul +
  // ringkasan + nats hari itu). 1 gambar berlaku untuk SEMUA slide hari itu
  // (background + overlay teks, prinsip sama seperti khotbah).
  // Kuota: sub-cap RHB + total gabung. Body: { day: 1..7 }.
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/rhb-image',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      const yearMonth = String(req.params.yearMonth || '');
      const weekIndex = getWeekIndex(req);
      if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
      const day = Number(req.body?.day);
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        return res.status(400).json({ error: 'Parameter day tidak valid (1–7).' });
      }

      const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
      const weeks = plan ? readWeeks(plan) : [];
      const week = weekOrDefault(weeks, yearMonth, weekIndex);
      const studio = sanitizeStudio(week.studio);
      const haveRhb = studio.presentation?.rhbAi && typeof studio.presentation.rhbAi === 'object'
        ? studio.presentation.rhbAi
        : {};
      const used = Object.keys(haveRhb).length;
      if ((used >= MAX_RHB_IMAGES || aiTotalCount(studio.presentation) >= MAX_AI_TOTAL) && !haveRhb[String(day)]) {
        return res.status(429).json({ error: `Kuota ilustrasi RHB pekan ini penuh (harian ${MAX_RHB_IMAGES}, total ${MAX_AI_TOTAL}).`, used, max: MAX_RHB_IMAGES });
      }

      const event = await resolveEventId(prisma, week.date);
      if (!event?.id) return res.status(400).json({ error: 'Belum ada event ibadah untuk pekan ini.' });
      const theme = week.mentoringTheme || week.servingTheme || week.theme || '';
      const path = (studio.paths || []).find((p) => Number(p.pathIndex) === day) || {};
      // Konteks aman untuk prompt gambar: kupas markup MD + ringkas (teks mentah
      // seperti "darah/murka" sering memicu penolakan moderasi model gambar).
      const safeContext = (text) => String(text || '')
        .replace(/[*_>#`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
      const safeStyle = 'Gaya simbolis yang damai dan penuh harapan; hindari kekerasan, darah, dan figur manusia realistis.';
      const dayContext = safeContext(
        [path.title, path.summary, path.scriptureRef, path.bacaanRef].filter(Boolean).join('. ')
      );
      const fileStem = `ai-rhb-${yearMonth}-w${weekIndex}-d${day}`;
      const prompt = [
        'Ilustrasi sampul renungan harian pemuda Kristen. Komposisi sinematik, kualitas tinggi, artistik.',
        theme ? `Tema minggu: ${theme}.` : '',
        `Hari: ${path.dayLabel || `Hari ${day}`}${path.title ? ` — ${safeContext(path.title)}` : ''}.`,
        dayContext ? `Konteks isi: ${dayContext}.` : '',
        safeStyle,
        'PENTING: JANGAN menulis teks/huruf/angka/watermark apa pun di dalam gambar (teks ditambahkan terpisah sebagai overlay).',
        'Sisakan ruang kosong (negative space) di bagian atas untuk overlay judul.',
        'Warna & suasana selaras tema; relevan untuk pemuda mahasiswa dan pekerja pabrik/kantor di Indonesia.',
      ].filter(Boolean).join(' ');

      let img;
      try {
        img = await generateImageBase64({ prompt, size: '1536x1024', quality: 'medium' });
      } catch (e) {
        const msg = String(e.message || e);
        if (/does not have access to model|model_not_found|permission|not have access/i.test(msg)) {
          return res.status(503).json({ error: 'Model gambar AI belum aktif untuk kunci API ini.', code: 'IMAGE_MODEL_UNAVAILABLE' });
        }
        return res.status(502).json({ error: `AI gambar gagal: ${msg.slice(0, 200)}` });
      }

      try {
        const parentId = await resolvePresentationFolder(prisma, event);
        if (!parentId) return res.status(400).json({ error: 'Folder Drive Didaskalia belum siap.' });
        const buffer = Buffer.from(img.base64, 'base64');
        const file = await uploadFile(parentId, {
          originalname: `${fileStem}-${Date.now()}.jpg`,
          mimetype: img.mediaType,
          buffer,
        });
        const saved = await saveStudioWeek(
          prisma,
          yearMonth,
          weekIndex,
          (w) => {
            const s = { ...w.studio };
            const pres = { ...(s.presentation || {}) };
            pres.rhbAi = { ...((pres.rhbAi && typeof pres.rhbAi === 'object') ? pres.rhbAi : {}), [String(day)]: file.id };
            s.presentation = pres;
            return { ...w, studio: s };
          },
          req.authUser?.id
        );
        const savedPres = saved?.studio?.presentation || {};
        const total = Object.keys(savedPres.rhbAi || {}).length;
        res.status(201).json({ fileId: file.id, url: `/api/didaskalia/asset/${file.id}`, day, used: total, max: MAX_RHB_IMAGES, model: img.model, week: saved });
      } catch (e) {
        if (isDriveAuthError(e)) return driveAuthExpired(res);
        res.status(500).json({ error: `Gambar AI jadi, tapi gagal menyimpan: ${String(e.message || e).slice(0, 200)}` });
      }
    })
  );

  // ---------- Regenerate: pengajuan & persetujuan HOD ----------
  const regenSnapshotOf = (s) => ({
    chapterNo: s.chapterNo || '',
    fundamentalFirman: s.fundamentalFirman || { ref: '', text: '' },
    kitabFokus: s.kitabFokus || '',
    homileticMethods: s.homileticMethods || [],
    methodMix: s.methodMix || [],
    paths: s.paths || [],
    sermon: s.sermon || {},
  });

  app.get('/api/didaskalia/studio/:yearMonth/:weekIndex/approval', requireDivision('DIDASKALIA'), requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const yearMonth = String(req.params.yearMonth || '');
    const weekIndex = getWeekIndex(req);
    if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
    const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
    const week = weekOrDefault(plan ? readWeeks(plan) : [], yearMonth, weekIndex);
    const st = sanitizeStudio(week.studio);
    const { isDidaskaliaApprover } = await import('../lib/didaskalia-approval.mjs');
    res.json({
      pending: st.pendingRegen || null,
      history: (Array.isArray(st.regenHistory) ? st.regenHistory : []).slice(0, 20),
      canApprove: await isDidaskaliaApprover(req.authUser),
    });
  }));

  app.post('/api/didaskalia/studio/:yearMonth/:weekIndex/approval/approve', requireDivision('DIDASKALIA'), requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const yearMonth = String(req.params.yearMonth || '');
    const weekIndex = getWeekIndex(req);
    if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
    const { isDidaskaliaApprover } = await import('../lib/didaskalia-approval.mjs');
    if (!(await isDidaskaliaApprover(req.authUser))) return res.status(403).json({ error: 'Hanya kepala divisi Didaskalia/SUPERADMIN yang dapat menyetujui.' });
    const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
    const before = sanitizeStudio(weekOrDefault(plan ? readWeeks(plan) : [], yearMonth, weekIndex).studio);
    const pending = before.pendingRegen;
    if (!pending || pending.status !== 'PENDING') return res.status(400).json({ error: 'Tidak ada pengajuan yang menunggu persetujuan.' });

    const preRich = richnessCheck(pending.proposal || {});
    if (preRich.empty.length) {
      const where = preRich.empty.slice(0, 8).map((e) => `Path ${e.path} ${e.key}`).join(', ');
      return res.status(400).json({ error: `Usulan ditolak otomatis: ${preRich.empty.length} section RHB kosong (${where}${preRich.empty.length > 8 ? ', …' : ''}). Minta AI melengkapi dulu atau isi manual.` });
    }

    const saved = await saveStudioWeek(prisma, yearMonth, weekIndex, (w) => {
      const s = { ...w.studio };
      const p = s.pendingRegen;
      if (!p || p.status !== 'PENDING') return w;
      const snapshot = regenSnapshotOf(s);
      const prop = p.proposal || {};
      if (prop.chapterNo !== undefined) s.chapterNo = prop.chapterNo;
      if (prop.fundamentalFirman) s.fundamentalFirman = prop.fundamentalFirman;
      if (prop.kitabFokus !== undefined) s.kitabFokus = prop.kitabFokus;
      if (Array.isArray(prop.homileticMethods) && prop.homileticMethods.length) s.homileticMethods = prop.homileticMethods;
      if (Array.isArray(prop.methodMix) && prop.methodMix.length) s.methodMix = prop.methodMix;
      s.paths = sanitizePaths(prop.paths || []);
      s.sermon = sanitizeSermonShape(prop.sermon || s.sermon);
      s.generation = (Number(s.generation) || 0) + 1;
      s.regenHistory = [
        { id: p.id, at: new Date().toISOString(), byName: req.authUser?.name || null, kind: p.kind, applied: true, summary: p.summary || '', snapshot, meta: p.meta || null },
        ...(Array.isArray(s.regenHistory) ? s.regenHistory : []),
      ].slice(0, 20);
      s.pendingRegen = { ...p, status: 'APPROVED', decidedByName: req.authUser?.name || null, decidedAt: new Date().toISOString() };
      if (s.status === 'PUBLISHED') s.status = 'DRAFT';
      return { ...w, studio: s };
    }, req.authUser?.id);

    await notifyRequester(prisma, pending.requestedById, 'Regenerate disetujui', `Pengajuan ${pending.kind === 'enrich' ? 'perkaya' : 'draf'} untuk ${yearMonth} pekan ${weekIndex} disetujui & diterapkan.`);
    res.json({ week: saved, approved: true });
  }));

  app.post('/api/didaskalia/studio/:yearMonth/:weekIndex/approval/reject', requireDivision('DIDASKALIA'), requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const yearMonth = String(req.params.yearMonth || '');
    const weekIndex = getWeekIndex(req);
    const reason = String(req.body?.reason || '').trim();
    if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
    const { isDidaskaliaApprover } = await import('../lib/didaskalia-approval.mjs');
    if (!(await isDidaskaliaApprover(req.authUser))) return res.status(403).json({ error: 'Hanya kepala divisi Didaskalia/SUPERADMIN yang dapat menolak.' });
    const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
    const before = sanitizeStudio(weekOrDefault(plan ? readWeeks(plan) : [], yearMonth, weekIndex).studio);
    const pending = before.pendingRegen;
    if (!pending || pending.status !== 'PENDING') return res.status(400).json({ error: 'Tidak ada pengajuan yang menunggu persetujuan.' });

    const saved = await saveStudioWeek(prisma, yearMonth, weekIndex, (w) => {
      const s = { ...w.studio };
      const p = s.pendingRegen;
      if (!p) return w;
      s.regenHistory = [
        { id: p.id, at: new Date().toISOString(), byName: req.authUser?.name || null, kind: p.kind, applied: false, summary: `${p.summary || ''}${reason ? ` � ditolak: ${reason}` : ' � ditolak'}`, snapshot: p.proposal || regenSnapshotOf(s), meta: p.meta || null },
        ...(Array.isArray(s.regenHistory) ? s.regenHistory : []),
      ].slice(0, 20);
      s.pendingRegen = { ...p, status: 'REJECTED', reason: reason || null, decidedByName: req.authUser?.name || null, decidedAt: new Date().toISOString() };
      return { ...w, studio: s };
    }, req.authUser?.id);
    await notifyRequester(prisma, pending.requestedById, 'Regenerate ditolak', `Pengajuan untuk ${yearMonth} pekan ${weekIndex} ditolak${reason ? `: ${reason}` : '.'} Silakan revisi & ajukan ulang.`);
    res.json({ week: saved, rejected: true });
  }));

  app.post('/api/didaskalia/studio/:yearMonth/:weekIndex/regen-undo', requireDivision('DIDASKALIA'), requireRole(...WRITE_ROLES), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const yearMonth = String(req.params.yearMonth || '');
    const weekIndex = getWeekIndex(req);
    const historyId = String(req.body?.historyId || '');
    if (!ymRe.test(yearMonth) || !weekIndex) return res.status(400).json({ error: 'Parameter tidak valid.' });
    const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
    const st = sanitizeStudio(weekOrDefault(plan ? readWeeks(plan) : [], yearMonth, weekIndex).studio);
    const entry = (Array.isArray(st.regenHistory) ? st.regenHistory : []).find((h) => h.id === historyId);
    if (!entry?.snapshot) return res.status(400).json({ error: 'Riwayat versi tidak ditemukan.' });

    const saved = await saveStudioWeek(prisma, yearMonth, weekIndex, (w) => {
      const s = { ...w.studio };
      const snap = entry.snapshot;
      const currentSnap = regenSnapshotOf(s);
      if (snap.chapterNo !== undefined) s.chapterNo = snap.chapterNo;
      if (snap.fundamentalFirman) s.fundamentalFirman = snap.fundamentalFirman;
      if (snap.kitabFokus !== undefined) s.kitabFokus = snap.kitabFokus;
      if (Array.isArray(snap.homileticMethods)) s.homileticMethods = snap.homileticMethods;
      if (Array.isArray(snap.methodMix)) s.methodMix = snap.methodMix;
      s.paths = sanitizePaths(snap.paths || []);
      s.sermon = sanitizeSermonShape(snap.sermon || s.sermon);
      s.regenHistory = [
        { id: `undo-${Date.now().toString(36)}`, at: new Date().toISOString(), byName: req.authUser?.name || null, kind: 'undo', applied: true, summary: `Kembali ke versi ${new Date(entry.at).toLocaleString('id-ID')}`, snapshot: currentSnap },
        ...(Array.isArray(s.regenHistory) ? s.regenHistory : []),
      ].slice(0, 20);
      s.pendingRegen = null;
      return { ...w, studio: s };
    }, req.authUser?.id);
    res.json({ week: saved, undone: true });
  }));
  // ---------- Publish: catat versi + file Drive ----------
  app.post(
    '/api/didaskalia/studio/:yearMonth/:weekIndex/publish',
    requireDivision('DIDASKALIA'),
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
                sermon: s.sermon || { methods: [], rationale: '', summary: '', slideOutline: [], deliveryPlan: [], prepChecklist: [], discussionFlow: [] },
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
    requireDivision('DIDASKALIA'),
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
              // Pelayanan hari Minggu (Serving) → pembinaan khusus Pembaca Firman.
              rituals.push({
                type: 'READER_COACHING',
                date: mondayOfSunday(date, options.reader.offsetDays),
                timeStart: options.reader.timeStart,
                timeEnd: options.reader.timeEnd,
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