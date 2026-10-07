/**
 * F5 — Pola Ibadah & Mentoring Day (Didaskalia).
 *
 * Katalog pola (WorshipPattern) + sesi hari-H (WorshipSession) + modul interaktif:
 * likert (skor kerentanan → alokasi ruang), timer server-authoritative,
 * notes (di klien), chips → word cloud. Proyektor read-only via kode sesi.
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { requireDivision } from '../lib/division-access.mjs';
import { csvEscape } from '../lib/event-question-showif.mjs';
import { resolveHostContext } from '../lib/host-context.mjs';
import { classifyPoolRole, composePicks } from '../lib/testimony.mjs';
import { cleanFgd, cleanRounds, cleanScreening, cleanSong, cleanTeams } from '../lib/session-stage.mjs';

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
const YOUTH_TENANT = 'tenant-youth';
const STATUSES = ['DRAFT', 'LIKERT_OPEN', 'RUNNING', 'WRAPUP', 'CLOSED'];
const uid = (p) => `${p}-${crypto.randomUUID()}`;

const str = (v, max = 300) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const intOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const clampScale = (v) => {
  const n = intOrNull(v);
  return n !== null && n >= 1 && n <= 5 ? n : null;
};

const isSuperadmin = (req) =>
  (req.authUser?.rolesAll || req.authUser?.roles || []).some((r) => r.role === 'SUPERADMIN');
const isYouthPortal = (req) => resolveHostContext(req).tenantId === YOUTH_TENANT;
const canParticipate = (req) => isYouthPortal(req) || isSuperadmin(req);

const DEFAULT_FLOORS = [
  { floor: 1, label: 'Lantai 1' },
  { floor: 2, label: 'Lantai 2' },
  { floor: 3, label: 'Lantai 3' },
];
const DEFAULT_RANK_FLOORS = [2, 1, 3];

export function normalizeConfig(raw, patternCode) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const code = String(patternCode || c.patternCode || '').toUpperCase();
  const isPost = !code || code === 'POST_TO_POST';
  const floors = Array.isArray(c.floors) && c.floors.length ? c.floors : DEFAULT_FLOORS;
  const rankFloors =
    Array.isArray(c.rankFloors) && c.rankFloors.length === floors.length ? c.rankFloors : DEFAULT_RANK_FLOORS;
  return {
    timerSeconds: intOrNull(c.timerSeconds) || 1200,
    floors: floors.map((f) => ({
      floor: intOrNull(f.floor) || 1,
      label: str(f.label, 60) || `Lantai ${f.floor}`,
      venueId: str(f.venueId, 64),
      capacity: Math.max(0, intOrNull(f.capacity) || 0),
    })),
    rankFloors: rankFloors.map((n) => intOrNull(n) || 1),
    topics: !isPost
      ? []
      : Array.isArray(c.topics)
        ? c.topics
            .map((t) => ({
              code: String(t?.code || '').toUpperCase().slice(0, 40),
              label: str(t?.label, 120) || String(t?.code || ''),
              pic: str(t?.pic, 120),
            }))
            .filter((t) => t.code)
        : [],
    affirmations: !isPost ? {} : c.affirmations && typeof c.affirmations === 'object' ? c.affirmations : {},
    chipLimit: intOrNull(c.chipLimit) || 3,
    expectedCount: intOrNull(c.expectedCount) || null,
    // Draft sesi hari-H per pola (diisi tab Draft Sesi Studio; tanpa migrasi skema).
    draft: c.draft && typeof c.draft === 'object' && !Array.isArray(c.draft) ? c.draft : null,
    // Hasil undian kesaksian (modul testimony; ditulis endpoint testimony).
    testimony: c.testimony && typeof c.testimony === 'object' && !Array.isArray(c.testimony) ? c.testimony : null,
    // Status panggung live (modul rounds / screening / teams; ditulis endpoint stage).
    rounds: c.rounds && typeof c.rounds === 'object' && !Array.isArray(c.rounds) ? c.rounds : null,
    screening: c.screening && typeof c.screening === 'object' && !Array.isArray(c.screening) ? c.screening : null,
    teams: c.teams && typeof c.teams === 'object' && !Array.isArray(c.teams) ? c.teams : null,
    // Lagu bedah pekan ini (MONOLOG gabungan; diisi tab Draft Sesi).
    song: c.song && typeof c.song === 'object' && !Array.isArray(c.song) ? c.song : null,
    // Trigger pertanyaan mentor (MONOLOG gabungan; ditulis endpoint stage).
    fgd: c.fgd && typeof c.fgd === 'object' && !Array.isArray(c.fgd) ? c.fgd : null,
  };
}

/** Lagu bedah dari draft/config sesi (fallback kosong). */
export function sessionSong(config) {
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  const fromDraft = draft.song && typeof draft.song === 'object' ? draft.song : {};
  const live = config.song && typeof config.song === 'object' ? config.song : {};
  const pick = (obj, keys) => {
    for (const k of keys) {
      const v = String(obj[k] || '').trim();
      if (v) return v;
    }
    return '';
  };
  return {
    title: pick(live, ['title']) || pick(fromDraft, ['song-title', 'title']) || '',
    about: pick(live, ['about']) || pick(fromDraft, ['song-about', 'about']) || '',
    singer: pick(live, ['singer']) || pick(fromDraft, ['song-writer', 'song-singer', 'singer']) || '',
    bookRef: pick(live, ['bookRef']) || pick(fromDraft, ['song-book-ref', 'bookRef']) || '',
    writer: pick(live, ['writer']) || pick(fromDraft, ['song-writer', 'writer']) || '',
    story: pick(live, ['story']) || pick(fromDraft, ['song-story', 'story']) || '',
    songId: pick(live, ['songId']) || pick(fromDraft, ['song-id', 'songId']) || '',
  };
}

/** 2 pertanyaan deep sharing dari draft sesi (fallback generik bila kosong). */
export function deepGuide(config) {
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  const deep = draft.deep && typeof draft.deep === 'object' ? draft.deep : {};
  const pick = (obj, keys) => {
    for (const k of keys) {
      const v = String(obj[k] || '').trim();
      if (v) return v;
    }
    return '';
  };
  return [
    pick(deep, ['deep-q1', 'q1']) || 'Di mana kamu melihat dirimu dalam teks pekan ini?',
    pick(deep, ['deep-q2', 'q2']) || 'Langkah pulang apa minggu ini?',
  ];
}

/** Status trigger Q mentor (0 = belum dibuka; 1-5 = Q ke-n terbuka). */
export function fgdState(config) {
  const f = config.fgd && typeof config.fgd === 'object' ? config.fgd : {};
  const n = Math.min(5, Math.max(0, Number(f.currentQ) || 0));
  return {
    currentQ: n,
    triggerBy: String(f.triggerBy || '').slice(0, 20) || null,
    triggerName: String(f.triggerName || '').slice(0, 80) || null,
  };
}

/** Agregasi Satu Kata: hitung jawaban SATU-KATA per sesi (top 20, case-insensitive). */
export async function oneWordAggregate(prisma, sessionId, limit = 20) {
  const rows = await prisma.worshipNote
    .findMany({ where: { sessionId, topicCode: 'SATU-KATA' }, select: { content: true } })
    .catch(() => []);
  const counts = new Map();
  for (const r of rows) {
    const w = String(r.content || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!w) continue;
    const key = w.toLowerCase();
    counts.set(key, { text: w, count: (counts.get(key)?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Kode slot catatan yang boleh diisi peserta: topik sesi + KESIMPULAN +
 * KOMITMEN + kunci template draft (FGD-OBSERVE, FILM-Q1, dsb. — uppercase).
 */
export function allowedNoteCodes(config) {
  const set = new Set([...(config.topics || []).map((t) => t.code), 'KESIMPULAN', 'KOMITMEN', 'SATU-KATA']);
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  for (const fields of Object.values(draft)) {
    if (!fields || typeof fields !== 'object') continue;
    for (const k of Object.keys(fields)) {
      const code = String(k).toUpperCase().replace(/[^A-Z0-9-]/g, '-').slice(0, 40);
      if (code) set.add(code);
    }
  }
  return set;
}

/** Pertanyaan panduan FGD dari draft sesi (fallback generik bila kosong). */
export function fgdGuide(config) {
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  const fgd = draft.fgd && typeof draft.fgd === 'object' ? draft.fgd : {};
  const pick = (obj, keys) => {
    for (const k of keys) {
      const v = String(obj[k] || '').trim();
      if (v) return v;
    }
    return '';
  };
  return [
    pick(fgd, ['fgd-observe', 'observe', 'q1']) || 'Apa kata teks yang kita baca bersama?',
    pick(fgd, ['fgd-interpret', 'interpret', 'q2']) || 'Apa artinya bagi tema pekan ini?',
    pick(fgd, ['fgd-apply', 'apply', 'q3']) || 'Apa satu langkah nyatamu minggu ini?',
  ];
}

function floorEntry(config, floor) {
  return (config.floors || []).find((f) => f.floor === floor) || null;
}

function floorLabel(config, floor) {
  return floorEntry(config, floor)?.label || `Lantai ${floor}`;
}

/** Ranking topik dari total kerentanan (Σ 6 − skor); tie-break urutan config. */
export function rankTopics(totals, config) {
  const order = config.topics.map((t) => t.code);
  return [...order].sort((a, b) => {
    const d = (totals[b] || 0) - (totals[a] || 0);
    return d !== 0 ? d : order.indexOf(a) - order.indexOf(b);
  });
}

function buildRooms(ranked, totals, priorityCount, config) {
  return ranked.map((code, idx) => {
    const floor = config.rankFloors[idx] ?? DEFAULT_RANK_FLOORS[idx] ?? 1;
    const entry = floorEntry(config, floor);
    const capacity = Math.max(0, Number(entry?.capacity) || 0);
    const count = priorityCount[code] || 0;
    return {
      code,
      label: config.topics.find((t) => t.code === code)?.label || code,
      floor,
      floorLabel: floorLabel(config, floor),
      venue: entry?.venueId
        ? { id: entry.venueId, name: entry.label, capacity }
        : null,
      capacity,
      isFull: capacity > 0 && count >= capacity,
      rank: idx + 1,
      total: totals[code] || 0,
      count,
    };
  });
}

/**
 * Auto-transisi RUNNING → WRAPUP saat waktu sesi habis (lazy, idempoten).
 * Dipanggil pada pembacaan state agar segmen Lesson Learned terbuka tanpa
 * bergantung pada trigger admin.
 */
export async function ensureAutoState(prisma, session) {
  if (!session || session.status !== 'RUNNING' || !session.startedAt) return session;
  const config = normalizeConfig(session.config, session.pattern?.code);
  const endsAtMs = new Date(session.startedAt).getTime() + config.timerSeconds * 1000;
  if (Date.now() < endsAtMs) return session;
  try {
    return await prisma.worshipSession.update({
      where: { id: session.id },
      data: { status: 'WRAPUP', wrapUpAt: new Date(endsAtMs) },
    });
  } catch {
    return session;
  }
}

/**
 * Auto-closed sesi lewat tanggal (lazy, idempoten): LIKERT_OPEN/RUNNING/WRAPUP
 * yang sessionDate-nya sudah lewat hari ini WIB → CLOSED. DRAFT tidak disentuh
 * agar draf pekan berjalan tidak terkunci. Dipanggil pada pembacaan detail/list.
 */
export async function ensureAutoClosed(prisma, session) {
  if (!session || !session.sessionDate) return session;
  const st = String(session.status || '').toUpperCase();
  if (!['LIKERT_OPEN', 'RUNNING', 'WRAPUP'].includes(st)) return session;
  const day = String(session.sessionDate).slice(0, 10);
  const todayWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  if (day >= todayWib) return session;
  try {
    return await prisma.worshipSession.update({
      where: { id: session.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  } catch {
    return session;
  }
}

async function loadAggregates(prisma, session) {
  const config = normalizeConfig(session.config, session.pattern?.code);
  const [responses, votes, chips] = await Promise.all([
    prisma.worshipLikertResponse.findMany({
      where: { sessionId: session.id },
      select: { userId: true, topicCode: true, value: true },
    }),
    prisma.worshipChipVote.findMany({
      where: { sessionId: session.id },
      select: { userId: true, chipCode: true },
    }),
    prisma.worshipChip.findMany({ where: { sessionId: session.id }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const totals = {};
  const perUser = new Map();
  for (const r of responses) {
    const vuln = 6 - Number(r.value || 0);
    totals[r.topicCode] = (totals[r.topicCode] || 0) + vuln;
    if (!perUser.has(r.userId)) perUser.set(r.userId, {});
    const u = perUser.get(r.userId);
    u[r.topicCode] = (u[r.topicCode] || 0) + vuln;
  }

  const ranked = rankTopics(totals, config);
  const priorityCount = {};
  for (const [, topics] of perUser) {
    const best = rankTopics(topics, config)[0];
    if (best) priorityCount[best] = (priorityCount[best] || 0) + 1;
  }

  const voteCounts = {};
  for (const v of votes) voteCounts[v.chipCode] = (voteCounts[v.chipCode] || 0) + 1;
  const wordcloud = chips
    .map((c) => ({ code: c.code, label: c.label, count: voteCounts[c.code] || 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    config,
    ranked,
    totals,
    perUser,
    submitted: perUser.size,
    rooms: buildRooms(ranked, totals, priorityCount, config),
    wordcloud,
    chipVotes: votes,
  };
}

function timerPayload(session, config) {
  const now = Date.now();
  const startedMs = session.startedAt ? new Date(session.startedAt).getTime() : null;
  const running = session.status === 'RUNNING' && startedMs !== null;
  const elapsed = running ? Math.max(0, Math.floor((now - startedMs) / 1000)) : 0;
  const remaining = running ? Math.max(0, config.timerSeconds - elapsed) : config.timerSeconds;
  return {
    serverNow: new Date(now).toISOString(),
    startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
    timerSeconds: config.timerSeconds,
    elapsed,
    remaining,
  };
}

function publicPattern(pattern) {
  if (!pattern) return null;
  return {
    code: pattern.code,
    name: pattern.name,
    summary: pattern.summary,
    defaultDurationMin: pattern.defaultDurationMin,
    phases: pattern.phases || [],
    modules: pattern.modules || [],
  };
}


/**
 * Hapus sesi DRAFT kosong (guard + cascade). Dipakai endpoint DELETE dan
 * reset-pattern Studio. Melempar { status, message } bila ditolak.
 */
export async function deleteEmptySession(prisma, session) {
  if (!session) {
    const e = new Error('Sesi tidak ditemukan.');
    e.status = 404;
    throw e;
  }
  if (String(session.status || '').toUpperCase() !== 'DRAFT') {
    const e = new Error(`Sesi berstatus ${session.status} — hanya sesi DRAFT yang bisa dihapus.`);
    e.status = 409;
    throw e;
  }
  const [respCount, voteCount, noteCount] = await Promise.all([
    prisma.worshipLikertResponse.count({ where: { sessionId: session.id } }),
    prisma.worshipChipVote.count({ where: { sessionId: session.id } }),
    prisma.worshipNote.count({ where: { sessionId: session.id } }).catch(() => 0),
  ]);
  if (respCount > 0 || voteCount > 0 || noteCount > 0) {
    const e = new Error('Sesi sudah berisi jawaban/vote/catatan peserta — tidak bisa dihapus.');
    e.status = 409;
    throw e;
  }
  const itemRows = await prisma.worshipLikertItem.findMany({ where: { sessionId: session.id }, select: { id: true } });
  const itemIds = itemRows.map((r) => r.id);
  await prisma.$transaction([
    ...(itemIds.length ? [prisma.worshipLikertResponse.deleteMany({ where: { itemId: { in: itemIds } } })] : []),
    prisma.worshipLikertItem.deleteMany({ where: { sessionId: session.id } }),
    prisma.worshipChipVote.deleteMany({ where: { sessionId: session.id } }),
    prisma.worshipChip.deleteMany({ where: { sessionId: session.id } }),
    prisma.worshipNote.deleteMany({ where: { sessionId: session.id } }),
    prisma.worshipSession.delete({ where: { id: session.id } }),
  ]);
  return { slug: session.slug };
}

/** Cari sesi berdasarkan id ATAU slug (endpoint admin menerima keduanya). */
async function findSession(prisma, key) {
  const k = String(key || "");
  if (!k) return null;
  const byId = await prisma.worshipSession.findUnique({ where: { id: k } }).catch(() => null);
  if (byId) return byId;
  return prisma.worshipSession.findUnique({ where: { slug: k } }).catch(() => null);
}

/**
 * Alihkan pola sesi di tempat (slug + link tetap). Guard: hanya DRAFT tanpa
 * data peserta. Isi organizer pola lama ikut dibuang. Melempar { status, message }.
 */
export async function convertSessionPattern(prisma, sessionId, targetCode) {
  const session = await findSession(prisma, sessionId);
  if (!session) {
    const e = new Error('Sesi tidak ditemukan.');
    e.status = 404;
    throw e;
  }
  if (String(session.status || '').toUpperCase() !== 'DRAFT') {
    const e = new Error(`Sesi berstatus ${session.status} — hanya sesi DRAFT yang bisa dialihkan polanya.`);
    e.status = 409;
    throw e;
  }
  const code = String(targetCode || '').toUpperCase();
  const full = await prisma.worshipSession.findUnique({
    where: { id: session.id },
    include: { pattern: { select: { code: true } } },
  });
  const fromCode = String(full?.pattern?.code || '').toUpperCase();
  if (!code) {
    const e = new Error('patternCode wajib.');
    e.status = 400;
    throw e;
  }
  if (fromCode === code) {
    const e = new Error(`Sesi sudah berpola ${fromCode}.`);
    e.status = 400;
    throw e;
  }
  const target = await prisma.worshipPattern.findUnique({ where: { code } });
  if (!target) {
    const e = new Error('Pola tujuan tidak ditemukan.');
    e.status = 400;
    throw e;
  }
  const [respCount, voteCount, noteCount] = await Promise.all([
    prisma.worshipLikertResponse.count({ where: { sessionId: session.id } }),
    prisma.worshipChipVote.count({ where: { sessionId: session.id } }),
    prisma.worshipNote.count({ where: { sessionId: session.id } }).catch(() => 0),
  ]);
  if (respCount > 0 || voteCount > 0 || noteCount > 0) {
    const e = new Error('Sudah ada data peserta — sesi tidak bisa dialihkan polanya.');
    e.status = 409;
    throw e;
  }
  const prev = normalizeConfig(session.config, fromCode);
  const cfg = normalizeConfig(
    {
      timerSeconds: prev.timerSeconds,
      floors: prev.floors,
      rankFloors: prev.rankFloors,
      expectedCount: prev.expectedCount,
      chipLimit: prev.chipLimit,
      draft: null,
    },
    code,
  );
  const legacyItems = await prisma.worshipLikertItem.findMany({
    where: { sessionId: session.id },
    select: { id: true },
  });
  const legacyIds = legacyItems.map((r) => r.id);
  const legacyChips = await prisma.worshipChip.findMany({
    where: { sessionId: session.id },
    select: { code: true },
  });
  const legacyCodes = legacyChips.map((c) => c.code);
  await prisma.$transaction([
    ...(legacyIds.length
      ? [prisma.worshipLikertResponse.deleteMany({ where: { itemId: { in: legacyIds } } })]
      : []),
    prisma.worshipLikertItem.deleteMany({ where: { sessionId: session.id } }),
    ...(legacyCodes.length
      ? [prisma.worshipChipVote.deleteMany({ where: { sessionId: session.id, chipCode: { in: legacyCodes } } })]
      : []),
    prisma.worshipChip.deleteMany({ where: { sessionId: session.id } }),
    prisma.worshipSession.update({
      where: { id: session.id },
      data: { patternId: target.id, config: cfg },
    }),
  ]);
  return { from: fromCode, to: code, slug: session.slug };
}

export function registerWorshipRoutes(app, { wrap }) {
  // ---------------- Peserta ----------------

  app.get(
    '/api/worship/session/:slug',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) {
        return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });
      }
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug) },
        include: { pattern: true },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timed = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timed);

      const config = normalizeConfig(live.config, live.pattern?.code);
      const [items, myResponses, myVotes, myNotes] = await Promise.all([
        prisma.worshipLikertItem.findMany({ where: { sessionId: live.id }, orderBy: { sortOrder: 'asc' } }),
        prisma.worshipLikertResponse.findMany({ where: { sessionId: live.id, userId: req.authUser.id } }),
        prisma.worshipChipVote.findMany({ where: { sessionId: live.id, userId: req.authUser.id } }),
        prisma.worshipNote.findMany({ where: { sessionId: live.id, userId: req.authUser.id } }).catch(() => []),
      ]);
      const agg = await loadAggregates(prisma, live);
      const notes = {};
      for (const n of myNotes) notes[n.topicCode] = n.content;

      const myValues = {};
      for (const r of myResponses) myValues[r.itemId] = r.value;
      let myResult = null;
      const mine = agg.perUser.get(req.authUser.id);
      if (mine) {
        const best = rankTopics(mine, config)[0];
        const idx = agg.ranked.indexOf(best);
        const floor = config.rankFloors[idx] ?? 1;
        const entry = floorEntry(config, floor);
        myResult = {
          topicCode: best,
          topicLabel: config.topics.find((t) => t.code === best)?.label || best,
          floor,
          floorLabel: floorLabel(config, floor),
          venue: entry?.venueId
            ? { id: entry.venueId, name: entry.label, capacity: Math.max(0, Number(entry.capacity) || 0) }
            : null,
          vulnerability: mine[best] || 0,
          affirmations: config.affirmations?.[best] || [],
        };
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        session: {
          id: live.id,
          slug: live.slug,
          title: live.title,
          status: live.status,
          sessionDate: live.sessionDate,
          pattern: publicPattern(live.pattern),
          topics: config.topics,
          chipLimit: config.chipLimit,
        },
        timer: timerPayload(live, config),
        likert: {
          items: items.map((i) => ({
            id: i.id,
            topicCode: i.topicCode,
            text: i.text,
            gospelNote: i.gospelNote,
          })),
          open: ['LIKERT_OPEN', 'RUNNING'].includes(live.status),
          answered: Object.keys(myValues).length > 0,
          myValues,
        },
        chips: {
          list: (
            await prisma.worshipChip.findMany({
              where: { sessionId: live.id, isActive: true },
              orderBy: { sortOrder: 'asc' },
            })
          ).map((c) => ({ code: c.code, label: c.label, topicCode: c.topicCode })),
          mine: myVotes.map((v) => v.chipCode),
          open: ['RUNNING', 'WRAPUP'].includes(live.status),
        },
        me: { id: req.authUser.id, name: req.authUser.name || 'Peserta' },
        notes,
        guide: fgdGuide(config),
        deepGuide: deepGuide(config),
        song: sessionSong(config),
        fgd: fgdState(config),
        testimony: Array.isArray(config.testimony?.picks) ? config.testimony.picks : [],
        rounds: config.rounds,
        screening: config.screening,
        teams: config.teams,
        myResult,
        rooms: agg.rooms,
        progress: { submitted: agg.submitted, total: config.expectedCount || (await youthUserCount(prisma)) },
      });
    }),
  );

  app.post(
    '/api/worship/likert',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });

      const session = await prisma.worshipSession.findUnique({ where: { slug: String(req.body?.slug || '') } });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      if (!['LIKERT_OPEN', 'RUNNING'].includes(session.status)) {
        return res.status(409).json({ error: 'Form Likert belum dibuka atau sudah ditutup.' });
      }

      const items = await prisma.worshipLikertItem.findMany({ where: { sessionId: session.id } });
      const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
      const rows = [];
      for (const item of items) {
        const value = clampScale(answers[item.id]);
        if (value === null) {
          return res.status(400).json({ error: 'Semua pertanyaan wajib diisi dengan skala 1–5.' });
        }
        rows.push({ item, value });
      }
      if (!rows.length) return res.status(400).json({ error: 'Sesi belum memiliki pertanyaan.' });

      await prisma.$transaction(
        rows.map(({ item, value }) =>
          prisma.worshipLikertResponse.upsert({
            where: { sessionId_userId_itemId: { sessionId: session.id, userId: req.authUser.id, itemId: item.id } },
            create: {
              id: uid('wlr'),
              sessionId: session.id,
              userId: req.authUser.id,
              itemId: item.id,
              topicCode: item.topicCode,
              value,
            },
            update: { value, topicCode: item.topicCode },
          }),
        ),
      );

      const agg = await loadAggregates(prisma, session);
      const mine = agg.perUser.get(req.authUser.id) || {};
      const best = rankTopics(mine, agg.config)[0];
      const idx = agg.ranked.indexOf(best);
      const floor = agg.config.rankFloors[idx] ?? 1;

      res.json({
        ok: true,
        myResult: {
          topicCode: best,
          topicLabel: agg.config.topics.find((t) => t.code === best)?.label || best,
          floor,
          floorLabel: floorLabel(agg.config, floor),
          vulnerability: mine[best] || 0,
          affirmations: agg.config.affirmations?.[best] || [],
        },
        rooms: agg.rooms,
      });
    }),
  );

  app.post(
    '/api/worship/chips',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });

      const session = await prisma.worshipSession.findUnique({ where: { slug: String(req.body?.slug || '') } });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      if (!['RUNNING', 'WRAPUP'].includes(session.status)) {
        return res.status(409).json({ error: 'Sesi chip words belum dibuka.' });
      }
      const config = normalizeConfig(session.config);
      const codes = Array.isArray(req.body?.codes) ? [...new Set(req.body.codes.map((c) => String(c)))] : [];
      if (!codes.length) return res.status(400).json({ error: 'Pilih minimal satu chip.' });
      if (codes.length > config.chipLimit) {
        return res.status(400).json({ error: `Maksimal ${config.chipLimit} chip.` });
      }
      const valid = await prisma.worshipChip.findMany({
        where: { sessionId: session.id, code: { in: codes }, isActive: true },
        select: { code: true },
      });
      const allowed = new Set(valid.map((c) => c.code));
      if (codes.some((c) => !allowed.has(c))) {
        return res.status(400).json({ error: 'Ada chip yang tidak dikenal.' });
      }

      await prisma.$transaction([
        prisma.worshipChipVote.deleteMany({ where: { sessionId: session.id, userId: req.authUser.id } }),
        prisma.worshipChipVote.createMany({
          data: codes.map((chipCode) => ({
            id: uid('wcv'),
            sessionId: session.id,
            userId: req.authUser.id,
            chipCode,
          })),
          skipDuplicates: true,
        }),
      ]);

      const agg = await loadAggregates(prisma, session);
      res.json({ ok: true, mine: codes, wordcloud: agg.wordcloud });
    }),
  );

  app.put(
    '/api/worship/notes',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });

      const session = await prisma.worshipSession.findUnique({ where: { slug: String(req.body?.slug || '') } });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timedNote = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timedNote);
      if (!['LIKERT_OPEN', 'RUNNING', 'WRAPUP'].includes(live.status)) {
        return res.status(409).json({ error: 'Catatan hanya bisa diisi saat sesi berlangsung.' });
      }

      const config = normalizeConfig(live.config);
      const allowed = allowedNoteCodes(config);
      const raw = Array.isArray(req.body?.notes) ? req.body.notes : [];
      const rows = [];
      for (const entry of raw) {
        const topicCode = String(entry?.topicCode || '').toUpperCase().slice(0, 40);
        if (!allowed.has(topicCode)) continue;
        const content = str(entry?.content, 4000);
        rows.push({ topicCode, content });
      }
      if (!rows.length) return res.status(400).json({ error: 'Tidak ada catatan yang dikirim.' });

      for (const { topicCode, content } of rows) {
        const key = { sessionId_userId_topicCode: { sessionId: live.id, userId: req.authUser.id, topicCode } };
        if (!content) {
          await prisma.worshipNote.deleteMany({ where: { sessionId: live.id, userId: req.authUser.id, topicCode } });
          continue;
        }
        await prisma.worshipNote.upsert({
          where: key,
          create: { id: uid('wn'), sessionId: live.id, userId: req.authUser.id, topicCode, content },
          update: { content },
        });
      }

      const mine = await prisma.worshipNote.findMany({ where: { sessionId: live.id, userId: req.authUser.id } });
      const notes = {};
      for (const n of mine) notes[n.topicCode] = n.content;
      res.json({ ok: true, notes });
    }),
  );

  app.get(
    '/api/worship/live/:slug',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug) },
        include: { pattern: true },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

      const code = str(req.query?.code, 12);
      const codeOk = Boolean(code) && String(session.accessCode || '').toUpperCase() === code.toUpperCase();
      if (!req.authUser && !codeOk) {
        return res.status(401).json({ error: 'Butuh login atau kode sesi proyektor.' });
      }
      const liveStateTimed = await ensureAutoState(prisma, session);
      const liveState = await ensureAutoClosed(prisma, liveStateTimed);

      const agg = await loadAggregates(prisma, liveState);
      const expected = agg.config.expectedCount || (await youthUserCount(prisma));
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        session: {
          id: liveState.id,
          slug: liveState.slug,
          title: liveState.title,
          status: liveState.status,
          pattern: publicPattern(liveState.pattern),
          topics: agg.config.topics,
        },
        timer: timerPayload(liveState, agg.config),
        progress: { submitted: agg.submitted, total: expected },
        rooms: agg.rooms,
        wordcloud: agg.wordcloud,
        guide: fgdGuide(agg.config),
        deepGuide: deepGuide(agg.config),
        song: sessionSong(agg.config),
        fgd: fgdState(agg.config),
        testimony: Array.isArray(agg.config.testimony?.picks) ? agg.config.testimony.picks : [],
        oneWord: await oneWordAggregate(prisma, liveState.id),
        rounds: agg.config.rounds,
        screening: agg.config.screening,
        teams: agg.config.teams,
        wrapUpAt: liveState.wrapUpAt ? new Date(liveState.wrapUpAt).toISOString() : null,
      });
    }),
  );

  // ---------------- Admin (Didaskalia) ----------------

  app.get(
    '/api/worship/patterns',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const patterns = await prisma.worshipPattern.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      res.json({ patterns });
    }),
  );

  app.post(
    '/api/worship/patterns',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const code = String(req.body?.code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .slice(0, 40);
      const name = str(req.body?.name, 150);
      if (!code || !name) return res.status(400).json({ error: 'code dan name wajib.' });
      const exists = await prisma.worshipPattern.findUnique({ where: { code } });
      if (exists) return res.status(409).json({ error: 'Kode pola sudah dipakai.' });
      const created = await prisma.worshipPattern.create({
        data: {
          id: uid('wp'),
          code,
          name,
          summary: str(req.body?.summary, 2000),
          defaultDurationMin: intOrNull(req.body?.defaultDurationMin),
          phases: Array.isArray(req.body?.phases) ? req.body.phases : [],
          modules: Array.isArray(req.body?.modules) ? req.body.modules : [],
          playbook: str(req.body?.playbook, 200000),
          status: STATUSES.includes(String(req.body?.status)) ? String(req.body.status) : 'DRAFT',
          sortOrder: intOrNull(req.body?.sortOrder) || 0,
        },
      });
      res.status(201).json({ pattern: created });
    }),
  );

  app.put(
    '/api/worship/patterns/:code',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const pattern = await prisma.worshipPattern.findUnique({ where: { code: String(req.params.code) } });
      if (!pattern) return res.status(404).json({ error: 'Pola tidak ditemukan.' });
      const b = req.body || {};
      const data = {};
      if (b.name !== undefined) data.name = str(b.name, 150) || pattern.name;
      if (b.summary !== undefined) data.summary = str(b.summary, 2000);
      if (b.defaultDurationMin !== undefined) data.defaultDurationMin = intOrNull(b.defaultDurationMin);
      if (b.phases !== undefined) data.phases = Array.isArray(b.phases) ? b.phases : [];
      if (b.modules !== undefined) data.modules = Array.isArray(b.modules) ? b.modules : [];
      if (b.playbook !== undefined) data.playbook = str(b.playbook, 200000);
      if (b.status !== undefined) data.status = STATUSES.includes(String(b.status).toUpperCase()) ? String(b.status).toUpperCase() : pattern.status;
      if (b.sortOrder !== undefined) data.sortOrder = intOrNull(b.sortOrder) || 0;
      const updated = await prisma.worshipPattern.update({ where: { id: pattern.id }, data });
      res.json({ pattern: updated });
    }),
  );

  // ---------------- Tempat pos (master Didaskalia) ----------------

  const serializeVenue = (v) => ({
    id: v.id,
    code: v.code,
    name: v.name,
    capacity: v.capacity ?? 0,
    kind: v.kind,
    note: v.note || null,
    isActive: v.isActive !== false,
    sortOrder: v.sortOrder ?? 0,
  });

  app.get(
    '/api/worship/venues',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const onlyActive = String(req.query.active || '') !== '0';
      const venues = await prisma.worshipVenue
        .findMany({
          where: onlyActive ? { isActive: true } : {},
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
        .catch(() => []);
      res.json({ venues: venues.map(serializeVenue) });
    }),
  );

  app.post(
    '/api/worship/venues',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const code = String(req.body?.code || '').toUpperCase().trim().slice(0, 24);
      const name = str(req.body?.name, 150);
      if (!code || !name) return res.status(400).json({ error: 'code dan name wajib.' });
      const exists = await prisma.worshipVenue.findUnique({ where: { code } }).catch(() => null);
      if (exists) return res.status(409).json({ error: 'Kode tempat sudah dipakai.' });
      const created = await prisma.worshipVenue.create({
        data: {
          id: uid('wv'),
          code,
          name,
          capacity: Math.max(0, intOrNull(req.body?.capacity) || 0),
          kind: ['LANTAI', 'TERAS', 'CITYWALK'].includes(String(req.body?.kind)) ? String(req.body.kind) : 'LANTAI',
          note: str(req.body?.note, 500),
          sortOrder: intOrNull(req.body?.sortOrder) || 0,
        },
      });
      res.status(201).json({ venue: serializeVenue(created) });
    }),
  );

  app.put(
    '/api/worship/venues/:id',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await prisma.worshipVenue.findUnique({ where: { id: String(req.params.id) } }).catch(() => null);
      if (!found) return res.status(404).json({ error: 'Tempat tidak ditemukan.' });
      const b = req.body || {};
      const data = {};
      if (b.name !== undefined) data.name = str(b.name, 150) || found.name;
      if (b.capacity !== undefined) data.capacity = Math.max(0, intOrNull(b.capacity) || 0);
      if (b.kind !== undefined && ['LANTAI', 'TERAS', 'CITYWALK'].includes(String(b.kind))) data.kind = String(b.kind);
      if (b.note !== undefined) data.note = str(b.note, 500);
      if (b.sortOrder !== undefined) data.sortOrder = intOrNull(b.sortOrder) || 0;
      if (b.isActive !== undefined) data.isActive = Boolean(b.isActive);
      const updated = await prisma.worshipVenue.update({ where: { id: found.id }, data });
      res.json({ venue: serializeVenue(updated) });
    }),
  );

  app.delete(
    '/api/worship/venues/:id',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await prisma.worshipVenue.findUnique({ where: { id: String(req.params.id) } }).catch(() => null);
      if (!found) return res.status(404).json({ error: 'Tempat tidak ditemukan.' });
      // Tolak hapus fisik bila masih dipakai config sesi mana pun (pakai nonaktif).
      let usedBy = 0;
      try {
        const rows = await prisma.worshipSession.findMany({ select: { id: true, config: true } });
        for (const s of rows) {
          const cfg = s.config && typeof s.config === 'object' ? s.config : null;
          const floors = Array.isArray(cfg?.floors) ? cfg.floors : [];
          if (floors.some((f) => String(f?.venueId || '') === found.id)) usedBy += 1;
        }
      } catch {
        usedBy = 0;
      }
      if (usedBy > 0) {
        return res.status(409).json({ error: `Dipakai ${usedBy} sesi — nonaktifkan saja, jangan hapus.` });
      }
      await prisma.worshipVenue.delete({ where: { id: found.id } });
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/worship/sessions',
    requireRole(),
    wrap(async (req, res) => {      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const sessions = await prisma.worshipSession.findMany({
        include: { pattern: { select: { code: true, name: true } } },
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      });
      res.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          slug: s.slug,
          title: s.title,
          status: s.status,
          sessionDate: s.sessionDate,
          accessCode: s.accessCode,
          eventId: s.eventId || null,
          pattern: s.pattern,
        })),
      });
    }),
  );

  app.get(
    '/api/worship/sessions/:id',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: {
          pattern: true,
          likertItems: { orderBy: { sortOrder: 'asc' } },
          chips: { orderBy: { sortOrder: 'asc' } },
        },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timedSession = await ensureAutoState(prisma, session);
      const liveSession = await ensureAutoClosed(prisma, timedSession);
      const agg = await loadAggregates(prisma, liveSession);
      const noteRows = await prisma.worshipNote
        .findMany({ where: { sessionId: liveSession.id }, orderBy: { updatedAt: 'desc' } })
        .catch(() => []);
      const noteUsers = noteRows.length
        ? await prisma.user.findMany({
            where: { id: { in: [...new Set(noteRows.map((n) => n.userId))] } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const userById = new Map(noteUsers.map((u) => [u.id, u]));
      const canReadNotes = (req.authUser?.roles || []).some((r) =>
        ['SUPERADMIN', 'KOMISI', 'COMMITTEE'].includes(r.role),
      );
      res.json({
        session: {
          id: liveSession.id,
          slug: liveSession.slug,
          title: liveSession.title,
          status: liveSession.status,
          sessionDate: liveSession.sessionDate,
          accessCode: liveSession.accessCode,
          eventId: liveSession.eventId || null,
          config: agg.config,
          pattern: liveSession.pattern,
        },
        likertItems: liveSession.likertItems,
        chips: liveSession.chips,
        rooms: agg.rooms,
        wordcloud: agg.wordcloud,
        notes: canReadNotes
          ? noteRows.map((n) => ({
              userId: n.userId,
              userName: userById.get(n.userId)?.name || n.userId,
              topicCode: n.topicCode,
              content: n.content,
              updatedAt: n.updatedAt,
            }))
          : [],
        progress: { submitted: agg.submitted, total: agg.config.expectedCount || (await youthUserCount(prisma)) },
      });
    }),
  );

  app.post(
    '/api/worship/sessions',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const patternCode = String(req.body?.patternCode || '').toUpperCase();
      const pattern = await prisma.worshipPattern.findUnique({ where: { code: patternCode } });
      if (!pattern) return res.status(400).json({ error: 'Pola tidak ditemukan.' });
      const slug = String(req.body?.slug || '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
      const title = str(req.body?.title, 200);
      if (!slug || !title) return res.status(400).json({ error: 'slug dan title wajib.' });
      const dup = await prisma.worshipSession.findUnique({ where: { slug } });
      if (dup) return res.status(409).json({ error: 'Slug sudah dipakai.' });
      const dateRaw = str(req.body?.sessionDate, 40);
      const created = await prisma.worshipSession.create({
        data: {
          id: uid('ws'),
          patternId: pattern.id,
          slug,
          title,
          eventId: str(req.body?.eventId, 64),
          tenantId: YOUTH_TENANT,
          sessionDate: dateRaw ? new Date(`${dateRaw.slice(0, 10)}T00:00:00Z`) : null,
          status: 'DRAFT',
          accessCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
          config: normalizeConfig(req.body?.config, patternCode),
          createdById: req.authUser?.id || null,
        },
      });
      res.status(201).json({ session: created });
    }),
  );

  app.put(
    '/api/worship/sessions/:id',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const b = req.body || {};
      const data = {};
      if (b.title !== undefined) data.title = str(b.title, 200) || session.title;
      if (b.sessionDate !== undefined) {
        const raw = str(b.sessionDate, 40);
        data.sessionDate = raw ? new Date(`${raw.slice(0, 10)}T00:00:00Z`) : null;
      }
      if (b.config !== undefined) {
        const full = await prisma.worshipSession.findUnique({
          where: { id: session.id },
          include: { pattern: { select: { code: true } } },
        });
        data.config = normalizeConfig(b.config, full?.pattern?.code);
      }
      if (b.rotateCode) data.accessCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      const updated = await prisma.worshipSession.update({ where: { id: session.id }, data });
      res.json({ session: updated });
    }),
  );

  app.delete(
    '/api/worship/sessions/:id',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      try {
        const out = await deleteEmptySession(prisma, session);
        res.json({ ok: true, slug: out.slug });
      } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Gagal menghapus sesi.' });
      }
    }),
  );

  app.put(
    '/api/worship/sessions/:id/state',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const action = String(req.body?.action || '');
      const now = new Date();
      const data = {};
      if (action === 'open-likert') {
        data.status = 'LIKERT_OPEN';
        data.likertOpenedAt = now;
      } else if (action === 'start') {
        data.status = 'RUNNING';
        data.startedAt = now;
      } else if (action === 'wrapup') {
        data.status = 'WRAPUP';
        data.wrapUpAt = now;
      } else if (action === 'close') {
        data.status = 'CLOSED';
        data.closedAt = now;
      } else if (action === 'reset') {
        data.status = 'DRAFT';
        data.likertOpenedAt = null;
        data.startedAt = null;
        data.wrapUpAt = null;
        data.closedAt = null;
      } else if (action === 'extend') {
        const seconds = Math.min(1800, Math.max(60, intOrNull(req.body?.seconds) || 300));
        const cfg = normalizeConfig(session.config);
        data.config = { ...cfg, timerSeconds: cfg.timerSeconds + seconds };
        if (session.status === 'WRAPUP') {
          data.status = 'RUNNING';
          data.wrapUpAt = null;
        }
      } else {
        return res.status(400).json({ error: 'Aksi tidak dikenal.' });
      }
      const updated = await prisma.worshipSession.update({ where: { id: session.id }, data });
      res.json({ ok: true, status: updated.status });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/likert-items',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const topicCode = String(req.body?.topicCode || '').toUpperCase().slice(0, 40);
      const text = str(req.body?.text, 2000);
      if (!topicCode || !text) return res.status(400).json({ error: 'topicCode dan text wajib.' });
      const count = await prisma.worshipLikertItem.count({ where: { sessionId: session.id } });
      const item = await prisma.worshipLikertItem.create({
        data: {
          id: uid('wli'),
          sessionId: session.id,
          topicCode,
          text,
          gospelNote: str(req.body?.gospelNote, 2000),
          sortOrder: intOrNull(req.body?.sortOrder) || count + 1,
        },
      });
      res.status(201).json({ item });
    }),
  );

  app.put(
    '/api/worship/sessions/:id/likert-items/:itemId',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const item = await prisma.worshipLikertItem.findUnique({ where: { id: String(req.params.itemId) } });
      if (!item || item.sessionId !== String(req.params.id)) {
        return res.status(404).json({ error: 'Pertanyaan tidak ditemukan.' });
      }
      const b = req.body || {};
      const data = {};
      if (b.topicCode !== undefined) data.topicCode = String(b.topicCode).toUpperCase().slice(0, 40);
      if (b.text !== undefined) data.text = str(b.text, 2000) || item.text;
      if (b.gospelNote !== undefined) data.gospelNote = str(b.gospelNote, 2000);
      if (b.sortOrder !== undefined) data.sortOrder = intOrNull(b.sortOrder) || item.sortOrder;
      const updated = await prisma.worshipLikertItem.update({ where: { id: item.id }, data });
      res.json({ item: updated });
    }),
  );

  app.delete(
    '/api/worship/sessions/:id/likert-items/:itemId',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const item = await prisma.worshipLikertItem.findUnique({ where: { id: String(req.params.itemId) } });
      if (!item || item.sessionId !== String(req.params.id)) {
        return res.status(404).json({ error: 'Pertanyaan tidak ditemukan.' });
      }
      await prisma.worshipLikertResponse.deleteMany({ where: { itemId: item.id } });
      await prisma.worshipLikertItem.delete({ where: { id: item.id } });
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/chips',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const label = str(req.body?.label, 80);
      if (!label) return res.status(400).json({ error: 'label wajib.' });
      const code = String(req.body?.code || label.replace(/^#/, ''))
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .slice(0, 40);
      const dup = await prisma.worshipChip.findUnique({ where: { sessionId_code: { sessionId: session.id, code } } });
      if (dup) return res.status(409).json({ error: 'Kode chip sudah ada.' });
      const count = await prisma.worshipChip.count({ where: { sessionId: session.id } });
      const chip = await prisma.worshipChip.create({
        data: {
          id: uid('wc'),
          sessionId: session.id,
          code,
          label: label.startsWith('#') ? label : `#${label}`,
          topicCode: str(req.body?.topicCode, 40),
          sortOrder: intOrNull(req.body?.sortOrder) || count + 1,
          isActive: true,
        },
      });
      res.status(201).json({ chip });
    }),
  );

  app.delete(
    '/api/worship/sessions/:id/chips/:code',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const code = String(req.params.code);
      const chip = await prisma.worshipChip.findUnique({
        where: { sessionId_code: { sessionId: String(req.params.id), code } },
      });
      if (!chip) return res.status(404).json({ error: 'Chip tidak ditemukan.' });
      await prisma.worshipChipVote.deleteMany({ where: { sessionId: chip.sessionId, chipCode: code } });
      await prisma.worshipChip.delete({ where: { id: chip.id } });
      res.json({ ok: true });
    }),
  );

  // Alihkan pola sesi di tempat (slug + link tetap): mis. BEDAH_FILM → MONOLOG
  // saat pekan berganti tapi slug sudah terpakai. Guard: hanya sesi DRAFT tanpa
  // data peserta (jawaban/vote/catatan). Isi organizer pola lama (soal/chip/draft/
  // stage) ikut dibuang karena template tiap pola beda key. Perlu konfirmasi klien.
  app.post(
    '/api/worship/sessions/:id/convert-pattern',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        const out = await convertSessionPattern(prisma, req.params.id, req.body?.patternCode);
        res.json({ ok: true, ...out });
      } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Gagal mengalihkan pola sesi.' });
      }
    }),
  );

  // Terapkan draft sesi dari tab Draft Sesi Studio (isi AI yang sudah direview).
  // Guard server-side: hanya sesi DRAFT tanpa jawaban peserta & tanpa isi
  // (sesi jalan/terisi seperti 4 Okt dikunci — ubah manual via kontrol hari-H).
  app.post(
    '/api/worship/sessions/:id/apply-draft',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      if (String(session.status || '').toUpperCase() !== 'DRAFT') {
        return res.status(409).json({ error: `Sesi berstatus ${session.status} — hanya sesi DRAFT yang bisa diisi otomatis.` });
      }
      const [respCount, itemCount, chipCount] = await Promise.all([
        prisma.worshipLikertResponse.count({ where: { sessionId: session.id } }),
        prisma.worshipLikertItem.count({ where: { sessionId: session.id } }),
        prisma.worshipChip.count({ where: { sessionId: session.id } }),
      ]);
      if (respCount > 0) {
        return res.status(409).json({ error: 'Sudah ada jawaban peserta — isi sesi dikunci.' });
      }
      if (itemCount > 0 || chipCount > 0) {
        return res.status(409).json({ error: 'Sesi sudah berisi soal/chip — ubah manual via kontrol hari-H.' });
      }
      const b = req.body || {};
      const kind = String(b.kind || '').toUpperCase();
      const cleanDraft = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const out = {};
        for (const [sk, fv] of Object.entries(raw).slice(0, 20)) {
          if (!fv || typeof fv !== 'object' || Array.isArray(fv)) continue;
          out[String(sk).slice(0, 60)] = {};
          for (const [fk, vv] of Object.entries(fv).slice(0, 30)) {
            out[String(sk).slice(0, 60)][String(fk).slice(0, 80)] = String(vv ?? '').slice(0, 2000);
          }
        }
        return out;
      };
      if (kind === 'POST_TO_POST') {
        const d = b.draft || {};
        const topics = (Array.isArray(d.topics) ? d.topics : []).slice(0, 3).map((x) => ({
          code: String(x?.code || '').toUpperCase().slice(0, 40),
          label: str(x?.label, 120) || String(x?.code || ''),
          pic: str(x?.pic, 120),
        })).filter((x) => x.code);
        const items = (Array.isArray(d.items) ? d.items : []).slice(0, 12).map((x) => ({
          topicCode: String(x?.topicCode || '').toUpperCase().slice(0, 40),
          text: str(x?.text, 2000),
          gospelNote: str(x?.gospelNote, 2000),
        })).filter((x) => x.topicCode && x.text);
        const chips = (Array.isArray(d.chips) ? d.chips : []).slice(0, 16).map((x) => {
          const code = String(x?.code || x?.label || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 40);
          const label = str(x?.label, 80);
          return { code, label: label.startsWith('#') ? label : `#${label}`, topicCode: str(x?.topicCode, 40) };
        }).filter((x) => x.code && x.label.replace('#', ''));
        if (!topics.length || !items.length) {
          return res.status(400).json({ error: 'Draft Post-to-Post wajib berisi topik + soal Likert.' });
        }
        const affirm = d.affirmations && typeof d.affirmations === 'object' ? d.affirmations : {};
        const timerSeconds = Math.min(7200, Math.max(60, intOrNull(d.timerSeconds) || 1200));
        const cfg = normalizeConfig({
          ...(session.config || {}),
          topics,
          affirmations: affirm,
          chipLimit: 3,
          timerSeconds,
          draft: cleanDraft(b.storedDraft),
        }, 'POST_TO_POST');
        await prisma.worshipSession.update({ where: { id: session.id }, data: { config: cfg } });
        let order = 0;
        for (const it of items) {
          order += 1;
          await prisma.worshipLikertItem.create({
            data: { id: uid('wli'), sessionId: session.id, topicCode: it.topicCode, text: it.text, gospelNote: it.gospelNote, sortOrder: order },
          });
        }
        let corder = 0;
        for (const c of chips) {
          corder += 1;
          await prisma.worshipChip.create({
            data: { id: uid('wc'), sessionId: session.id, code: c.code, label: c.label, topicCode: c.topicCode, sortOrder: corder, isActive: true },
          });
        }
        return res.json({ ok: true, items: items.length, chips: chips.length });
      }
      // Pola lain: bersihkan warisan Post-to-Post lalu simpan draft form ke config.
      // Tiap pola punya POV berbeda — Likert/Chip/Rank pos disembunyikan total.
      const full = await prisma.worshipSession.findUnique({
        where: { id: session.id },
        include: { pattern: { select: { code: true } } },
      });
      const sessionPattern = String(full?.pattern?.code || kind || '').toUpperCase();
      const cfg = normalizeConfig(
        { ...(session.config || {}), topics: [], affirmations: {}, draft: cleanDraft(b.storedDraft) },
        sessionPattern,
      );
      if (!cfg.draft) return res.status(400).json({ error: 'Draft kosong — isi form dulu.' });
      const legacyItems = await prisma.worshipLikertItem.findMany({
        where: { sessionId: session.id },
        select: { id: true },
      });
      const legacyIds = legacyItems.map((r) => r.id);
      await prisma.$transaction([
        ...(legacyIds.length
          ? [prisma.worshipLikertResponse.deleteMany({ where: { itemId: { in: legacyIds } } })]
          : []),
        prisma.worshipLikertItem.deleteMany({ where: { sessionId: session.id } }),
        prisma.worshipChipVote.deleteMany({ where: { sessionId: session.id } }),
        prisma.worshipChip.deleteMany({ where: { sessionId: session.id } }),
        prisma.worshipSession.update({ where: { id: session.id }, data: { config: cfg } }),
      ]);
      res.json({ ok: true, saved: true, cleaned: legacyIds.length });
    }),
  );

  // ---------------- Undian kesaksian (modul testimony) ----------------
  // Pool = yang hadir (check-in event; fallback pengisi Likert). Hasil
  // tersimpan di config.testimony.picks — tanpa migrasi skema.

  async function testimonyPool(prisma, session) {
    let userIds = [];
    if (session.eventId) {
      const rows = await prisma.eventCheckIn
        .findMany({
          where: { eventId: session.eventId, userId: { not: null }, result: { not: 'VOIDED' } },
          select: { userId: true },
        })
        .catch(() => []);
      userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    }
    if (!userIds.length) {
      const resp = await prisma.worshipLikertResponse
        .findMany({ where: { sessionId: session.id }, select: { userId: true } })
        .catch(() => []);
      userIds = [...new Set(resp.map((r) => r.userId).filter(Boolean))];
    }
    if (!userIds.length) return [];
    const users = await prisma.user
      .findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, roles: { select: { role: true } } },
      })
      .catch(() => []);
    return users.map((u) => ({
      userId: u.id,
      name: u.name || 'Peserta',
      roles: (u.roles || []).map((r) => r.role),
    }));
  }

  function readPicks(session) {
    try {
      const cfg = normalizeConfig(session.config);
      return Array.isArray(cfg.testimony?.picks) ? cfg.testimony.picks : [];
    } catch {
      return [];
    }
  }

  async function writePicks(prisma, session, picks) {
    const cfg = normalizeConfig(session.config);
    cfg.testimony = { picks, drawnAt: new Date().toISOString() };
    await prisma.worshipSession.update({ where: { id: session.id }, data: { config: cfg } });
    return picks;
  }

  app.get(
    '/api/worship/sessions/:id/testimony',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await findSession(prisma, req.params.id);
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const pool = await testimonyPool(prisma, session);
      const byRole = {};
      for (const p of pool) {
        const r = classifyPoolRole(p.roles);
        byRole[r] = (byRole[r] || 0) + 1;
      }
      res.json({ pool: { total: pool.length, byRole }, picks: readPicks(session) });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/testimony/draw',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({ where: { id: found.id } });
      if (!['LIKERT_OPEN', 'RUNNING', 'WRAPUP'].includes(String(session.status || '').toUpperCase())) {
        return res.status(409).json({ error: 'Undian hanya bisa saat sesi berlangsung.' });
      }
      const pool = await testimonyPool(prisma, session);
      if (!pool.length) {
        return res.status(400).json({ error: 'Belum ada yang hadir (check-in/Likert masih kosong).' });
      }
      const picks = readPicks(session);
      const fresh = composePicks(pool, picks.map((p) => p.userId));
      if (!fresh.length) return res.status(409).json({ error: 'Semua yang hadir sudah terpilih.' });
      const at = new Date().toISOString();
      const merged = [...picks, ...fresh.map((p) => ({ ...p, at }))];
      await writePicks(prisma, session, merged);
      res.json({ ok: true, fresh, picks: merged });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/testimony/reset',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({ where: { id: found.id } });
      await writePicks(prisma, session, []);
      res.json({ ok: true, picks: [] });
    }),
  );

  // Status panggung live (modul rounds / screening / teams).
  // Ditulis kontrol saat sesi berjalan (tanpa guard isi — bukan jawaban peserta).
  app.put(
    '/api/worship/sessions/:id/stage',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({ where: { id: found.id } });
      const b = req.body || {};
      const cfg = normalizeConfig(session.config);
      const out = {};
      if (b.rounds !== undefined) {
        const cleaned = cleanRounds(b.rounds);
        if (!cleaned) return res.status(400).json({ error: 'State ronde tidak valid.' });
        cfg.rounds = cleaned;
        out.rounds = cleaned;
      }
      if (b.screening !== undefined) {
        if (b.screening === null) {
          cfg.screening = null;
          out.screening = null;
        } else {
          const cleaned = cleanScreening(b.screening);
          if (!cleaned) return res.status(400).json({ error: 'Judul film wajib diisi.' });
          cfg.screening = cleaned;
          out.screening = cleaned;
        }
      }
      if (b.teams !== undefined) {
        const cleaned = cleanTeams(b.teams);
        if (!cleaned) return res.status(400).json({ error: 'Minimal satu tim bernama.' });
        cfg.teams = cleaned;
        out.teams = cleaned;
      }
      if (b.fgd !== undefined) {
        const cleaned = cleanFgd(b.fgd);
        if (!cleaned) return res.status(400).json({ error: 'State trigger Q tidak valid.' });
        cfg.fgd = cleaned;
        out.fgd = cleaned;
      }
      if (b.song !== undefined) {
        if (b.song === null) {
          cfg.song = null;
          out.song = null;
        } else {
          const cleaned = cleanSong(b.song);
          if (!cleaned) return res.status(400).json({ error: 'Judul lagu wajib diisi.' });
          cfg.song = cleaned;
          out.song = cleaned;
        }
      }
      if (!Object.keys(out).length) return res.status(400).json({ error: 'Tidak ada yang disimpan.' });
      await prisma.worshipSession.update({ where: { id: session.id }, data: { config: cfg } });
      res.json({ ok: true, ...out });
    }),
  );

  app.get(
    '/api/worship/sessions/:id/export.csv',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { chips: { orderBy: { sortOrder: 'asc' } }, likertItems: true },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const agg = await loadAggregates(prisma, session);
      const [users, votes, noteRows] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: [...agg.perUser.keys()] } },
          select: { id: true, name: true, email: true, bipra: true },
        }),
        prisma.worshipChipVote.findMany({ where: { sessionId: session.id }, select: { userId: true, chipCode: true } }),
        prisma.worshipNote.findMany({ where: { sessionId: session.id } }).catch(() => []),
      ]);
      const userById = new Map(users.map((u) => [u.id, u]));
      const chipsByUser = new Map();
      for (const v of votes) {
        if (!chipsByUser.has(v.userId)) chipsByUser.set(v.userId, []);
        chipsByUser.get(v.userId).push(v.chipCode);
      }
      const notesByUser = new Map();
      for (const n of noteRows) {
        if (!notesByUser.has(n.userId)) notesByUser.set(n.userId, {});
        notesByUser.get(n.userId)[n.topicCode] = n.content;
      }

      const topics = agg.config.topics;
      const headers = [
        'Nama',
        'Email',
        'BIPRA',
        'TopikPrioritas',
        ...topics.map((t) => `Skor_${t.code}`),
        'Chip1',
        'Chip2',
        'Chip3',
        ...topics.map((t) => `Catatan_${t.code}`),
        'Kesimpulan',
      ];
      const lines = [headers.map(csvEscape).join(',')];
      for (const [userId, scores] of agg.perUser) {
        const u = userById.get(userId);
        const best = rankTopics(scores, agg.config)[0] || '';
        const chips = (chipsByUser.get(userId) || []).slice(0, 3);
        const myNotes = notesByUser.get(userId) || {};
        const cells = [
          u?.name || userId,
          u?.email || '',
          u?.bipra || '',
          best,
          ...topics.map((t) => String(scores[t.code] || 0)),
          chips[0] || '',
          chips[1] || '',
          chips[2] || '',
          ...topics.map((t) => myNotes[t.code] || ''),
          myNotes.KESIMPULAN || '',
        ];
        lines.push(cells.map(csvEscape).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="worship-${session.slug}.csv"`);
      res.send(`\uFEFF${lines.join('\r\n')}`);
    }),
  );
}

async function youthUserCount(prisma) {
  try {
    const rows = await prisma.userRole.findMany({
      where: { tenantId: YOUTH_TENANT },
      select: { userId: true },
      take: 5000,
    });
    return new Set(rows.map((r) => r.userId)).size;
  } catch {
    return 0;
  }
}
