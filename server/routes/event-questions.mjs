import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import { isKoinoniaOperator } from '../lib/checkin-access.mjs';
import { BAKU_TAU_EVENT_ID, BAKU_TAU_SOURCE_EVENT } from '../lib/baku-tau.mjs';
import { resolveEventBySlug, SLUG_TO_EVENT_ID } from './events-public.mjs';
import { QUESTION_TYPES, bankId } from '../lib/event-question-bank.mjs';
import {
  asalFromOrigin,
  csvEscape,
  formatAnswerCsv,
  isQuestionVisible,
} from '../lib/event-question-showif.mjs';

const qId = () => `eqn-${crypto.randomUUID()}`;
const asgId = () => `eqa-${crypto.randomUUID()}`;
const reqId = () => `eqr-${crypto.randomUUID()}`;

function parseOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function serializeQuestion(row, extra = {}) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    hint: row.hint || null,
    type: row.type,
    options: parseOptions(row.options),
    ownerDivision: row.ownerDivision,
    ownerSubdivision: row.ownerSubdivision,
    showIf: row.showIf || null,
    status: row.status,
    sortOrder: row.sortOrder,
    ...extra,
  };
}

async function resolveEvent(prisma, slugOrId) {
  const raw = String(slugOrId || '').trim();
  const lower = raw.toLowerCase();
  const mappedId = SLUG_TO_EVENT_ID[lower];
  if (mappedId) {
    const event = await prisma.eventProgram.findUnique({ where: { id: mappedId } }).catch(() => null);
    return event ? { id: event.id, event } : { id: mappedId, event: null };
  }
  const resolved = await resolveEventBySlug(prisma, lower).catch(() => null);
  if (resolved?.event) return { id: resolved.eventId, event: resolved.event };
  const byId = await prisma.eventProgram.findUnique({ where: { id: raw } }).catch(() => null);
  if (byId) return { id: byId.id, event: byId };
  return null;
}

async function isRegistered(prisma, eventId, userId) {
  if (!userId) return false;
  const attendeeP = prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
  }).catch(() => null);
  if (eventId !== BAKU_TAU_EVENT_ID) return !!(await attendeeP);
  const [attendee, pool] = await Promise.all([
    attendeeP,
    prisma.waitingPool.findFirst({
      where: { userId, sourceEvent: BAKU_TAU_SOURCE_EVENT },
    }).catch(() => null),
  ]);
  return !!(attendee || pool);
}

function validateValue(question, value) {
  const type = question.type;
  if (type === 'BOOLEAN') {
    if (typeof value !== 'boolean') return 'Jawaban harus ya/tidak.';
    return null;
  }
  if (type === 'TEXT') {
    if (value == null) return null;
    if (typeof value !== 'string') return 'Jawaban harus teks.';
    return null;
  }
  const options = parseOptions(question.options);
  if (type === 'SELECT') {
    if (value == null || value === '') return null;
    if (!options.includes(String(value))) return 'Pilihan tidak valid.';
    return null;
  }
  if (type === 'MULTI') {
    if (value == null) return null;
    if (!Array.isArray(value)) return 'Jawaban harus daftar.';
    if (value.some((v) => !options.includes(String(v)))) return 'Pilihan tidak valid.';
    return null;
  }
  return 'Tipe soal tidak didukung.';
}

function slugKey(label) {
  const s = String(label || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return s || 'soal';
}

async function upsertAnswers(prisma, eventId, userId, answersMap, questionsById) {
  const rows = [];
  for (const [questionId, value] of Object.entries(answersMap || {})) {
    if (value === undefined) continue;
    const q = questionsById.get(questionId);
    if (!q) return { error: `Soal ${questionId} tidak ditemukan.`, status: 400 };
    if (q.status && q.status !== 'ACTIVE') return { error: 'Soal tidak aktif.', status: 400 };
    const err = validateValue(q, value);
    if (err) return { error: `${q.label}: ${err}`, status: 400 };
    rows.push({
      id: qId(),
      eventId,
      userId,
      questionId,
      value,
    });
  }
  if (!rows.length) return { ok: true, count: 0 };
  await prisma.eventQuestionAnswer.deleteMany({
    where: { eventId, userId, questionId: { in: rows.map((r) => r.questionId) } },
  });
  await prisma.eventQuestionAnswer.createMany({ data: rows });
  return { ok: true, count: rows.length };
}

function answersByKeyFromRows(questions, answers) {
  const byId = new Map(questions.map((q) => [q.id, q.key]));
  const out = {};
  for (const a of answers) {
    const key = byId.get(a.questionId);
    if (key) out[key] = a.value;
  }
  return out;
}

export function registerEventQuestionRoutes(app, { wrap }) {
  app.get(
    '/api/event-questions/bank',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const includeInactive = isKomisiOrSuperadmin(req.authUser);
      const rows = await prisma.eventQuestionBank.findMany({
        where: includeInactive ? {} : { status: 'ACTIVE' },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      });
      res.json({ questions: rows.map((r) => serializeQuestion(r)) });
    }),
  );

  app.post(
    '/api/event-questions/requests',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const label = String(req.body?.label || '').trim();
      const type = String(req.body?.type || 'TEXT').toUpperCase();
      if (!label) return res.status(400).json({ error: 'Label soal wajib.' });
      if (!QUESTION_TYPES.includes(type)) return res.status(400).json({ error: 'Tipe soal tidak valid.' });
      const options = parseOptions(req.body?.options);
      if ((type === 'SELECT' || type === 'MULTI') && options.length < 2) {
        return res.status(400).json({ error: 'SELECT/MULTI butuh minimal 2 opsi.' });
      }
      const created = await prisma.eventQuestionRequest.create({
        data: {
          id: reqId(),
          label: label.slice(0, 190),
          hint: req.body?.hint ? String(req.body.hint).slice(0, 500) : null,
          type,
          options: options.length ? options : undefined,
          ownerDivision: String(req.body?.ownerDivision || 'KOINONIA').slice(0, 24),
          ownerSubdivision: String(req.body?.ownerSubdivision || 'Program & Acara').slice(0, 80),
          reason: req.body?.reason ? String(req.body.reason).slice(0, 500) : null,
          createdById: req.authUser.id,
        },
      });
      res.status(201).json({ request: created });
    }),
  );

  app.get(
    '/api/event-questions/requests',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const pendingOnly = !isKomisiOrSuperadmin(req.authUser) || String(req.query.status || 'PENDING') === 'PENDING';
      const rows = await prisma.eventQuestionRequest.findMany({
        where: pendingOnly ? { status: 'PENDING' } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 80,
      });
      res.json({ requests: rows });
    }),
  );

  app.post(
    '/api/event-questions/requests/:id/approve',
    requireRole('SUPERADMIN', 'KOMISI'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const existing = await prisma.eventQuestionRequest.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Usulan tidak ditemukan.' });
      if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Usulan sudah ditinjau.' });

      let key = slugKey(existing.label);
      const clash = await prisma.eventQuestionBank.findUnique({ where: { key } });
      if (clash) key = `${key}_${crypto.randomBytes(2).toString('hex')}`;

      const last = await prisma.eventQuestionBank.findFirst({ orderBy: { sortOrder: 'desc' } });
      const question = await prisma.eventQuestionBank.create({
        data: {
          id: bankId(key),
          key,
          label: existing.label,
          hint: existing.hint,
          type: existing.type,
          options: existing.options ?? undefined,
          ownerDivision: existing.ownerDivision,
          ownerSubdivision: existing.ownerSubdivision,
          status: 'ACTIVE',
          sortOrder: (last?.sortOrder || 0) + 10,
        },
      });
      const request = await prisma.eventQuestionRequest.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED',
          reviewedById: req.authUser.id,
          reviewedAt: new Date(),
          approvedQuestionId: question.id,
          adminNote: req.body?.adminNote ? String(req.body.adminNote).slice(0, 500) : null,
        },
      });
      res.json({ request, question: serializeQuestion(question) });
    }),
  );

  app.post(
    '/api/event-questions/requests/:id/reject',
    requireRole('SUPERADMIN', 'KOMISI'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const existing = await prisma.eventQuestionRequest.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Usulan tidak ditemukan.' });
      if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Usulan sudah ditinjau.' });
      const request = await prisma.eventQuestionRequest.update({
        where: { id: existing.id },
        data: {
          status: 'REJECTED',
          reviewedById: req.authUser.id,
          reviewedAt: new Date(),
          adminNote: req.body?.adminNote ? String(req.body.adminNote).slice(0, 500) : null,
        },
      });
      res.json({ request });
    }),
  );

  app.get(
    '/api/events/:id/questions',
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const operator = await isKoinoniaOperator(req.authUser);
      const asgs = await prisma.eventQuestionAssignment.findMany({
        where: { eventId: resolved.id, ...(operator ? {} : { enabled: true }) },
        include: { question: true },
        orderBy: { sortOrder: 'asc' },
      });
      const questions = asgs
        .filter((a) => a.question && (operator || a.question.status === 'ACTIVE'))
        .map((a) => serializeQuestion(a.question, { assignmentId: a.id, enabled: a.enabled, sortOrder: a.sortOrder }));
      res.json({ questions });
    }),
  );

  app.put(
    '/api/events/:id/questions',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      if (!(await isKoinoniaOperator(req.authUser))) {
        return res.status(403).json({ error: 'Hanya operator Koinonia / Tim Kerja yang boleh mengatur soal.' });
      }
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const questionIds = Array.isArray(req.body?.questionIds)
        ? [...new Set(req.body.questionIds.map((x) => String(x)))]
        : [];
      const bank = questionIds.length
        ? await prisma.eventQuestionBank.findMany({ where: { id: { in: questionIds }, status: 'ACTIVE' } })
        : [];
      if (bank.length !== questionIds.length) {
        return res.status(400).json({ error: 'Ada soal yang tidak valid atau tidak aktif.' });
      }
      await prisma.eventQuestionAssignment.deleteMany({ where: { eventId: resolved.id } });
      if (questionIds.length) {
        await prisma.eventQuestionAssignment.createMany({
          data: questionIds.map((qid, i) => ({
            id: asgId(),
            eventId: resolved.id,
            questionId: qid,
            sortOrder: (i + 1) * 10,
            enabled: true,
          })),
        });
      }
      const asgs = await prisma.eventQuestionAssignment.findMany({
        where: { eventId: resolved.id },
        include: { question: true },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({
        questions: asgs.map((a) => serializeQuestion(a.question, { assignmentId: a.id, enabled: a.enabled, sortOrder: a.sortOrder })),
      });
    }),
  );

  app.get(
    '/api/me/events/:id/answers',
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      if (!(await isRegistered(prisma, resolved.id, req.authUser.id))) {
        return res.status(403).json({ error: 'Daftar kehadiran dulu untuk mengisi data panitia.' });
      }
      const rows = await prisma.eventQuestionAnswer.findMany({
        where: { eventId: resolved.id, userId: req.authUser.id },
      });
      const answers = {};
      for (const r of rows) answers[r.questionId] = r.value;
      res.json({ answers });
    }),
  );

  app.put(
    '/api/me/events/:id/answers',
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      if (!(await isRegistered(prisma, resolved.id, req.authUser.id))) {
        return res.status(403).json({ error: 'Daftar kehadiran dulu untuk mengisi data panitia.' });
      }
      const asgs = await prisma.eventQuestionAssignment.findMany({
        where: { eventId: resolved.id, enabled: true },
        include: { question: true },
      });
      const byId = new Map(asgs.filter((a) => a.question?.status === 'ACTIVE').map((a) => [a.questionId, a.question]));
      const result = await upsertAnswers(prisma, resolved.id, req.authUser.id, req.body?.answers || {}, byId);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/events/:id/answers',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      if (!(await isKoinoniaOperator(req.authUser))) {
        return res.status(403).json({ error: 'Akses ditolak.' });
      }
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const rows = await prisma.eventQuestionAnswer.findMany({
        where: { eventId: resolved.id },
        select: { userId: true, questionId: true, value: true },
      });
      res.json({ answers: rows });
    }),
  );

  app.put(
    '/api/events/:id/answers/:userId',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      if (!(await isKoinoniaOperator(req.authUser))) {
        return res.status(403).json({ error: 'Hanya operator Koinonia yang boleh mengisi atas nama peserta.' });
      }
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const userId = String(req.params.userId);
      if (!(await isRegistered(prisma, resolved.id, userId))) {
        return res.status(400).json({ error: 'Peserta belum terdaftar di event ini.' });
      }
      const asgs = await prisma.eventQuestionAssignment.findMany({
        where: { eventId: resolved.id, enabled: true },
        include: { question: true },
      });
      const byId = new Map(asgs.filter((a) => a.question?.status === 'ACTIVE').map((a) => [a.questionId, a.question]));
      const result = await upsertAnswers(prisma, resolved.id, userId, req.body?.answers || {}, byId);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/events/:id/answers/export',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      if (!(await isKoinoniaOperator(req.authUser))) {
        return res.status(403).json({ error: 'Akses ditolak.' });
      }
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEvent(prisma, req.params.id);
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

      const [asgs, attendees, answerRows] = await Promise.all([
        prisma.eventQuestionAssignment.findMany({
          where: { eventId: resolved.id, enabled: true },
          include: { question: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.eventAttendee.findMany({
          where: { eventId: resolved.id },
          include: {
            user: {
              select: {
                id: true, name: true, email: true, phone: true,
                gender: true, origin: true, domicileKind: true, domicileDetail: true,
              },
            },
          },
          orderBy: { registeredAt: 'asc' },
          take: 5000,
        }),
        prisma.eventQuestionAnswer.findMany({
          where: { eventId: resolved.id },
          select: { userId: true, questionId: true, value: true },
        }),
      ]);

      const questions = asgs.filter((a) => a.question?.status === 'ACTIVE').map((a) => a.question);
      const byUser = new Map();
      for (const a of answerRows) {
        if (!byUser.has(a.userId)) byUser.set(a.userId, {});
        byUser.get(a.userId)[a.questionId] = a.value;
      }

      const headers = [
        'name', 'email', 'phone', 'gender', 'asalRegion', 'asalPlace', 'origin', 'domicileKind', 'domicileDetail',
        ...questions.map((q) => q.key),
      ];
      const lines = [headers.map(csvEscape).join(',')];
      for (const row of attendees) {
        const u = row.user || {};
        const asal = asalFromOrigin(u.origin);
        const ans = byUser.get(u.id) || {};
        const visibleMap = answersByKeyFromRows(questions, Object.entries(ans).map(([questionId, value]) => ({ questionId, value })));
        const cells = [
          u.name, u.email, u.phone, u.gender, asal.asalRegion, asal.asalPlace, u.origin, u.domicileKind, u.domicileDetail,
          ...questions.map((q) => {
            if (!isQuestionVisible(q, visibleMap)) return '';
            return formatAnswerCsv(ans[q.id]);
          }),
        ];
        lines.push(cells.map(csvEscape).join(','));
      }

      const slug = resolved.event?.slug || resolved.id;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="event-${slug}-answers.csv"`);
      res.send(`\uFEFF${lines.join('\n')}`);
    }),
  );
}
