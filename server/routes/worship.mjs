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
import { canAccessDivision, requireDivision } from '../lib/division-access.mjs';
import { csvEscape } from '../lib/event-question-showif.mjs';
import { resolveHostContext } from '../lib/host-context.mjs';
import { tenantForWrite } from '../lib/tenant-scope.mjs';
import { YOUTH_TENANT_ID } from '../lib/tenant-defaults.mjs';
import { applyFilmCap, classifyPoolRole, composePicks, mergeManualPicks, TESTIMONY_FILM_CAP, TESTIMONY_NEED_FILM, TESTIMONY_NEED_MONOLOG } from '../lib/testimony.mjs';
import { cleanFgd, cleanLikertRounds, cleanPhase, cleanPhasePrefs, cleanRounds, cleanScreening, cleanSong, cleanTeams, cleanActivity, creativeLabFromDraft, buildCreativeLabTeams, LAB_MAX_TEAMS, SEQUENCE_MAX_TEAMS, DEFAULT_MAX_TEAMS, matchJointTeam, defaultPhasePrefs, MONOLOG_PHASE_SECONDS, parseFilmDurationMin } from '../lib/session-stage.mjs';
import { createFolder as driveCreateFolder, listAllFolders, findFoldersNamed, getFolderMeta, uploadFile as driveUploadFile, deleteFile as driveDeleteFile, getFileStream as driveGetFileStream, getDriveMode } from '../gdrive.mjs';
import { bucketForPhotoKind, pickEventFolder, pickFolderByName, plainFolderName } from '../lib/lab-drive.mjs';
import { hasUserDriveToken } from '../lib/gdrive-user-oauth.mjs';
import { canonicalCreativeLabPhases, legacyCreativeLabHits, presentWorshipPattern } from '../lib/creative-lab-rundown.mjs';
import { finishIfMatch, weakEtag } from '../lib/http-cache.mjs';

const PATTERN_LEAN = {
  select: {
    id: true,
    code: true,
    name: true,
    summary: true,
    defaultDurationMin: true,
    phases: true,
    modules: true,
    status: true,
    updatedAt: true,
  },
};

function numCell(value) {
  if (value == null) return '';
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return String(value.getTime());
  return String(value);
}

/** Sidik jari murah untuk poll. Gagal query → null (tetap kirim body penuh). */
async function worshipPollEtag(prisma, session, userId) {
  const id = session.id;
  const rows = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*) FROM worship_likert_responses WHERE session_id = ${id}) AS likert_n,
      (SELECT UNIX_TIMESTAMP(MAX(updated_at)) FROM worship_likert_responses WHERE session_id = ${id}) AS likert_u,
      (SELECT COUNT(*) FROM worship_likert_items WHERE session_id = ${id}) AS items_n,
      (SELECT COALESCE(SUM(CRC32(CONCAT(id, text, IFNULL(gospel_note, ''), sort_order))), 0) FROM worship_likert_items WHERE session_id = ${id}) AS items_h,
      (SELECT COUNT(*) FROM worship_chip_votes WHERE session_id = ${id}) AS votes_n,
      (SELECT UNIX_TIMESTAMP(MAX(created_at)) FROM worship_chip_votes WHERE session_id = ${id}) AS votes_c,
      (SELECT COUNT(*) FROM worship_chips WHERE session_id = ${id}) AS chips_n,
      (SELECT COALESCE(SUM(CRC32(CONCAT(id, label, is_active))), 0) FROM worship_chips WHERE session_id = ${id}) AS chips_h,
      (SELECT COUNT(*) FROM worship_notes WHERE session_id = ${id}) AS notes_n,
      (SELECT UNIX_TIMESTAMP(MAX(updated_at)) FROM worship_notes WHERE session_id = ${id}) AS notes_u,
      (SELECT COUNT(*) FROM worship_lab_updates WHERE session_id = ${id}) AS lab_n,
      (SELECT UNIX_TIMESTAMP(MAX(created_at)) FROM worship_lab_updates WHERE session_id = ${id}) AS lab_c,
      (SELECT UNIX_TIMESTAMP(MAX(acknowledged_at)) FROM worship_lab_updates WHERE session_id = ${id}) AS lab_a
  `;
  const row = rows?.[0] || {};
  let mine = '';
  if (userId) {
    const mineRows = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM worship_likert_responses WHERE session_id = ${id} AND user_id = ${userId}) AS n,
        (SELECT UNIX_TIMESTAMP(MAX(updated_at)) FROM worship_likert_responses WHERE session_id = ${id} AND user_id = ${userId}) AS u,
        (SELECT COUNT(*) FROM worship_notes WHERE session_id = ${id} AND user_id = ${userId}) AS nn,
        (SELECT UNIX_TIMESTAMP(MAX(updated_at)) FROM worship_notes WHERE session_id = ${id} AND user_id = ${userId}) AS nu,
        (SELECT COUNT(*) FROM worship_chip_votes WHERE session_id = ${id} AND user_id = ${userId}) AS vn
    `;
    const m = mineRows?.[0] || {};
    mine = [m.n, m.u, m.nn, m.nu, m.vn].map(numCell).join(',');
  }
  return weakEtag([
    'worship',
    id,
    userId || '',
    session.updatedAt,
    session.status,
    session.startedAt,
    session.wrapUpAt,
    session.pattern?.updatedAt,
    ...['likert_n', 'likert_u', 'items_n', 'items_h', 'votes_n', 'votes_c', 'chips_n', 'chips_h', 'notes_n', 'notes_u', 'lab_n', 'lab_c', 'lab_a'].map((key) => numCell(row[key])),
    mine,
  ]);
}

async function tryWorshipEtag(prisma, session, userId) {
  try {
    return await worshipPollEtag(prisma, session, userId);
  } catch {
    return null;
  }
}

/** Rata-rata jawaban Likert per item (untuk delta pre→post film). */
async function likertMeans(prisma, sessionId) {
  try {
    const rows = await prisma.worshipLikertResponse.groupBy({
      by: ['itemId'],
      where: { sessionId },
      _avg: { value: true },
      _count: { _all: true },
    });
    const out = {};
    for (const r of rows) out[r.itemId] = { avg: Number(r._avg?.value) || 0, n: Number(r._count?._all) || 0 };
    return out;
  } catch {
    return {};
  }
}

/** Agregat ronde film untuk layar (rata-rata PRE vs POST + delta). */
async function filmRoundMeans(prisma, sessionId) {
  try {
    const rows = await prisma.worshipLikertResponse.groupBy({
      by: ['topicCode'],
      where: { sessionId },
      _avg: { value: true },
      _count: { _all: true },
    });
    const pick = (code) => rows.find((r) => String(r.topicCode || '').toUpperCase() === code);
    const pre = pick('FILM_PRE');
    const post = pick('FILM_POST');
    const preAvg = pre ? Number(pre._avg?.value) || 0 : null;
    const postAvg = post ? Number(post._avg?.value) || 0 : null;
    return {
      pre: { avg: preAvg, n: pre ? Number(pre._count?._all) || 0 : 0 },
      post: { avg: postAvg, n: post ? Number(post._count?._all) || 0 : 0 },
      delta: preAvg != null && postAvg != null ? Math.round((postAvg - preAvg) * 10) / 10 : null,
    };
  } catch {
    return { pre: { avg: null, n: 0 }, post: { avg: null, n: 0 }, delta: null };
  }
}

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
// Creative Lab dan 10 rumah Beyonders hidup di unit Pemuda.
const YOUTH_TENANT = YOUTH_TENANT_ID;
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
    // Gate Likert 2 ronde (BEDAH_FILM: AWAL baseline + AKHIR delta; ditulis endpoint stage).
    likertRounds: c.likertRounds && typeof c.likertRounds === 'object' && !Array.isArray(c.likertRounds) ? c.likertRounds : null,
    // Timer fase aktif (MONOLOG: F1 20' + F2 25' + F3 10' + Closing 5'; display-only).
    phase: c.phase && typeof c.phase === 'object' && !Array.isArray(c.phase) ? c.phase : null,
    // Preferensi tiap fase (durasi + tampil di layar; diatur kontrol; default baku).
    phasePrefs: c.phasePrefs && typeof c.phasePrefs === 'object' && !Array.isArray(c.phasePrefs)
      ? c.phasePrefs
      : null,
    // Panggung Creative Lab (fase A1/A2/Presentasi + kartu jar + kelompok presentasi).
    activity: cleanActivity(c.activity),
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

/**
 * Pertanyaan deep sharing dari draft sesi.
 * BEDAH_FILM menyimpan `film-q1..3` (bukan `deep-q1/2`) — kembalikan 3 item
 * agar Q draf tampil di peserta/layar/rekap, bukan generik.
 */
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
  if (['film-q1', 'film-q2', 'film-q3'].some((k) => String(deep[k] || '').trim())) {
    return [
      pick(deep, ['film-q1']) || 'Adegan film mana yang paling kena ke kamu?',
      pick(deep, ['film-q2']) || 'Kaitan apa dengan firman pekan ini?',
      pick(deep, ['film-q3']) || 'Langkah otentik apa minggu ini?',
    ];
  }
  return [
    pick(deep, ['deep-q1', 'q1']) || 'Di mana kamu melihat dirimu dalam teks pekan ini?',
    pick(deep, ['deep-q2', 'q2']) || 'Langkah pulang apa minggu ini?',
  ];
}

/**
 * Enam kartu Reminder Jar (CREATIVE_LAB). Teks arahan diambil dari
 * draft sesi (`jar`), fallback generik bila belum diisi.
 * Tema pekan ada di subjudul, bukan di nama aktivitas.
 */
export const CREATIVE_LAB_JAR = [
  { key: 'root', code: 'JAR-ROOT', title: 'A Root I Carry', field: 'jar-root', fallback: 'Nilai iman atau tradisi baik dari keluarga/GMIM yang ingin kamu bawa ke mana pun pergi.' },
  { key: 'truth', code: 'JAR-TRUTH', title: 'A Truth I Need to Remember', field: 'jar-truth', fallback: 'Kebenaran tentang Kristus/Injil yang ingin kamu ingat saat masa sulit.' },
  { key: 'lost', code: 'JAR-LOST', title: 'When I Feel Lost', field: 'jar-lost', fallback: 'Pesan penguatan untuk dirimu sendiri saat merasa jauh dari Tuhan atau kehilangan arah.' },
  { key: 'community', code: 'JAR-COMMUNITY', title: 'A Word for My Community', field: 'jar-community', fallback: 'Pesan positif untuk anggota kelompokmu sebagai saudara seiman.' },
  { key: 'verse', code: 'JAR-VERSE', title: 'A Verse to Hold Onto', field: 'jar-verse', fallback: 'Satu ayat Alkitab + referensi yang ingin kamu pegang dalam perjalanan iman.' },
  { key: 'step', code: 'JAR-STEP', title: 'My Next Faith Step', field: 'jar-step', fallback: 'Satu tindakan nyata untuk menghidupi Injil dalam minggu-minggu mendatang.' },
];

export function jarCards(config) {
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  const jar = draft.jar && typeof draft.jar === 'object' ? draft.jar : {};
  return CREATIVE_LAB_JAR.map((c) => ({
    key: c.key,
    code: c.code,
    title: c.title,
    direction: String(jar[c.field] || '').trim() || c.fallback,
  }));
}

/** Briefing Creative Lab (dari draft sesi) — tampil di layar & HP peserta. */
export function creativeLabBrief(config) {
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  const sec = (k) => (draft[k] && typeof draft[k] === 'object' ? draft[k] : {});
  const pick = (o, keys, fallback = '') => {
    for (const k of keys) {
      const v = String(o[k] || '').trim();
      if (v) return v;
    }
    return fallback;
  };
  const briefing = sec('briefing');
  const a1 = sec('activity-1');
  const a2 = sec('activity-2');
  const present = sec('present');
  const closing = sec('closing');
  const legacyA1 = new Set(['the roots reminder jar', 'roots reminder jar']);
  const legacyA2 = new Set(['roots & dna creative lab', 'roots and dna creative lab']);
  const genericTitle = (raw, fallback, legacy) => {
    const v = String(raw || '').trim();
    if (!v || legacy.has(v.toLowerCase())) return fallback;
    return v;
  };
  const stationA = {
    media: pick(a2, ['a2-a-media', 'a2-station-a-media'], 'Pot'),
    theme: pick(a2, ['a2-a-theme', 'a2-station-a-theme'], 'Grow What You Believe'),
  };
  const stationB = {
    media: pick(a2, ['a2-b-media', 'a2-station-b-media'], 'Tas'),
    theme: pick(a2, ['a2-b-theme', 'a2-station-b-theme'], 'Carry the Gospel'),
  };
  return {
    briefing: {
      core: pick(briefing, ['brief-core']),
      rules: pick(briefing, ['brief-rules']),
      jarIntro: pick(briefing, ['jar-intro']),
      scribe: pick(briefing, ['brief-scribe'], 'Umumkan perwakilan pencatat tiap kelompok.'),
      draw: pick(briefing, ['brief-draw'], 'Umumkan pengundian urutan presentasi kelompok.'),
    },
    a1: {
      title: genericTitle(pick(a1, ['a1-title'], ''), 'Reminder Jar', legacyA1),
      subtitle: pick(a1, ['a1-subtitle', 'a1-theme'], 'Roots'),
      goal: pick(a1, ['a1-goal']),
      tools: pick(a1, ['a1-tools']),
      steps: pick(a1, ['a1-steps']),
      output: pick(a1, ['a1-output']),
      minutes: Math.max(1, Number(pick(a1, ['a1-minutes'], '15')) || 15),
    },
    a2: {
      title: genericTitle(pick(a2, ['a2-title'], ''), 'Art Stations', legacyA2),
      goal: pick(a2, ['a2-goal']),
      tools: pick(a2, ['a2-tools']),
      stationA,
      stationB,
      pot: pick(a2, ['a2-pot'], 'Gambarkan apa yang perlu dirawat agar iman dan nilai Injil terus bertumbuh (akar, tunas, atau buah).'),
      bag: pick(a2, ['a2-bag'], 'Gambarkan nilai Injil yang ingin kalian bawa ke dalam kehidupan sehari-hari.'),
      potMeaning: pick(a2, ['a2-pot-meaning'], 'Apa yang kita percayai seharusnya bertumbuh dan terlihat dalam hidup kita. Pot melambangkan tempat benih iman bertumbuh. Peserta dapat melukis simbol akar, tunas, atau buah sebagai gambaran iman yang dirawat melalui tindakan nyata.'),
      bagMeaning: pick(a2, ['a2-bag-meaning'], 'Membawa Injil ke mana pun kita pergi. Tas kanvas menjadi simbol kehidupan pemuda perantauan. Di mana pun mereka tinggal, bekerja, belajar, dan bergaul, mereka tetap dapat membawa nilai kasih, kerendahan hati, pelayanan, dan persatuan dalam Kristus.'),
      report: pick(a2, ['a2-report'], 'Perwakilan setiap kelompok maju melapor kepada Admin.'),
      commit: pick(a2, ['a2-commit'], 'Sertakan satu kata, simbol, atau kalimat pendek yang mewakili komitmen kelompok.'),
      minutes: Math.max(1, Number(pick(a2, ['a2-minutes'], '25')) || 25),
    },
    present: {
      order: pick(present, ['present-order']),
      questions: pick(present, ['present-questions']),
      seconds: Math.min(600, Math.max(30, Number(pick(present, ['present-seconds'], '150')) || 150)),
    },
    closing: {
      script: pick(closing, ['closing-script']),
      commit: pick(closing, ['closing-commit']),
      prayer: pick(closing, ['closing-prayer']),
    },
  };
}

/* ---------------- Creative Lab — update karya kelompok ---------------- */

const LAB_KINDS = ['POT', 'BAG', 'COMMIT', 'GROUP', 'NOTE'];
export const LAB_PHOTO_LIMIT = { POT: 2, BAG: 2, GROUP: 1 };
const LAB_PHASE_WRITABLE = 'A2';

/** Kuota foto per slot. Dipakai unggah perwakilan dan unggah admin. */
export function labPhotoQuota(rows, kind, labels = {}) {
  const key = String(kind || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(LAB_PHOTO_LIMIT, key)) {
    return { ok: false, status: 400, error: 'Slot foto harus POT, BAG, atau GROUP.' };
  }
  const used = labPhotoCount(Array.isArray(rows) ? rows : [], key);
  const limit = LAB_PHOTO_LIMIT[key];
  if (used >= limit) {
    const mediaA = String(labels.mediaA || '').trim();
    const mediaB = String(labels.mediaB || '').trim();
    const label = key === 'GROUP'
      ? 'Foto Bersama'
      : key === 'POT'
        ? `Foto Stasiun A${mediaA ? ` (${mediaA})` : ''}`
        : `Foto Stasiun B${mediaB ? ` (${mediaB})` : ''}`;
    return { ok: false, status: 400, error: `Kuota ${label} sudah penuh (maks ${limit}). Hapus salah satu dulu untuk mengganti.` };
  }
  return { ok: true, kind: key, limit, used };
}

/**
 * Pengurus sesi (peran yang boleh mengendalikan kontrol) boleh unggah
 * atas nama kelompok saat A2, presentasi, atau penutupan (WRAPUP/DONE).
 */
export function adminLabPhotoAllowed({ roles, status, phase }) {
  const list = (Array.isArray(roles) ? roles : [])
    .map((r) => (typeof r === 'string' ? r : r?.role))
    .filter(Boolean);
  if (!list.some((role) => WRITE_ROLES.includes(role))) {
    return { ok: false, status: 403, error: 'Hanya pengurus sesi yang bisa mengunggah atas nama kelompok.' };
  }
  const st = String(status || '').toUpperCase();
  const ph = String(phase || '').toUpperCase();
  if (!['RUNNING', 'WRAPUP'].includes(st)) {
    return { ok: false, status: 409, error: 'Sesi belum berjalan atau sudah ditutup.' };
  }
  if (ph === 'A2' || ph === 'PRESENT' || ph === 'DONE' || st === 'WRAPUP') return { ok: true };
  return { ok: false, status: 409, error: 'Upload admin hanya saat Sesi 2, presentasi, atau penutupan.' };
}

function labDriveWriteEnabled() {
  return process.env.GDRIVE_WRITE === '1' || hasUserDriveToken();
}

function labPhotoCount(rows, kind) {
  return rows.filter((r) => r.kind === kind && r.photoUrl).length;
}

function labTeamRows(rows, teamIndex) {
  return rows.filter((r) => Number(r.teamIndex) === Number(teamIndex));
}

function isWorshipWriter(req) {
  return (req?.authUser?.roles || []).some((r) => WRITE_ROLES.includes(typeof r === 'string' ? r : r?.role));
}

/**
 * Tim yang memuat user (perwakilan atau anggota).
 * Admin (`opts.asAdmin` + `teamIndex`) boleh mengerjakan kelompok mana pun
 * tanpa harus masuk sebagai anggota. Kunci simpan tetap indeks tim.
 */
export function findLabTeam(config, userId, opts = {}) {
  const teams = Array.isArray(config?.teams?.teams) ? config.teams.teams : [];
  const uid = String(userId || '');
  let memberHit = null;
  if (uid) {
    for (let index = 0; index < teams.length; index += 1) {
      const team = teams[index];
      const isRep = String(team?.repUserId || '') === uid;
      const isMember = (Array.isArray(team?.memberUserIds) ? team.memberUserIds : []).some((id) => String(id) === uid);
      if (isRep || isMember) {
        memberHit = { index, team, isRep };
        break;
      }
    }
  }
  if (opts.asAdmin && opts.teamIndex != null && opts.teamIndex !== '') {
    const index = Math.floor(Number(opts.teamIndex));
    if (Number.isInteger(index) && index >= 0 && index < teams.length && teams[index]) {
      return { index, team: teams[index], isRep: true, asAdmin: true };
    }
  }
  return memberHit;
}

function labActor(config, req, teamIndex) {
  return findLabTeam(config, req.authUser?.id, {
    asAdmin: isWorshipWriter(req),
    teamIndex,
  });
}

function labDenied(req) {
  return isWorshipWriter(req)
    ? 'Pilih kelompok yang akan dikerjakan. Admin tidak perlu masuk sebagai anggota.'
    : 'Kamu belum terdaftar di kelompok Creative Lab. Hubungi Admin.';
}

/** Urutan presentasi: hasil undian + tim baru yang belum masuk, tanpa duplikat. */
export function labPresentationOrder(activity, teamCount) {
  const count = Math.max(0, Number(teamCount) || 0);
  const out = [];
  for (const n of Array.isArray(activity?.presentOrder) ? activity.presentOrder : []) {
    const i = Math.floor(Number(n));
    if (Number.isInteger(i) && i >= 0 && i < count && !out.includes(i)) out.push(i);
  }
  for (let i = 0; i < count; i += 1) if (!out.includes(i)) out.push(i);
  return out;
}

function labRowPublic(row, userName = '') {
  return {
    id: row.id,
    teamIndex: row.teamIndex,
    teamName: row.teamName,
    userId: row.userId,
    userName,
    kind: row.kind,
    body: row.body || '',
    progress: row.progress == null ? null : Number(row.progress),
    photoUrl: row.photoUrl || null,
    thumbUrl: row.thumbUrl || row.photoUrl || null,
    acknowledgedAt: row.acknowledgedAt ? new Date(row.acknowledgedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function labRows(prisma, sessionId, teamIndex = null) {
  try {
    return await prisma.worshipLabUpdate.findMany({
      where: { sessionId, ...(teamIndex == null ? {} : { teamIndex: Number(teamIndex) }) },
      orderBy: { createdAt: 'desc' },
      take: 600,
    });
  } catch {
    return [];
  }
}

async function labRowsWithNames(prisma, rows) {
  const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const byId = new Map(users.map((u) => [u.id, u.name || '']));
  return rows.map((r) => labRowPublic(r, byId.get(r.userId) || ''));
}

/** Ringkasan per tim untuk kontrol/layar: makna, progress, foto, komitmen. */
export function labSummary(rows, teams, activity) {
  const list = (Array.isArray(teams) ? teams : []).map((team, index) => {
    const mine = labTeamRows(rows, index);
    const latestWith = (kind) => mine.find((r) => r.kind === kind && (String(r.body || '').trim() || r.progress != null)) || null;
    const latestPhoto = (kind) => mine.find((r) => r.kind === kind && r.photoUrl) || null;
    const pot = latestWith('POT');
    const bag = latestWith('BAG');
    const commit = latestWith('COMMIT');
    const potPhotos = mine.filter((r) => r.kind === 'POT' && r.photoUrl).slice(0, 2);
    const bagPhotos = mine.filter((r) => r.kind === 'BAG' && r.photoUrl).slice(0, 2);
    const groupPhoto = latestPhoto('GROUP');
    const lastUpdateAt = mine[0]?.createdAt ? new Date(mine[0].createdAt).toISOString() : null;
    return {
      index,
      name: team.name,
      repName: team.repName || '',
      repUserId: team.repUserId || '',
      memberCount: Array.isArray(team.memberUserIds) ? team.memberUserIds.length : (team.members || []).length,
      done: Boolean(team.done),
      pot: {
        meaning: pot?.body || '',
        progress: pot?.progress == null ? null : Number(pot.progress),
        photos: potPhotos.map((r) => labRowPublic(r)),
      },
      bag: {
        meaning: bag?.body || '',
        progress: bag?.progress == null ? null : Number(bag.progress),
        photos: bagPhotos.map((r) => labRowPublic(r)),
      },
      commitment: commit?.body || '',
      groupPhoto: groupPhoto ? labRowPublic(groupPhoto) : null,
      photoCount: potPhotos.length + bagPhotos.length + (groupPhoto ? 1 : 0),
      photoComplete: Boolean(groupPhoto) && potPhotos.length <= 2 && bagPhotos.length <= 2,
      lastUpdateAt,
      updateCount: mine.length,
    };
  });
  const order = labPresentationOrder(activity, list.length);
  return { teams: list, presentOrder: order };
}

/** Nama pengunggah (userId baris) menempel di foto kontrol. */
function stampLabUploaders(summary, namedRows) {
  const names = new Map((Array.isArray(namedRows) ? namedRows : []).map((r) => [r.id, r.userName || '']));
  const tag = (photo) => (photo?.id ? { ...photo, userName: names.get(photo.id) || photo.userName || '' } : photo);
  return {
    ...summary,
    teams: (summary?.teams || []).map((team) => ({
      ...team,
      pot: { ...team.pot, photos: (team.pot?.photos || []).map(tag) },
      bag: { ...team.bag, photos: (team.bag?.photos || []).map(tag) },
      groupPhoto: tag(team.groupPhoto),
    })),
  };
}

const labFolderChain = new Map();

function lockLabFolder(key, fn) {
  const prev = labFolderChain.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tracked = run.finally(() => {
    if (labFolderChain.get(key) === tracked) labFolderChain.delete(key);
  });
  labFolderChain.set(key, tracked);
  return tracked;
}

/** Anak folder polos. Nama yang sudah ada dipakai ulang; tidak ada rename/move. */
async function ensurePlainChild(parentId, name) {
  const plain = plainFolderName(name);
  if (!plain || !parentId) return null;
  return lockLabFolder(`${parentId}:${plain.toLowerCase()}`, async () => {
    const subs = await listAllFolders(parentId, { fresh: true }).catch(() => []);
    const found = pickFolderByName(subs, plain);
    if (found?.id) return found.id;
    const created = await driveCreateFolder(parentId, plain).catch(() => null);
    return created?.id || null;
  });
}

/**
 * Folder event Didaskalia yang sudah bertag [EV:<slug>:DIDASKALIA].
 * Tidak membuat kembaran bila tag sudah ketemu, dan tidak mengubah nama folder itu.
 */
async function resolveDidaskaliaEventFolder(prisma, session) {
  if (!session?.eventId) return null;
  const [event, div] = await Promise.all([
    prisma.eventProgram.findUnique({
      where: { id: session.eventId },
      select: { id: true, name: true, slug: true },
    }).catch(() => null),
    prisma.eventDivision.findUnique({
      where: { eventId_division: { eventId: session.eventId, division: 'DIDASKALIA' } },
      select: { driveFolderId: true },
    }).catch(() => null),
  ]);
  if (!event?.slug) return null;
  if (div?.driveFolderId) {
    try {
      const meta = await getFolderMeta(div.driveFolderId);
      if (pickEventFolder([meta], event.slug)?.id) return meta.id;
    } catch {
      /* id tersimpan tidak terbaca — cari lewat tag */
    }
  }
  const found = await findFoldersNamed(`[EV:${event.slug}:DIDASKALIA]`).catch(() => []);
  const match = pickEventFolder(found, event.slug);
  if (match?.id) return match.id;
  const { createEventFolder } = await import('../gdrive-events.mjs');
  return createEventFolder(event, 'DIDASKALIA');
}

/**
 * Foto baru: `<event> [EV:slug:DIDASKALIA]/Foto Kelompok|Hasil Karya/<kelompok>`.
 * Folder lama "Creative Lab/<slug>" tidak dipindahkan.
 */
async function ensureLabFolder(prisma, session, { kind, groupName } = {}) {
  const eventFolderId = await resolveDidaskaliaEventFolder(prisma, session);
  if (!eventFolderId) return null;
  const bucketId = await ensurePlainChild(eventFolderId, bucketForPhotoKind(kind));
  if (!bucketId) return null;
  return ensurePlainChild(bucketId, groupName || 'Kelompok');
}

/** Kelompok youth aktif + userId yang sudah check-in pada event sesi. */
async function loadCreativeLabGroupSource(prisma, eventId) {
  const groups = await prisma.group.findMany({
    where: { tenantId: YOUTH_TENANT, status: 'ACTIVE' },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: 'asc' },
    take: 60,
  }).catch(() => []);
  let checkedInIds = [];
  if (eventId) {
    const [attendees, scans] = await Promise.all([
      prisma.eventAttendee.findMany({
        where: { eventId, checkedInAt: { not: null } },
        select: { userId: true },
        take: 800,
      }).catch(() => []),
      prisma.eventCheckIn.findMany({
        where: { eventId, result: 'OK' },
        select: { userId: true },
        take: 800,
      }).catch(() => []),
    ]);
    checkedInIds = [...new Set([...attendees, ...scans].map((r) => r.userId).filter(Boolean))];
  }
  return {
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      members: (g.members || [])
        .filter((m) => m.userId)
        .map((m) => ({ id: m.userId, name: m.user?.name || m.name || '' })),
    })),
    checkedInIds,
  };
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
 * Afirmasi firman BEDAH_FILM dari draft sesi (section `affirm`).
 * Tampil otomatis di HP peserta setelah menjawab: per Q catatan
 * (FILM-Q1..3) + varian Likert rendah/tinggi. Fallback generik dari
 * 1Kor 15 / Yoh 20 / Kis 4 bila draf belum diisi.
 */
export function filmAffirm(config) {
  const draft = config.draft && typeof config.draft === 'object' ? config.draft : {};
  const a = draft.affirm && typeof draft.affirm === 'object' ? draft.affirm : {};
  const pick = (key, fallback) => String(a[key] || '').trim() || fallback;
  return {
    notes: {
      'FILM-Q1': pick('affirm-q1', 'Kejujuranmu dilihat Tuhan — Ia mati untuk dosamu sesuai Kitab Suci (1Kor 15:3). Topeng boleh tanggal di hadapan-Nya.'),
      'FILM-Q2': pick('affirm-q2', 'Kristus menampakkan diri kepada lebih dari 500 saudara (1Kor 15:6) — bukti itu untukmu juga, bukan cuma mereka.'),
      'FILM-Q3': pick('affirm-q3', 'Sebab tidak mungkin bagi kami untuk tidak berkata-kata tentang apa yang telah kami lihat dan dengar (Kis 4:20) — langkah kecilmu adalah kesaksian.'),
    },
    likertLow: pick('affirm-likert-low', 'Meragukan itu manusiawi — Tomas pun ragu, dan Yesus datang menemuinya (Yoh 20:27). Tetap jalan, tetap cari.'),
    likertHigh: pick('affirm-likert-high', 'Imanmu bertumbuh — teguh, giat, dan berlimpah dalam pekerjaan Tuhan (1Kor 15:58). Jadilah saksi minggu ini.'),
  };
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
  const shown = presentWorshipPattern(pattern);
  return {
    code: shown.code,
    name: shown.name,
    summary: shown.summary,
    defaultDurationMin: shown.defaultDurationMin,
    phases: shown.phases || [],
    modules: shown.modules || [],
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
        include: { pattern: PATTERN_LEAN },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timed = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timed);
      if (!live.pattern && session.pattern) live.pattern = session.pattern;
      const baseEtag = await tryWorshipEtag(prisma, live, req.authUser.id);
      const etag = baseEtag && req.query?.teamIndex != null && String(req.query.teamIndex) !== ''
        ? weakEtag([baseEtag, String(req.query.teamIndex)])
        : baseEtag;
      if (etag && finishIfMatch(req, res, etag)) return;

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
      const pcode = String(live.pattern?.code || session.pattern?.code || '').toUpperCase();
      const writer = isWorshipWriter(req);
      const myLabTeam = pcode === 'CREATIVE_LAB'
        ? findLabTeam(config, req.authUser.id, { asAdmin: writer, teamIndex: req.query?.teamIndex })
        : null;
      const myLabRows = myLabTeam ? await labRows(prisma, live.id, myLabTeam.index) : [];
      const myLabUpdates = myLabTeam ? await labRowsWithNames(prisma, myLabRows) : [];
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
          // Gate 2 ronde film (AWAL/AKHIR) + rata-rata per item untuk delta pre→post.
          rounds: config.likertRounds || { pre: 'open', post: 'closed' },
          means: await likertMeans(prisma, live.id),
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
        affirmations: pcode === 'BEDAH_FILM' ? filmAffirm(config) : null,
        fgd: fgdState(config),
        phase: config.phase || null,
        activity: pcode === 'CREATIVE_LAB' ? config.activity || null : null,
        activityBrief: pcode === 'CREATIVE_LAB' ? creativeLabBrief(config) : null,
        jarCards: pcode === 'CREATIVE_LAB' ? jarCards(config) : [],
        lab: pcode === 'CREATIVE_LAB' ? {
          teamIndex: myLabTeam?.index ?? null,
          teamName: myLabTeam?.team?.name || null,
          isRep: Boolean(myLabTeam?.isRep),
          asAdmin: writer,
          teamChoices: writer
            ? (Array.isArray(config.teams?.teams) ? config.teams.teams : []).map((t, index) => ({
              index,
              name: t?.name || `Kelompok ${index + 1}`,
            }))
            : [],
          repName: myLabTeam?.team?.repName || '',
          members: Array.isArray(myLabTeam?.team?.members) ? myLabTeam.team.members : [],
          done: Boolean(myLabTeam?.team?.done),
          phase: config.activity?.phase || 'IDLE',
          updates: myLabUpdates,
        } : null,
        phasePrefs: config.phasePrefs || null,
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

      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.body?.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      if (!['LIKERT_OPEN', 'RUNNING'].includes(session.status)) {
        return res.status(409).json({ error: 'Form Likert belum dibuka atau sudah ditutup.' });
      }

      // Ronde film (BEDAH_FILM): PRE = baseline awal, POST = ukur delta.
      // Tanpa `round` = perilaku lama (semua item wajib, untuk Post-to-Post).
      const round = String(req.body?.round || '').toUpperCase();
      if (round && round !== 'PRE' && round !== 'POST') {
        return res.status(400).json({ error: 'Ronde harus PRE atau POST.' });
      }
      const sessionConfig = normalizeConfig(session.config, session.pattern?.code);
      if (round) {
        const gate = (sessionConfig.likertRounds || { pre: 'open', post: 'closed' })[round.toLowerCase()];
        if (gate === 'closed') {
          return res.status(409).json({ error: `Likert ${round === 'PRE' ? 'AWAL' : 'AKHIR'} belum dibuka operator.` });
        }
      }
      const allItems = await prisma.worshipLikertItem.findMany({ where: { sessionId: session.id } });
      const items = round ? allItems.filter((i) => String(i.topicCode || '').toUpperCase() === `FILM_${round}`) : allItems;
      const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
      const rows = [];
      for (const item of items) {
        const value = clampScale(answers[item.id]);
        if (value === null) {
          return res.status(400).json({ error: 'Semua pertanyaan wajib diisi dengan skala 1–5.' });
        }
        rows.push({ item, value });
      }
      if (!rows.length) {
        return res.status(400).json({ error: round ? `Sesi belum memiliki pertanyaan ronde ${round}.` : 'Sesi belum memiliki pertanyaan.' });
      }

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

      // Pola tanpa topik rank (mis. film): tanpa alokasi ruang — balas hitungan + afirmasi firman.
      if (!sessionConfig.topics.length) {
        const affirm = filmAffirm(sessionConfig);
        const avg = rows.length ? rows.reduce((n, r) => n + r.value, 0) / rows.length : 0;
        return res.json({ ok: true, round: round || null, answered: rows.length, total: items.length, affirmation: avg <= 3 ? affirm.likertLow : affirm.likertHigh });
      }

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

      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.body?.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timedNote = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timedNote);
      if (!['LIKERT_OPEN', 'RUNNING', 'WRAPUP'].includes(live.status)) {
        return res.status(409).json({ error: 'Catatan hanya bisa diisi saat sesi berlangsung.' });
      }

      const config = normalizeConfig(live.config, session.pattern?.code);
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

      // Reminder Jar: setiap peserta hanya boleh menyimpan 2 dari 6 pertanyaan.
      if (String(session.pattern?.code || '').toUpperCase() === 'CREATIVE_LAB') {
        const jarCodes = new Set(CREATIVE_LAB_JAR.map((c) => c.code));
        const jarRows = rows.filter((r) => jarCodes.has(r.topicCode) && String(r.content || '').trim());
        if (jarRows.length > 2) {
          return res.status(400).json({ error: 'Pilih maksimal 2 pertanyaan Reminder Jar untuk diisi di web.' });
        }
        const incomingCodes = new Set(jarRows.map((r) => r.topicCode));
        const existingJar = await prisma.worshipNote.findMany({
          where: { sessionId: live.id, userId: req.authUser.id, topicCode: { in: [...jarCodes] } },
          select: { topicCode: true, content: true },
        });
        const kept = existingJar.filter((n) => !incomingCodes.has(n.topicCode) && String(n.content || '').trim());
        if (kept.length + jarRows.length > 2) {
          return res.status(400).json({ error: 'Kamu sudah menyimpan 2 pertanyaan. Kosongkan salah satu dulu untuk mengganti.' });
        }
      }

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
      // Afirmasi per Q film yang baru disimpan (tampil otomatis di HP peserta).
      const affirm = filmAffirm(config);
      const affirmations = {};
      for (const { topicCode, content } of rows) {
        if (content && affirm.notes[topicCode]) affirmations[topicCode] = affirm.notes[topicCode];
      }
      res.json({ ok: true, notes, affirmations });
    }),
  );

  /* ------------- Creative Lab: update/photo perwakilan kelompok ------------- */

  app.get(
    '/api/worship/sessions/:id/participants',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

      let participants = [];
      if (found.eventId) {
        const attendees = await prisma.eventAttendee.findMany({
          where: { eventId: found.eventId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { registeredAt: 'asc' },
          take: 500,
        }).catch(() => []);
        participants = attendees.map((a) => a.user).filter(Boolean);
      }
      if (!participants.length) {
        const roles = await prisma.userRole.findMany({
          where: { tenantId: YOUTH_TENANT },
          include: { user: { select: { id: true, name: true, email: true } } },
          take: 1000,
        }).catch(() => []);
        participants = roles.map((r) => r.user).filter(Boolean);
      }
      const byId = new Map(participants.map((u) => [u.id, u]));
      const src = await loadCreativeLabGroupSource(prisma, found.eventId);
      const checked = new Set(src.checkedInIds);
      res.json({
        participants: [...byId.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        groups: src.groups.map((g) => ({
          id: g.id,
          name: g.name,
          members: g.members.map((m) => ({ id: m.id, name: m.name, checkedIn: checked.has(m.id) })),
        })),
      });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/lab/load-groups',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      if (String(session.pattern?.code || '').toUpperCase() !== 'CREATIVE_LAB') {
        return res.status(400).json({ error: 'Muat kelompok hanya untuk Creative Lab.' });
      }
      const config = normalizeConfig(session.config, session.pattern?.code);
      const [src, updateCount] = await Promise.all([
        loadCreativeLabGroupSource(prisma, session.eventId),
        prisma.worshipLabUpdate.count({ where: { sessionId: session.id } }).catch(() => 0),
      ]);
      const lockOrder = updateCount > 0;
      const built = buildCreativeLabTeams(src.groups, {
        checkedInIds: src.checkedInIds,
        existingTeams: config.teams?.teams || [],
        lockOrder,
      });
      const cleaned = cleanTeams({ teams: built.teams }, { maxTeams: LAB_MAX_TEAMS });
      if (!cleaned) return res.status(400).json({ error: 'Tidak ada kelompok yang bisa dimuat.' });
      const activity = cleanActivity({
        ...(config.activity || {}),
        ...(lockOrder ? {} : { presentOrder: [], presentDrawnAt: null, presentIndex: 0, presentSlide: 0 }),
      });
      await prisma.worshipSession.update({
        where: { id: session.id },
        data: { config: { ...config, teams: cleaned, activity } },
      });
      res.json({
        ok: true,
        teams: cleaned.teams,
        missing: built.missing,
        orderLocked: lockOrder,
      });
    }),
  );

  app.post(
    '/api/worship/session/:slug/lab/updates',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timed = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timed);
      if (!['RUNNING', 'WRAPUP'].includes(live.status)) {
        return res.status(409).json({ error: 'Sesi belum berjalan atau sudah ditutup.' });
      }
      if (String(session.pattern?.code || '').toUpperCase() !== 'CREATIVE_LAB') {
        return res.status(400).json({ error: 'Fitur ini hanya untuk Creative Lab.' });
      }
      const config = normalizeConfig(live.config, session.pattern?.code);
      if (String(config.activity?.phase || '').toUpperCase() !== LAB_PHASE_WRITABLE) {
        return res.status(409).json({ error: 'Update karya hanya dibuka saat Activity 2.' });
      }
      const mine = labActor(config, req, req.body?.teamIndex);
      if (!mine) return res.status(403).json({ error: labDenied(req) });

      const kind = String(req.body?.kind || '').toUpperCase();
      if (!['POT', 'BAG', 'COMMIT', 'NOTE'].includes(kind)) {
        return res.status(400).json({ error: 'Jenis update tidak dikenal.' });
      }
      if (kind !== 'NOTE' && !mine.isRep) {
        return res.status(403).json({ error: 'Hanya perwakilan kelompok yang bisa mengubah makna, progress, dan komitmen.' });
      }
      const body = str(req.body?.body, 2000);
      const progressRaw = req.body?.progress;
      const progress = progressRaw === undefined || progressRaw === null || progressRaw === ''
        ? null
        : Math.min(100, Math.max(0, Math.round(Number(progressRaw) || 0)));
      if (kind === 'COMMIT' && !body) return res.status(400).json({ error: 'Komitmen kelompok wajib diisi.' });
      if (kind === 'NOTE' && !body) return res.status(400).json({ error: 'Catatan tidak boleh kosong.' });
      if ((kind === 'POT' || kind === 'BAG') && !body && progress == null) {
        return res.status(400).json({ error: 'Isi makna/progress karya dulu.' });
      }

      const row = await prisma.worshipLabUpdate.create({
        data: {
          id: uid('wlu'),
          sessionId: live.id,
          teamIndex: mine.index,
          teamName: String(mine.team.name || '').slice(0, 80),
          userId: req.authUser.id,
          kind,
          body: body || null,
          progress: kind === 'POT' || kind === 'BAG' ? progress : null,
        },
      });
      res.status(201).json({ ok: true, update: labRowPublic(row, req.authUser.name || '') });
    }),
  );

  app.post(
    '/api/worship/session/:slug/lab/photos',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      if (!labDriveWriteEnabled()) return res.status(403).json({ error: 'Upload Drive belum diaktifkan.' });

      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timed = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timed);
      if (!['RUNNING', 'WRAPUP'].includes(live.status)) {
        return res.status(409).json({ error: 'Sesi belum berjalan atau sudah ditutup.' });
      }
      if (String(session.pattern?.code || '').toUpperCase() !== 'CREATIVE_LAB') {
        return res.status(400).json({ error: 'Fitur ini hanya untuk Creative Lab.' });
      }
      const config = normalizeConfig(live.config, session.pattern?.code);
      if (String(config.activity?.phase || '').toUpperCase() !== LAB_PHASE_WRITABLE) {
        return res.status(409).json({ error: 'Upload foto hanya dibuka saat Activity 2.' });
      }
      const mine = labActor(config, req, req.body?.teamIndex);
      if (!mine) return res.status(403).json({ error: labDenied(req) });
      if (!mine.isRep) return res.status(403).json({ error: 'Hanya perwakilan kelompok yang bisa mengunggah foto karya.' });

      const rows = await labRows(prisma, live.id, mine.index);
      const brief = creativeLabBrief(config);
      const quota = labPhotoQuota(rows, req.body?.kind, {
        mediaA: brief.a2.stationA.media,
        mediaB: brief.a2.stationB.media,
      });
      if (!quota.ok) return res.status(quota.status).json({ error: quota.error });
      const kind = quota.kind;

      const filename = String(req.body?.filename || '');
      const mimetype = String(req.body?.mimetype || '');
      const rawData = String(req.body?.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      if (!filename || !rawData) return res.status(400).json({ error: 'filename dan data wajib.' });
      if (rawData.length > 20_000_000) {
        return res.status(400).json({ error: 'File terlalu besar (maks ~15MB sebelum dikompres).' });
      }
      const nameLower = filename.toLowerCase();
      if (!mimetype.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/.test(nameLower)) {
        return res.status(400).json({ error: 'Hanya file gambar (JPG, PNG, WebP, HEIC).' });
      }

      let jpeg;
      try {
        const { decodeImageUpload, toJpegBuffer } = await import('../lib/drive-jpeg.mjs');
        const decoded = decodeImageUpload({ mimetype, data: rawData, filename }, { maxBytes: 20_000_000 });
        jpeg = await toJpegBuffer(decoded.buffer, { maxWidth: 1600 });
      } catch (e) {
        const msg = String(e?.message || '');
        if (/Format foto|Ukuran foto|Data foto/i.test(msg)) return res.status(400).json({ error: msg });
        console.error('[creative-lab] kompres gagal:', e);
        return res.status(422).json({ error: 'Foto tidak terbaca (termasuk HEIC lama). Simpan ulang sebagai JPG lalu coba lagi.' });
      }

      const folderId = await ensureLabFolder(prisma, live, { kind, groupName: mine.team?.name });
      if (!folderId) return res.status(400).json({ error: 'Folder event Didaskalia belum siap. Pastikan event punya folder [EV:…:DIDASKALIA].' });
      const safeBase = String(filename).replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'karya';
      const label = kind === 'GROUP' ? 'foto-bersama' : kind.toLowerCase();
      const file = await driveUploadFile(folderId, {
        originalname: `${label}-${safeBase}.jpg`,
        mimetype: 'image/jpeg',
        buffer: jpeg,
      });
      const row = await prisma.worshipLabUpdate.create({
        data: {
          id: uid('wlu'),
          sessionId: live.id,
          teamIndex: mine.index,
          teamName: String(mine.team.name || '').slice(0, 80),
          userId: req.authUser.id,
          kind,
          body: str(req.body?.caption, 300),
          photoFileId: String(file.id || '').slice(0, 128),
          photoUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`,
          thumbUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w500`,
        },
      });
      res.status(201).json({ ok: true, update: labRowPublic(row, req.authUser.name || '') });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/lab/photos',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      if (!labDriveWriteEnabled()) return res.status(403).json({ error: 'Upload Drive belum diaktifkan.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      if (String(session.pattern?.code || '').toUpperCase() !== 'CREATIVE_LAB') {
        return res.status(400).json({ error: 'Fitur ini hanya untuk Creative Lab.' });
      }
      const timed = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timed);
      const config = normalizeConfig(live.config, session.pattern?.code);
      const gate = adminLabPhotoAllowed({
        roles: req.authUser?.roles,
        status: live.status,
        phase: config.activity?.phase,
      });
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
      const teams = Array.isArray(config.teams?.teams) ? config.teams.teams : [];
      const teamIndex = Math.floor(Number(req.body?.teamIndex));
      const team = teams[teamIndex];
      if (!Number.isInteger(teamIndex) || teamIndex < 0 || !team?.name) {
        return res.status(400).json({ error: 'Pilih kelompok yang sudah ada di papan.' });
      }
      const rows = await labRows(prisma, live.id, teamIndex);
      const brief = creativeLabBrief(config);
      const quota = labPhotoQuota(rows, req.body?.kind, {
        mediaA: brief.a2.stationA.media,
        mediaB: brief.a2.stationB.media,
      });
      if (!quota.ok) return res.status(quota.status).json({ error: quota.error });
      const kind = quota.kind;
      const filename = String(req.body?.filename || '');
      const mimetype = String(req.body?.mimetype || '');
      const rawData = String(req.body?.data || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      if (!filename || !rawData) return res.status(400).json({ error: 'filename dan data wajib.' });
      if (rawData.length > 20_000_000) {
        return res.status(400).json({ error: 'File terlalu besar (maks ~15MB sebelum dikompres).' });
      }
      const nameLower = filename.toLowerCase();
      if (!mimetype.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/.test(nameLower)) {
        return res.status(400).json({ error: 'Hanya file gambar (JPG, PNG, WebP, HEIC).' });
      }
      let jpeg;
      try {
        const { decodeImageUpload, toJpegBuffer } = await import('../lib/drive-jpeg.mjs');
        const decoded = decodeImageUpload({ mimetype, data: rawData, filename }, { maxBytes: 20_000_000 });
        jpeg = await toJpegBuffer(decoded.buffer, { maxWidth: 1600 });
      } catch (e) {
        const msg = String(e?.message || '');
        if (/Format foto|Ukuran foto|Data foto/i.test(msg)) return res.status(400).json({ error: msg });
        console.error('[creative-lab] kompres admin gagal:', e);
        return res.status(422).json({ error: 'Foto tidak terbaca (termasuk HEIC lama). Simpan ulang sebagai JPG lalu coba lagi.' });
      }
      const folderId = await ensureLabFolder(prisma, live, { kind, groupName: team.name });
      if (!folderId) return res.status(400).json({ error: 'Folder event Didaskalia belum siap. Pastikan event punya folder [EV:…:DIDASKALIA].' });
      const safeBase = String(filename).replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'karya';
      const label = kind === 'GROUP' ? 'foto-bersama' : kind.toLowerCase();
      const file = await driveUploadFile(folderId, {
        originalname: `${label}-${safeBase}.jpg`,
        mimetype: 'image/jpeg',
        buffer: jpeg,
      });
      const row = await prisma.worshipLabUpdate.create({
        data: {
          id: uid('wlu'),
          sessionId: live.id,
          teamIndex,
          teamName: String(team.name || '').slice(0, 80),
          userId: req.authUser.id,
          kind,
          body: str(req.body?.caption, 300),
          photoFileId: String(file.id || '').slice(0, 128),
          photoUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`,
          thumbUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w500`,
        },
      });
      res.status(201).json({ ok: true, update: labRowPublic(row, req.authUser.name || '') });
    }),
  );

  app.delete(
    '/api/worship/sessions/:id/lab/updates/:updateId',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const timed = await ensureAutoState(prisma, session);
      const live = await ensureAutoClosed(prisma, timed);
      const config = normalizeConfig(live.config, session.pattern?.code);
      const gate = adminLabPhotoAllowed({
        roles: req.authUser?.roles,
        status: live.status,
        phase: config.activity?.phase,
      });
      if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
      const row = await prisma.worshipLabUpdate.findUnique({ where: { id: String(req.params.updateId || '') } }).catch(() => null);
      if (!row || row.sessionId !== live.id) return res.status(404).json({ error: 'Update tidak ditemukan.' });
      await prisma.worshipLabUpdate.delete({ where: { id: row.id } });
      if (row.photoFileId) void driveDeleteFile(row.photoFileId).catch(() => {});
      res.json({ ok: true, deletedBy: req.authUser.id });
    }),
  );

  app.get(
    '/api/worship/session/:slug/lab/photo/:updateId',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const row = await prisma.worshipLabUpdate.findUnique({ where: { id: String(req.params.updateId || '') } }).catch(() => null);
      if (!row || row.sessionId !== session.id || !row.photoFileId) return res.status(404).json({ error: 'Foto tidak ditemukan.' });
      const config = normalizeConfig(session.config, session.pattern?.code);
      const mine = findLabTeam(config, req.authUser.id);
      const writerRole = (req.authUser?.roles || []).some((r) => WRITE_ROLES.includes(r.role));
      if (!(mine && row.teamIndex === mine.index) && !writerRole) {
        return res.status(403).json({ error: 'Tidak boleh membuka foto kelompok lain.' });
      }
      try {
        const { meta, stream } = await driveGetFileStream(row.photoFileId);
        res.setHeader('Content-Type', meta?.mimeType || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream.pipe(res);
      } catch {
        return res.status(502).json({ error: 'Gagal mengambil foto dari Drive.' });
      }
    }),
  );

  app.delete(
    '/api/worship/session/:slug/lab/updates/:updateId',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const config = normalizeConfig(session.config, session.pattern?.code);
      const mine = findLabTeam(config, req.authUser.id);
      const row = await prisma.worshipLabUpdate.findUnique({ where: { id: String(req.params.updateId || '') } }).catch(() => null);
      if (!row || row.sessionId !== session.id) return res.status(404).json({ error: 'Update tidak ditemukan.' });
      const writerRole = (req.authUser?.roles || []).some((r) => WRITE_ROLES.includes(r.role));
      if (!(mine && mine.isRep && row.teamIndex === mine.index) && !writerRole) {
        return res.status(403).json({ error: 'Tidak boleh menghapus update kelompok lain.' });
      }
      await prisma.worshipLabUpdate.delete({ where: { id: row.id } });
      if (row.photoFileId) void driveDeleteFile(row.photoFileId).catch(() => {});
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/worship/session/:slug/lab/done',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!canParticipate(req)) return res.status(403).json({ error: 'Sesi mentoring hanya untuk portal Pemuda.' });
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug || '') },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const config = normalizeConfig(session.config, session.pattern?.code);
      const mine = labActor(config, req, req.body?.teamIndex);
      if (!mine) return res.status(403).json({ error: labDenied(req) });
      if (!mine.isRep) return res.status(403).json({ error: 'Hanya perwakilan kelompok yang bisa menandai laporan selesai.' });
      const rows = await labRows(prisma, session.id, mine.index);
      if (!rows.some((r) => r.kind === 'GROUP' && r.photoUrl)) {
        return res.status(400).json({ error: 'Foto bersama seluruh anggota + hasil karya wajib diunggah sebelum lapor selesai.' });
      }
      const teams = Array.isArray(config.teams?.teams) ? [...config.teams.teams] : [];
      if (!teams[mine.index]) return res.status(400).json({ error: 'Kelompok tidak ditemukan di papan.' });
      teams[mine.index] = { ...teams[mine.index], done: true };
      const nextConfig = { ...config, teams: { teams } };
      await prisma.worshipSession.update({ where: { id: session.id }, data: { config: nextConfig } });
      res.json({ ok: true, done: true });
    }),
  );

  app.put(
    '/api/worship/sessions/:id/lab/ack',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const updateId = String(req.body?.updateId || '');
      const row = await prisma.worshipLabUpdate.findUnique({ where: { id: updateId } }).catch(() => null);
      if (!row || row.sessionId !== found.id) return res.status(404).json({ error: 'Update tidak ditemukan.' });
      const acknowledged = req.body?.acknowledged !== false;
      const saved = await prisma.worshipLabUpdate.update({
        where: { id: row.id },
        data: {
          acknowledgedAt: acknowledged ? new Date() : null,
          acknowledgedById: acknowledged ? req.authUser.id : null,
        },
      });
      res.json({ ok: true, update: labRowPublic(saved) });
    }),
  );

  app.get(
    '/api/worship/live/:slug',
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const session = await prisma.worshipSession.findUnique({
        where: { slug: String(req.params.slug) },
        include: { pattern: PATTERN_LEAN },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

      const code = str(req.query?.code, 12);
      const codeOk = Boolean(code) && String(session.accessCode || '').toUpperCase() === code.toUpperCase();
      if (!req.authUser && !codeOk) {
        return res.status(401).json({ error: 'Butuh login atau kode sesi proyektor.' });
      }
      const liveStateTimed = await ensureAutoState(prisma, session);
      const liveState = await ensureAutoClosed(prisma, liveStateTimed);
      if (!liveState.pattern && session.pattern) liveState.pattern = session.pattern;
      const etag = await tryWorshipEtag(prisma, liveState, null);
      if (etag && finishIfMatch(req, res, etag)) return;

      const agg = await loadAggregates(prisma, liveState);
      const expected = agg.config.expectedCount || (await youthUserCount(prisma));
      const pcode = String(liveState.pattern?.code || session.pattern?.code || '').toUpperCase();
      const liveLabRows = pcode === 'CREATIVE_LAB' ? await labRows(prisma, liveState.id) : [];
      const liveLab = pcode === 'CREATIVE_LAB'
        ? { ...labSummary(liveLabRows, agg.config.teams?.teams || [], agg.config.activity), updates: await labRowsWithNames(prisma, liveLabRows.slice(0, 80)) }
        : null;
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
        phase: agg.config.phase || null,
        phasePrefs: agg.config.phasePrefs || null,
        activity: pcode === 'CREATIVE_LAB' ? agg.config.activity || null : null,
        activityBrief: pcode === 'CREATIVE_LAB' ? creativeLabBrief(agg.config) : null,
        jarCards: pcode === 'CREATIVE_LAB' ? jarCards(agg.config) : [],
        lab: liveLab,
        testimony: Array.isArray(agg.config.testimony?.picks) ? agg.config.testimony.picks : [],
        oneWord: await oneWordAggregate(prisma, liveState.id),
        rounds: agg.config.rounds,
        screening: agg.config.screening,
        teams: agg.config.teams,
        // Agregat ronde film untuk delta pre→post di layar.
        likertMeans: await filmRoundMeans(prisma, liveState.id),
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
      res.json({ patterns: patterns.map((p) => presentWorshipPattern(p)) });
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
      if (String(pattern.code || '').toUpperCase() === 'CREATIVE_LAB') {
        const incoming = b.phases !== undefined ? data.phases : pattern.phases;
        if (legacyCreativeLabHits(incoming) >= 1) {
          data.phases = canonicalCreativeLabPhases();
          if (b.summary === undefined) data.summary = presentWorshipPattern({ ...pattern, phases: incoming }).summary;
        }
      }
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
      // Mode lihat-saja: baca = semua login; tulis = WRITE_ROLES + divisi Didaskalia
      // (guard endpoint tetap requireDivision + requireRole — ini hanya untuk UI).
      const isWriterRole = (req.authUser?.roles || []).some((r) => WRITE_ROLES.includes(r.role));
      const canWrite = isWriterRole && (await canAccessDivision(req.authUser, 'DIDASKALIA'));
      const controlPcode = String(liveSession.pattern?.code || '').toUpperCase();
      const controlLabRows = controlPcode === 'CREATIVE_LAB' ? await labRows(prisma, liveSession.id) : [];
      const controlNamed = controlPcode === 'CREATIVE_LAB' ? await labRowsWithNames(prisma, controlLabRows) : [];
      const controlLab = controlPcode === 'CREATIVE_LAB'
        ? {
            ...stampLabUploaders(labSummary(controlLabRows, agg.config.teams?.teams || [], agg.config.activity), controlNamed),
            updates: controlNamed,
          }
        : null;
      res.json({
        permissions: { canWrite },
        session: {
          id: liveSession.id,
          slug: liveSession.slug,
          title: liveSession.title,
          status: liveSession.status,
          sessionDate: liveSession.sessionDate,
          accessCode: liveSession.accessCode,
          eventId: liveSession.eventId || null,
          config: agg.config,
          pattern: presentWorshipPattern(liveSession.pattern),
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
        lab: controlLab,
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
          tenantId: tenantForWrite(req),
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
        // MONOLOG: Q1-Q3 langsung terbuka + fase F1 20' jalan. Timer utama
        // dibungkam (horizon 3 jam) agar auto-wrapup tak menendang di tengah
        // 60 menit — semua countdown terlihat berasal dari config.phase.
        // BEDAH_FILM: horizon 3 jam juga (film 90' + pasca; countdown dari screening).
        try {
          const withPattern = await prisma.worshipSession.findUnique({
            where: { id: session.id },
            include: { pattern: { select: { code: true } } },
          });
          const cfg = normalizeConfig(session.config, withPattern?.pattern?.code);
          const curQ = Number(cfg.fgd?.currentQ) || 0;
          if (String(withPattern?.pattern?.code || '').toUpperCase() === 'MONOLOG') {
            data.config = {
              ...cfg,
              timerSeconds: 10800,
              fgd: curQ === 0 ? { currentQ: 3, triggerBy: null, triggerName: null } : cfg.fgd,
              phase: { name: 'F1', startedAt: now.toISOString(), durationSec: MONOLOG_PHASE_SECONDS.F1 },
            };
          } else if (String(withPattern?.pattern?.code || '').toUpperCase() === 'BEDAH_FILM') {
            data.config = { ...cfg, timerSeconds: 10800 };
          }
        } catch {
          /* abaikan — status tetap jalan */
        }
      } else if (action === 'wrapup') {
        data.status = 'WRAPUP';
        data.wrapUpAt = now;
        // MONOLOG: fase F3 10' (Kesaksian) langsung jalan saat wrapup.
        try {
          const withPattern = await prisma.worshipSession.findUnique({
            where: { id: session.id },
            include: { pattern: { select: { code: true } } },
          });
          if (String(withPattern?.pattern?.code || '').toUpperCase() === 'MONOLOG') {
            const cfg = normalizeConfig(session.config, 'MONOLOG');
            data.config = {
              ...cfg,
              phase: { name: 'F3', startedAt: now.toISOString(), durationSec: MONOLOG_PHASE_SECONDS.F3 },
            };
          }
        } catch {
          /* abaikan — status tetap jalan */
        }
      } else if (action === 'close') {
        data.status = 'CLOSED';
        data.closedAt = now;
      } else if (action === 'reset') {
        data.status = 'DRAFT';
        data.likertOpenedAt = null;
        data.startedAt = null;
        data.wrapUpAt = null;
        data.closedAt = null;
        // Reset keras: hapus SEMUA isi audiens (jawaban/vote/catatan/undi)
        // + panggung live (screening/phase/gate) agar tak ada sisa nyangkut
        // (kasus: gate AKHIR OPEN tertinggal saat status DRAFT). Soal/chip
        // master + config.draft dipertahankan — tak perlu Terapkan ulang.
        try {
          const cfg = normalizeConfig(session.config);
          cfg.testimony = null;
          cfg.screening = null;
          cfg.phase = null;
          cfg.fgd = null;
          cfg.likertRounds = null;
          cfg.activity = null;
          if (cfg.teams && Array.isArray(cfg.teams.teams)) {
            cfg.teams = {
              ...cfg.teams,
              teams: cfg.teams.teams.map((t) => ({ ...t, done: false })),
            };
          }
          data.config = cfg;
        } catch {
          /* abaikan — status tetap di-reset */
        }
        try {
          await prisma.$transaction([
            prisma.worshipLikertResponse.deleteMany({ where: { sessionId: session.id } }),
            prisma.worshipChipVote.deleteMany({ where: { sessionId: session.id } }),
            prisma.worshipNote.deleteMany({ where: { sessionId: session.id } }),
            prisma.worshipLabUpdate.deleteMany({ where: { sessionId: session.id } }),
          ]);
        } catch {
          /* abaikan — status tetap di-reset */
        }
      } else if (action === 'extend') {
        // Tambah waktu fleksibel (detik): preset +5/+60/+300 + custom, 5–1800.
        const seconds = Math.min(1800, Math.max(5, intOrNull(req.body?.seconds) || 300));
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
      // MONOLOG & BEDAH_FILM: buat chip Lesson Learned dari section `lesson` draft (maks 10).
      let lessonChips = [];
      if (sessionPattern === 'MONOLOG' || sessionPattern === 'BEDAH_FILM' || sessionPattern === 'CREATIVE_LAB') {
        const lesson = b.storedDraft?.lesson && typeof b.storedDraft.lesson === 'object' ? b.storedDraft.lesson : {};
        lessonChips = Array.from({ length: 10 }, (_, i) => String(lesson[`lesson-chip-${i + 1}`] || '').trim())
          .filter(Boolean)
          .slice(0, 10)
          .map((label) => {
            const clean = label.startsWith('#') ? label : `#${label}`;
            return {
              code: clean.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 40),
              label: clean.slice(0, 80),
            };
          })
          .filter((x) => x.code && x.label.replace('#', '').trim());
      }
      // BEDAH_FILM: buat 10 item Likert dari section `likert-film` draft
      // (5 pernyataan × 2 ronde PRE/POST, teks sama — tanpa migrasi skema).
      let filmLikert = [];
      if (sessionPattern === 'BEDAH_FILM') {
        const lf = b.storedDraft?.['likert-film'] && typeof b.storedDraft['likert-film'] === 'object' ? b.storedDraft['likert-film'] : {};
        filmLikert = Array.from({ length: 5 }, (_, i) => String(lf[`likert-film-${i + 1}`] || '').trim())
          .map((text, i) => ({ n: i + 1, text }))
          .filter((x) => x.text);
      }
      // BEDAH_FILM: sinkronkan modul Pemutaran film dari judul draf (otomatis).
      // Guard: bila pemutaran sudah mulai live (startedAt ada) → jangan sentuh.
      let screeningPatch = null;
      if (sessionPattern === 'BEDAH_FILM') {
        const filmSec = b.storedDraft?.film && typeof b.storedDraft.film === 'object' ? b.storedDraft.film : {};
        const filmTitle = String(filmSec['film-title'] || '').trim().slice(0, 200);
        const liveScreening = session.config?.screening && typeof session.config.screening === 'object' ? session.config.screening : null;
        if (filmTitle && !liveScreening?.startedAt) {
          screeningPatch = { title: filmTitle, durationMin: parseFilmDurationMin(filmTitle), startedAt: null };
          cfg.screening = screeningPatch;
        }
      }
      // DEBAT: materialisasi ronde dari Draft Sesi (mosi → ronde, tim PRO/KONTRA,
      // lembar juri awal, Trap Reveal). Tanpa migrasi skema — semua di config.rounds.
      let debatRounds = null;
      if (sessionPattern === 'DEBAT') {
        const d = b.storedDraft && typeof b.storedDraft === 'object' ? b.storedDraft : {};
        const mosiSec = d.mosi && typeof d.mosi === 'object' ? d.mosi : {};
        const mosiList = Array.from({ length: 5 }, (_, i) => str(mosiSec[`mosi-${i + 1}`], 500)).filter(Boolean);
        const teamsSec = d.teams && typeof d.teams === 'object' ? d.teams : {};
        const jurySec = d.juri && typeof d.juri === 'object' ? d.juri : {};
        const trapSec = d.trap && typeof d.trap === 'object' ? d.trap : {};
        const splitNames = (v) => String(v || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
        const juryNames = Array.from({ length: 3 }, (_, i) => str(jurySec[`juri-${i + 1}`], 80)).filter(Boolean);
        const list = (mosiList.length ? mosiList : ['']).map((mosi) => ({
          mosi,
          pro: '',
          kontra: '',
          proScore: 0,
          kontraScore: 0,
          jury: juryNames.map((name) => ({ name, pro: {}, kontra: {} })),
        }));
        debatRounds = cleanRounds({
          rounds: list,
          current: 0,
          phase: 'brief',
          step: 0,
          stepStartedAt: null,
          stepShowOnScreen: true,
          teams: {
            pro: { name: str(teamsSec['pro-name'], 80), mentor: str(teamsSec['pro-mentor'], 80), members: splitNames(teamsSec['pro-members']) },
            kontra: { name: str(teamsSec['kontra-name'], 80), mentor: str(teamsSec['kontra-mentor'], 80), members: splitNames(teamsSec['kontra-members']) },
          },
          trapReveal: str(trapSec['trap-reveal'], 2000),
        });
        cfg.rounds = debatRounds;
      }
      // CREATIVE_LAB: durasi dari draft. Kelompok diisi dari 10 rumah aktif,
      // bukan dari teks bebas group-n-*.
      let creativeLab = null;
      if (sessionPattern === 'CREATIVE_LAB') {
        creativeLab = creativeLabFromDraft(b.storedDraft);
        try {
          const src = await loadCreativeLabGroupSource(prisma, session.eventId);
          const built = buildCreativeLabTeams(src.groups, { checkedInIds: src.checkedInIds });
          const cleanedTeams = cleanTeams({ teams: built.teams }, { maxTeams: LAB_MAX_TEAMS });
          if (cleanedTeams) cfg.teams = cleanedTeams;
        } catch (e) {
          console.error('[creative-lab] gagal memuat kelompok:', e);
        }
        if (creativeLab?.activity) cfg.activity = cleanActivity(creativeLab.activity);
      }
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
      if (lessonChips.length) {
        let corder = 0;
        for (const c of lessonChips) {
          corder += 1;
          await prisma.worshipChip.create({
            data: { id: uid('wc'), sessionId: session.id, code: c.code, label: c.label, topicCode: null, sortOrder: corder, isActive: true },
          });
        }
      }
      if (filmLikert.length) {
        let order = 0;
        for (const round of ['PRE', 'POST']) {
          for (const it of filmLikert) {
            order += 1;
            await prisma.worshipLikertItem.create({
              data: {
                id: uid('wli'),
                sessionId: session.id,
                topicCode: `FILM_${round}`,
                text: it.text,
                gospelNote: null,
                sortOrder: order,
              },
            });
          }
        }
      }
      res.json({ ok: true, saved: true, cleaned: legacyIds.length, chips: lessonChips.length, likert: filmLikert.length * 2, screening: screeningPatch, rounds: debatRounds ? debatRounds.rounds.length : 0, teams: creativeLab?.teams?.teams?.length || 0, activity: creativeLab?.activity || null });
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
    const [users, memberships] = await Promise.all([
      prisma.user
        .findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, roles: { select: { role: true } } },
        })
        .catch(() => []),
      prisma.groupMember
        .findMany({
          where: { userId: { in: userIds }, status: 'ACTIVE' },
          select: { userId: true, groupId: true },
        })
        .catch(() => []),
    ]);
    let groupNameById = new Map();
    const groupIds = [...new Set(memberships.map((m) => m.groupId).filter(Boolean))];
    if (groupIds.length) {
      const groups = await prisma.group
        .findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } })
        .catch(() => []);
      groupNameById = new Map(groups.map((g) => [g.id, g.name]));
    }
    const groupByUser = new Map();
    for (const m of memberships) {
      if (m.userId && !groupByUser.has(m.userId) && groupNameById.get(m.groupId)) {
        groupByUser.set(m.userId, groupNameById.get(m.groupId));
      }
    }
    return users.map((u) => ({
      userId: u.id,
      name: u.name || 'Peserta',
      roles: (u.roles || []).map((r) => r.role),
      groupName: groupByUser.get(u.id) || null,
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
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      if (!['LIKERT_OPEN', 'RUNNING', 'WRAPUP'].includes(String(session.status || '').toUpperCase())) {
        return res.status(409).json({ error: 'Undian hanya bisa saat sesi berlangsung.' });
      }
      const pool = await testimonyPool(prisma, session);
      if (!pool.length) {
        return res.status(400).json({ error: 'Belum ada yang hadir (check-in/Likert masih kosong).' });
      }
      const picks = readPicks(session);
      // MONOLOG: 3 acak bebas; BEDAH_FILM: 1 Mentee + 1 Mentor; pola lain komposisi baku 2+1+1.
      const patternCode = String(session.pattern?.code || '').toUpperCase();
      const need = patternCode === 'MONOLOG' ? TESTIMONY_NEED_MONOLOG : patternCode === 'BEDAH_FILM' ? TESTIMONY_NEED_FILM : undefined;
      // BEDAH_FILM dibatasi tepat 2 live: undi saat penuh ditolak (tawarkan
      // ganti), kecuali flag replace (2 baru mengganti 2 lama).
      const isFilm = patternCode === 'BEDAH_FILM';
      const wantReplace = req.body?.replace === true;
      if (isFilm && !wantReplace && picks.length >= TESTIMONY_FILM_CAP) {
        return res.status(409).json({
          error: 'Sudah 2 orang live — ganti atau reset untuk mengundi ulang.',
          full: true,
          picks,
        });
      }
      const fresh = composePicks(pool, wantReplace && isFilm ? [] : picks.map((p) => p.userId), need);
      if (!fresh.length) return res.status(409).json({ error: 'Semua yang hadir sudah terpilih.' });
      const at = new Date().toISOString();
      const stamped = fresh.map((p) => ({ ...p, at }));
      // Sabuk pengaman: total film tak pernah melebihi 2 (fresh diutamakan).
      const merged = wantReplace && isFilm
        ? stamped.map((p, i) => ({ ...p, slot: i + 1 }))
        : isFilm
          ? applyFilmCap(picks, stamped).picks
          : [...picks, ...stamped];
      await writePicks(prisma, session, merged);
      res.json({ ok: true, fresh, picks: merged, replaced: wantReplace && isFilm });
    }),
  );

  app.post(
    '/api/worship/sessions/:id/testimony/manual',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      if (!['LIKERT_OPEN', 'RUNNING', 'WRAPUP'].includes(String(session.status || '').toUpperCase())) {
        return res.status(409).json({ error: 'Pilihan manual hanya bisa saat sesi berlangsung.' });
      }
      const userIds = [...new Set((Array.isArray(req.body?.userIds) ? req.body.userIds : []).map(String).filter(Boolean))].slice(0, 12);
      if (!userIds.length) return res.status(400).json({ error: 'Pilih minimal satu orang.' });
      const [users, memberships] = await Promise.all([
        prisma.user
          .findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, roles: { select: { role: true } } } })
          .catch(() => []),
        prisma.groupMember
          .findMany({ where: { userId: { in: userIds }, status: 'ACTIVE' }, select: { userId: true, groupId: true } })
          .catch(() => []),
      ]);
      let groupNameById = new Map();
      const groupIds = [...new Set(memberships.map((m) => m.groupId).filter(Boolean))];
      if (groupIds.length) {
        const groups = await prisma.group
          .findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } })
          .catch(() => []);
        groupNameById = new Map(groups.map((g) => [g.id, g.name]));
      }
      const groupByUser = new Map();
      for (const m of memberships) {
        if (m.userId && !groupByUser.has(m.userId) && groupNameById.get(m.groupId)) {
          groupByUser.set(m.userId, groupNameById.get(m.groupId));
        }
      }
      const picks = readPicks(session);
      // BEDAH_FILM dibatasi tepat 2 live: tambah manual saat penuh ditolak.
      if (String(session.pattern?.code || '').toUpperCase() === 'BEDAH_FILM' && picks.length >= TESTIMONY_FILM_CAP) {
        return res.status(409).json({
          error: 'Sudah 2 orang live — reset dulu untuk menambah manual.',
          full: true,
          picks,
        });
      }
      const at = new Date().toISOString();
      const fresh = mergeManualPicks(
        picks,
        users.map((u) => ({
          userId: u.id,
          name: u.name || 'Peserta',
          roles: (u.roles || []).map((r) => r.role),
          groupName: groupByUser.get(u.id) || null,
        })),
      );
      if (!fresh.length) return res.status(409).json({ error: 'Semua yang dipilih sudah terdaftar.' });
      const stampedManual = fresh.map((p) => ({ ...p, at }));
      const mergedManual = String(session.pattern?.code || '').toUpperCase() === 'BEDAH_FILM'
        ? applyFilmCap(picks, stampedManual).picks
        : [...picks, ...stampedManual];
      await writePicks(prisma, session, mergedManual);
      res.json({ ok: true, fresh, picks: mergedManual });
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
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      const b = req.body || {};
      const cfg = normalizeConfig(session.config, session.pattern?.code);
      const patternCode = String(session.pattern?.code || '').toUpperCase();
      const teamCap = patternCode === 'CREATIVE_LAB'
        ? LAB_MAX_TEAMS
        : patternCode === 'THREE_SEQUENCES'
          ? SEQUENCE_MAX_TEAMS
          : DEFAULT_MAX_TEAMS;
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
        const cleaned = cleanTeams(b.teams, { maxTeams: teamCap });
        if (!cleaned) return res.status(400).json({ error: 'Minimal satu tim bernama.' });
        cfg.teams = cleaned;
        out.teams = cleaned;
        if (b.resetPresentOrder && cfg.activity) {
          const reset = cleanActivity({
            ...cfg.activity,
            presentOrder: [],
            presentDrawnAt: null,
            presentIndex: 0,
            presentSlide: 0,
          });
          if (reset) {
            cfg.activity = reset;
            out.activity = reset;
          }
        }
      }
      if (b.activity !== undefined && b.teams === undefined) {
        if (b.activity === null) {
          cfg.activity = null;
          out.activity = null;
        } else {
          const cleaned = cleanActivity(b.activity);
          if (!cleaned) return res.status(400).json({ error: 'State aktivitas tidak valid.' });
          cfg.activity = cleaned;
          out.activity = cleaned;
        }
      }
      if (b.fgd !== undefined) {
        const cleaned = cleanFgd(b.fgd);
        if (!cleaned) return res.status(400).json({ error: 'State trigger Q tidak valid.' });
        cfg.fgd = cleaned;
        out.fgd = cleaned;
      }
      if (b.likertRounds !== undefined) {
        const cleaned = cleanLikertRounds(b.likertRounds);
        if (!cleaned) return res.status(400).json({ error: 'State gate Likert tidak valid.' });
        // Guard urutan: AKHIR hanya boleh dibuka saat sesi berjalan/wrapup —
        // cegah gate nyangkut (kasus: AKHIR OPEN saat status DRAFT).
        const st = String(session.status || '').toUpperCase();
        if (cleaned.post === 'open' && (st === 'DRAFT' || st === 'LIKERT_OPEN')) {
          return res.status(409).json({ error: 'Likert AKHIR hanya bisa dibuka setelah film mulai (status RUNNING).' });
        }
        cfg.likertRounds = cleaned;
        out.likertRounds = cleaned;
      }
      if (b.discussion !== undefined) {
        return res.status(400).json({ error: 'Timer diskusi terpisah tidak dipakai lagi — pakai phase F1/F2/F3/CLOSING.' });
      }
      if (b.phase !== undefined) {
        if (b.phase === null) {
          cfg.phase = null;
          out.phase = null;
        } else {
          const cleaned = cleanPhase(b.phase);
          if (!cleaned) return res.status(400).json({ error: 'Fase tidak valid (F1/F2/F3/CLOSING + waktu mulai).' });
          cfg.phase = cleaned;
          out.phase = cleaned;
        }
      }
      if (b.phasePrefs !== undefined) {
        if (b.phasePrefs === null) {
          cfg.phasePrefs = null;
          out.phasePrefs = null;
        } else {
          const cleaned = cleanPhasePrefs(b.phasePrefs);
          if (!cleaned) return res.status(400).json({ error: 'Preferensi fase tidak valid.' });
          cfg.phasePrefs = cleaned;
          out.phasePrefs = cleaned;
        }
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
    '/api/worship/sessions/:id/lab.csv',
    requireDivision('DIDASKALIA'),
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const found = await findSession(prisma, req.params.id);
      if (!found) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const session = await prisma.worshipSession.findUnique({
        where: { id: found.id },
        include: { pattern: { select: { code: true } } },
      });
      if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
      const config = normalizeConfig(session.config, session.pattern?.code);
      const rows = await labRows(prisma, session.id);
      const teams = Array.isArray(config.teams?.teams) ? config.teams.teams : [];
      const summary = labSummary(rows, teams, config.activity);
      const brief = creativeLabBrief(config);
      const mediaA = brief.a2.stationA.media || 'Pot';
      const mediaB = brief.a2.stationB.media || 'Tas';
      const headers = [
        'Kelompok', 'Perwakilan', 'JumlahAnggota', 'Status',
        `MaknaStasiunA (${mediaA})`, 'ProgressStasiunA', 'FotoStasiunA1', 'FotoStasiunA2',
        `MaknaStasiunB (${mediaB})`, 'ProgressStasiunB', 'FotoStasiunB1', 'FotoStasiunB2',
        'Komitmen', 'FotoBersama', 'FotoLengkap', 'UpdateTerakhir',
      ];
      const lines = [headers.map(csvEscape).join(',')];
      for (const t of summary.teams) {
        lines.push([
          t.name, t.repName, String(t.memberCount), t.done ? 'SELESAI' : 'PROSES',
          t.pot.meaning, t.pot.progress == null ? '' : String(t.pot.progress),
          t.pot.photos[0]?.photoUrl || '', t.pot.photos[1]?.photoUrl || '',
          t.bag.meaning, t.bag.progress == null ? '' : String(t.bag.progress),
          t.bag.photos[0]?.photoUrl || '', t.bag.photos[1]?.photoUrl || '',
          t.commitment, t.groupPhoto?.photoUrl || '', t.photoComplete ? 'YA' : 'BELUM',
          t.lastUpdateAt || '',
        ].map(csvEscape).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="creative-lab-${session.slug}.csv"`);
      res.send(`\uFEFF${lines.join('\r\n')}`);
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
        include: { chips: { orderBy: { sortOrder: 'asc' } }, likertItems: true, pattern: { select: { code: true } } },
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

      const patternCode = String(session.pattern?.code || '').toUpperCase();
      // Mission Sequence: satu baris per tim gabungan (bukan per peserta).
      if (patternCode === 'THREE_SEQUENCES') {
        const teams = Array.isArray(agg.config.teams?.teams) ? agg.config.teams.teams : [];
        const src = await loadCreativeLabGroupSource(prisma, session.eventId).catch(() => ({ groups: [] }));
        const groupOf = new Map();
        for (const g of src.groups || []) {
          for (const m of g.members || []) {
            if (m?.id) groupOf.set(String(m.id), g.name || '');
          }
        }
        const buckets = teams.map(() => ({ laporan: [], komitmen: [] }));
        const missingIds = [...new Set(noteRows.map((n) => n.userId))].filter((id) => id && !userById.has(id));
        if (missingIds.length) {
          const extra = await prisma.user.findMany({
            where: { id: { in: missingIds } },
            select: { id: true, name: true, email: true, bipra: true },
          }).catch(() => []);
          for (const u of extra) userById.set(u.id, u);
        }
        const reporterIds = new Set([...agg.perUser.keys(), ...noteRows.map((n) => n.userId)]);
        for (const userId of reporterIds) {
          const u = userById.get(userId);
          const idx = matchJointTeam(teams, {
            userId,
            name: u?.name || '',
            groupName: groupOf.get(String(userId)) || '',
          });
          if (idx < 0 || !buckets[idx]) continue;
          const myNotes = notesByUser.get(userId) || {};
          const who = u?.name || userId;
          if (myNotes.LAPORAN) buckets[idx].laporan.push(`${who}: ${myNotes.LAPORAN}`);
          const komitmen = myNotes.KOMITMEN || myNotes.KESIMPULAN || '';
          if (komitmen) buckets[idx].komitmen.push(`${who}: ${komitmen}`);
        }
        const seqHeaders = ['Tim', 'Pasangan', 'PeranDiDalamTim', 'Tugas', 'Selesai', 'Laporan', 'Komitmen'];
        const seqLines = [seqHeaders.map(csvEscape).join(',')];
        teams.forEach((t, i) => {
          const pair = Array.isArray(t.pair) ? t.pair.filter(Boolean).join(' & ') : '';
          seqLines.push([
            t.name || `Tim ${i + 1}`,
            pair,
            t.roles || '',
            t.task || '',
            t.done ? 'SELESAI' : 'PROSES',
            buckets[i]?.laporan.join(' | ') || '',
            buckets[i]?.komitmen.join(' | ') || '',
          ].map(csvEscape).join(','));
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="worship-${session.slug}.csv"`);
        res.send(`\uFEFF${seqLines.join('\r\n')}`);
        return;
      }

      // BEDAH_FILM: kolom PRE/POST per pernyataan + delta (tanpa rank ruang).
      if (patternCode === 'BEDAH_FILM') {
        const items = [...(session.likertItems || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const preItems = items.filter((i) => String(i.topicCode || '').toUpperCase() === 'FILM_PRE');
        const postItems = items.filter((i) => String(i.topicCode || '').toUpperCase() === 'FILM_POST');
        const respRows = await prisma.worshipLikertResponse.findMany({ where: { sessionId: session.id } });
        const valByUserItem = new Map(respRows.map((r) => [`${r.userId}|${r.itemId}`, r.value]));
        const filmHeaders = ['Nama', 'Email', 'BIPRA', ...preItems.map((_, i) => `PRE_${i + 1}`), ...postItems.map((_, i) => `POST_${i + 1}`), 'DeltaRata', 'Catatan_Q1', 'Catatan_Q2', 'Catatan_Q3', 'Chip1', 'Chip2', 'Chip3', 'Komitmen'];
        const filmLines = [filmHeaders.map(csvEscape).join(',')];
        for (const [userId] of agg.perUser) {
          const u = userById.get(userId);
          const preVals = preItems.map((it) => Number(valByUserItem.get(`${userId}|${it.id}`) || 0));
          const postVals = postItems.map((it) => Number(valByUserItem.get(`${userId}|${it.id}`) || 0));
          const mean = (a) => (a.length ? a.reduce((n, v) => n + v, 0) / a.length : 0);
          const delta = (mean(postVals) - mean(preVals)).toFixed(1);
          const chips = (chipsByUser.get(userId) || []).slice(0, 3);
          const myNotes = notesByUser.get(userId) || {};
          filmLines.push([
            u?.name || userId, u?.email || '', u?.bipra || '',
            ...preVals.map((v) => String(v || '')), ...postVals.map((v) => String(v || '')), delta,
            myNotes['FILM-Q1'] || '', myNotes['FILM-Q2'] || '', myNotes['FILM-Q3'] || '',
            chips[0] || '', chips[1] || '', chips[2] || '', myNotes.KOMITMEN || myNotes.Kesimpulan || '',
          ].map(csvEscape).join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="worship-${session.slug}.csv"`);
        res.send(`\uFEFF${filmLines.join('\r\n')}`);
        return;
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

let youthCountCache = { at: 0, n: 0 };

async function youthUserCount(prisma) {
  if (youthCountCache.at && Date.now() - youthCountCache.at < 10 * 60 * 1000) return youthCountCache.n;
  try {
    const rows = await prisma.userRole.findMany({
      where: { tenantId: YOUTH_TENANT },
      select: { userId: true },
      take: 5000,
    });
    const n = new Set(rows.map((r) => r.userId)).size;
    youthCountCache = { at: Date.now(), n };
    return n;
  } catch {
    return youthCountCache.n || 0;
  }
}
