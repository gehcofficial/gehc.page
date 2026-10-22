/**
 * Status panggung sesi (modul rounds / screening / teams / fgd / song) — validasi murni.
 * Disimpan di config sesi — tanpa migrasi skema.
 * Ditulis endpoint stage (admin Didaskalia, boleh saat live).
 */

const str = (v, max = 500) => {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, max);
};

export const ROUND_PHASES = ['brief', 'pro', 'kontra', 'sanggah', 'blow', 'jeda', 'selesai'];

export const ROUND_PHASE_LABEL = {
  brief: 'Briefing mosi',
  pro: 'Pemaparan PRO',
  kontra: 'Pemaparan KONTRA',
  sanggah: 'Sanggahan',
  blow: 'Final Blow',
  jeda: 'Jeda & transisi',
  selesai: 'Ronde selesai',
};

/**
 * Langkah baku 1 ronde debat (11 langkah = 20 menit = 1200 dtk):
 * The Reveal 1' · Brainstorming & AI 4' · Paparan PRO 4' · KONTRA 4' ·
 * Sanggahan-1 PRO/KONTRA 1' · Sanggahan-2 PRO/KONTRA 1' · Final Blow PRO/KONTRA 1' · Jeda 1'.
 * Timer per langkah = display-only (transisi manual oleh moderator).
 */
export const ROUND_STEPS = [
  { key: 'reveal', label: 'The Reveal — mosi + PRO vs KONTRA', seconds: 60 },
  { key: 'brainstorm', label: 'Brainstorming & AI Strategy', seconds: 240 },
  { key: 'pro', label: 'Pemaparan PRO', seconds: 240 },
  { key: 'kontra', label: 'Pemaparan KONTRA', seconds: 240 },
  { key: 'sanggah1-pro', label: 'Sanggahan 1 PRO', seconds: 60 },
  { key: 'sanggah1-kontra', label: 'Sanggahan 1 KONTRA', seconds: 60 },
  { key: 'sanggah2-pro', label: 'Sanggahan 2 PRO (utamakan Mentee)', seconds: 60 },
  { key: 'sanggah2-kontra', label: 'Sanggahan 2 KONTRA (utamakan Mentee)', seconds: 60 },
  { key: 'blow-pro', label: 'Final Blow PRO', seconds: 60 },
  { key: 'blow-kontra', label: 'Final Blow KONTRA', seconds: 60 },
  { key: 'jeda', label: 'Jeda & transisi', seconds: 60 },
];

/** Durasi baku tiap langkah (detik), indeks = nomor langkah (0-10). */
export const ROUND_STEP_SECONDS = ROUND_STEPS.map((s) => s.seconds);

/** Empat kriteria penjurian + bobot (total 100 per juri per tim). */
export const JURY_CRITERIA = [
  { key: 'biblika', label: 'Argumen biblika', weight: 40 },
  { key: 'logika', label: 'Logika', weight: 30 },
  { key: 'teamwork', label: 'Teamwork', weight: 20 },
  { key: 'etika', label: 'Etika', weight: 10 },
];

export const JURY_WEIGHTS = { biblika: 40, logika: 30, teamwork: 20, etika: 10 };

/** Label langkah ke-n (0-10) — fallback langkah pertama. */
export function roundStepLabel(step) {
  const s = ROUND_STEPS[Number(step)] || ROUND_STEPS[0];
  return s.label;
}

/** Skor satu sisi (PRO/KONTRA) dari 4 kriteria berbobot (maks 100). */
export function jurySideScore(side) {
  const o = side && typeof side === 'object' ? side : {};
  return JURY_CRITERIA.reduce(
    (n, c) => n + Math.min(c.weight, Math.max(0, Number(o[c.key]) || 0)),
    0,
  );
}

function cleanJurySide(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const c of JURY_CRITERIA) out[c.key] = Math.min(c.weight, Math.max(0, Number(o[c.key]) || 0));
  return out;
}

function cleanJury(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 5).map((j) => ({
    name: str(j?.name, 80),
    pro: cleanJurySide(j?.pro),
    kontra: cleanJurySide(j?.kontra),
  }));
}

function cleanDebatTeam(raw) {
  return {
    name: str(raw?.name, 80),
    mentor: str(raw?.mentor, 80),
    members: (Array.isArray(raw?.members) ? raw.members : []).slice(0, 12).map((m) => str(m, 80)).filter(Boolean),
  };
}

/** Normalisasi state ronde debat (maks 5 ronde) + langkah, juri, tim, Trap Reveal. */
export function cleanRounds(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const list = (Array.isArray(raw.rounds) ? raw.rounds : []).slice(0, 5).map((r) => ({
    mosi: str(r?.mosi, 500),
    pro: str(r?.pro, 120),
    kontra: str(r?.kontra, 120),
    proScore: Math.max(0, Number(r?.proScore) || 0),
    kontraScore: Math.max(0, Number(r?.kontraScore) || 0),
    jury: cleanJury(r?.jury),
  }));
  const current = Math.min(Math.max(0, Number(raw.current) || 0), Math.max(0, list.length - 1));
  const phase = ROUND_PHASES.includes(String(raw.phase)) ? String(raw.phase) : 'brief';
  const step = Math.min(ROUND_STEPS.length - 1, Math.max(0, Number(raw.step) || 0));
  const stepStartedAt = raw.stepStartedAt ? String(raw.stepStartedAt).slice(0, 30) : null;
  const stepSeconds = Math.min(7200, Math.max(10, Number(raw.stepSeconds) || ROUND_STEP_SECONDS[step]));
  const stepShowOnScreen = raw.stepShowOnScreen === undefined || raw.stepShowOnScreen === null
    ? true
    : !(raw.stepShowOnScreen === false || raw.stepShowOnScreen === 0 || String(raw.stepShowOnScreen).toLowerCase() === 'false');
  const teamsRaw = raw.teams && typeof raw.teams === 'object' && !Array.isArray(raw.teams) ? raw.teams : {};
  const teams = { pro: cleanDebatTeam(teamsRaw.pro), kontra: cleanDebatTeam(teamsRaw.kontra) };
  const trapReveal = str(raw.trapReveal, 2000);
  return { rounds: list, current, phase, step, stepStartedAt, stepSeconds, stepShowOnScreen, teams, trapReveal };
}

/** Normalisasi status pemutaran film. */
export function cleanScreening(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = str(raw.title, 200);
  if (!title) return null;
  const durationMin = Math.min(180, Math.max(10, Number(raw.durationMin) || 90));
  const startedAt = raw.startedAt ? String(raw.startedAt).slice(0, 30) : null;
  // Pengumuman tambahan pre-roll layar (maks 6 baris, tiap baris 140 huruf).
  const preShow = (Array.isArray(raw.preShow) ? raw.preShow : [])
    .map((line) => str(line, 140).trim())
    .filter(Boolean)
    .slice(0, 6);
  return { title, durationMin, startedAt, preShow };
}

/**
 * Tebak durasi film (menit) dari judul draf — mis. "…(2017, 112 menit — …)" → 112.
 * Hanya angka 2–3 digit tepat sebelum kata "menit" (tahun 4-digit diabaikan).
 * Fallback 90 (slot F1 Pemutaran film).
 */
export function parseFilmDurationMin(title) {
  const m = String(title || '').match(/(\d{2,3})\s*menit/i);
  if (!m) return 90;
  return Math.min(180, Math.max(10, Number(m[1])));
}

/** Normalisasi gate Likert 2 ronde (BEDAH_FILM): AWAL (baseline) & AKHIR (ukur delta). */
export function cleanLikertRounds(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const gate = (v, fallback) => {
    const s = String(v ?? fallback).toLowerCase();
    return s === 'closed' ? 'closed' : 'open';
  };
  return { pre: gate(raw.pre, 'open'), post: gate(raw.post, 'closed') };
}

/** Normalisasi trigger pertanyaan mentor (MONOLOG gabungan): Q 0-5 + siapa pemicu. */
export function cleanFgd(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const currentQ = Math.min(5, Math.max(0, Number(raw.currentQ) || 0));
  const triggerBy = ['MENTOR', 'CO_MENTOR', 'PERWAKILAN'].includes(String(raw.triggerBy || '').toUpperCase())
    ? String(raw.triggerBy).toUpperCase()
    : null;
  const triggerName = str(raw.triggerName, 80) || null;
  return { currentQ, triggerBy, triggerName };
}

/** Nama fase MONOLOG yang sah (20'/25'/10'/5' = 60 menit). */
export const MONOLOG_PHASES = ['F1', 'F2', 'F3', 'CLOSING'];

/** Timer langkah BEDAH_FILM (tanpa timer sesi penuh): M0 Likert AWAL 5', M3 Likert AKHIR 5', M4 Undi & Kesaksian 10'. */
export const FILM_PHASES = ['M0', 'M3', 'M4'];

/** Durasi baku tiap fase MONOLOG (detik): F1 20' + F2 25' + F3 10' + Closing 5'. */
export const MONOLOG_PHASE_SECONDS = { F1: 1200, F2: 1500, F3: 600, CLOSING: 300 };

/** Durasi baku timer langkah film (detik): AWAL 5' + AKHIR 5' + Undi 10'. */
export const FILM_PHASE_SECONDS = { M0: 300, M3: 300, M4: 600 };

/** Normalisasi timer fase (MONOLOG F1/F2/F3/CLOSING + langkah film M0/M3/M4): satu fase aktif + countdown display-only. Transisi selalu manual. */
export function cleanPhase(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = String(raw.name || '').toUpperCase();
  if (![...MONOLOG_PHASES, ...FILM_PHASES].includes(name)) return null;
  const startedAt = raw.startedAt ? String(raw.startedAt).slice(0, 30) : null;
  if (!startedAt) return null;
  const durationSec = Math.min(7200, Math.max(60, Number(raw.durationSec) || MONOLOG_PHASE_SECONDS[name] || FILM_PHASE_SECONDS[name]));
  // Tampil di layar proyektor? Default true (perilaku lama); false = hitung
  // diam-diam (HP peserta tetap melihat sisa waktu).
  const showOnScreen = raw.showOnScreen === undefined || raw.showOnScreen === null
    ? true
    : !(raw.showOnScreen === false || raw.showOnScreen === 0 || String(raw.showOnScreen).toLowerCase() === 'false');
  return { name, startedAt, durationSec, showOnScreen };
}

/**
 * Preferensi tiap fase (diatur kontrol sebelum/saat live): durasi + tampil.
 * Kunci tak dikenal dibuang; tiap fase selalu lengkap (default baku).
 */
export function cleanPhasePrefs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const keys = Object.keys(raw).filter((k) => MONOLOG_PHASES.includes(String(k).toUpperCase()));
  if (!keys.length) return null;
  const out = {};
  for (const name of MONOLOG_PHASES) {
    const r = raw[name] || {};
    const durationSec = Math.min(7200, Math.max(60, Number(r.durationSec) || MONOLOG_PHASE_SECONDS[name]));
    const showOnScreen = r.showOnScreen === undefined || r.showOnScreen === null
      ? true
      : !(r.showOnScreen === false || r.showOnScreen === 0 || String(r.showOnScreen).toLowerCase() === 'false');
    out[name] = { durationSec, showOnScreen };
  }
  return out;
}

/** Preferensi baku (durasi baku + tampil semua). */
export function defaultPhasePrefs() {
  const out = {};
  for (const name of MONOLOG_PHASES) {
    out[name] = { durationSec: MONOLOG_PHASE_SECONDS[name], showOnScreen: true };
  }
  return out;
}

/** Normalisasi lagu bedah (MONOLOG gabungan). */
export function cleanSong(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = str(raw.title, 200);
  if (!title) return null;
  return { title, about: str(raw.about, 2000), singer: str(raw.singer, 120) };
}

/** Batas generik cleanTeams bila pemanggil tidak mengirim maxTeams. */
export const DEFAULT_MAX_TEAMS = 8;
/** Mission Sequence: 5 tim gabungan, masing-masing 2 kelompok mentoring. */
export const SEQUENCE_MAX_TEAMS = 5;
/** Peran lama Mission Room — sekarang teks peran di dalam tiap tim gabungan. */
export const MISSION_INTERNAL_ROLES = 'Soal · Lapangan · Narasi · Presentasi · Editor (peran di dalam tim, bukan tim terpisah)';

/** Sepuluh kelompok Beyonders yang dipakai Creative Lab, urut nama. */
export const CREATIVE_LAB_GROUP_NAMES = [
  'Agape', 'Avodah', 'Dunamis', 'Echad', 'Hesed', 'Kairos', 'Logos', 'Metanoia', 'Ruach', 'Shalom',
];

export const LAB_MAX_TEAMS = CREATIVE_LAB_GROUP_NAMES.length;
export const LAB_ROSTER_MAX = 8;
/** Indeks presentasi terakhir (0 … 9). */
export const LAB_PRESENT_INDEX_MAX = LAB_MAX_TEAMS - 1;

/**
 * Lima tim gabungan Mission Sequence. Default pasangan urut 1+2, 3+4, …
 * dari sepuluh kelompok Beyonders. `roles` hanya saran peran di dalam tim.
 */
export function buildJointMissionTeams(groupNames) {
  const names = (Array.isArray(groupNames) && groupNames.length ? groupNames : CREATIVE_LAB_GROUP_NAMES)
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  const teams = [];
  for (let i = 0; i < SEQUENCE_MAX_TEAMS; i += 1) {
    const a = names[i * 2] || `Kelompok ${i * 2 + 1}`;
    const b = names[i * 2 + 1] || `Kelompok ${i * 2 + 2}`;
    teams.push({
      name: `${a} & ${b}`,
      task: 'Menjalankan seluruh misi bersama.',
      members: [],
      done: false,
      scribe: '',
      station: '',
      pot: [],
      bag: [],
      repUserId: '',
      repName: '',
      memberUserIds: [],
      groupId: '',
      missing: false,
      pair: [a, b],
      roles: MISSION_INTERNAL_ROLES,
    });
  }
  return { teams };
}

/** Indeks tim gabungan untuk seorang peserta: akun, nama, lalu nama kelompok. */
export function matchJointTeam(teams, who = {}) {
  const list = Array.isArray(teams) ? teams : [];
  const uid = String(who.userId || '');
  const name = String(who.name || '').trim().toLowerCase();
  const group = String(who.groupName || '').trim().toLowerCase();
  if (uid) {
    for (let i = 0; i < list.length; i += 1) {
      const ids = Array.isArray(list[i]?.memberUserIds) ? list[i].memberUserIds : [];
      if (ids.some((id) => String(id) === uid)) return i;
    }
  }
  if (name) {
    for (let i = 0; i < list.length; i += 1) {
      const members = Array.isArray(list[i]?.members) ? list[i].members : [];
      if (members.some((m) => String(m).trim().toLowerCase() === name)) return i;
    }
  }
  if (group) {
    for (let i = 0; i < list.length; i += 1) {
      const pair = Array.isArray(list[i]?.pair) ? list[i].pair : [];
      if (pair.some((p) => String(p).trim().toLowerCase() === group)) return i;
    }
  }
  return -1;
}

/**
 * Normalisasi papan tim. Default maks 8. Mission Sequence memanggil dengan
 * `{ maxTeams: 5 }`, Creative Lab dengan `{ maxTeams: 10 }`.
 * `pair` (dua kelompok) dan `roles` (peran di dalam tim) untuk Mission Sequence.
 * Sub-tim `pot` & `bag` tetap kunci simpan Creative Lab (Stasiun A / B).
 */
export function cleanTeams(raw, opts = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cap = Math.min(LAB_MAX_TEAMS, Math.max(1, Number(opts.maxTeams) || DEFAULT_MAX_TEAMS));
  const teams = (Array.isArray(raw.teams) ? raw.teams : []).slice(0, cap).map((t) => ({
    name: str(t?.name, 80),
    task: str(t?.task, 200),
    members: (Array.isArray(t?.members) ? t.members : []).slice(0, 20).map((m) => str(m, 80)).filter(Boolean),
    done: Boolean(t?.done),
    scribe: str(t?.scribe, 80),
    station: str(t?.station, 80),
    pot: (Array.isArray(t?.pot) ? t.pot : []).slice(0, 6).map((m) => str(m, 80)).filter(Boolean),
    bag: (Array.isArray(t?.bag) ? t.bag : []).slice(0, 6).map((m) => str(m, 80)).filter(Boolean),
    repUserId: str(t?.repUserId, 64),
    repName: str(t?.repName, 80),
    memberUserIds: [...new Set((Array.isArray(t?.memberUserIds) ? t.memberUserIds : [])
      .map((m) => str(m, 64))
      .filter(Boolean))]
      .slice(0, 20),
    groupId: str(t?.groupId, 64),
    missing: Boolean(t?.missing),
    pair: (Array.isArray(t?.pair) ? t.pair : []).slice(0, 2).map((m) => str(m, 80)).filter(Boolean),
    roles: str(t?.roles, 400),
  })).filter((t) => t.name);
  if (!teams.length) return null;
  return { teams };
}

/** Fase aktivitas CREATIVE_LAB (timer display-only, transisi manual). */
export const ACTIVITY_PHASES = ['IDLE', 'A1', 'A2', 'PRESENT', 'DONE'];

/** Durasi baku tiap fase aktivitas (detik): A1 15', A2 25', presentasi ~2,5'/kelompok. */
export const ACTIVITY_PHASE_SECONDS = { IDLE: 0, A1: 900, A2: 1500, PRESENT: 150, DONE: 0 };

/**
 * Normalisasi state panggung Creative Lab:
 * fase aktivitas + timer, kartu jar yang tampil di layar (0-5), dan
 * kelompok yang sedang presentasi (presentIndex + timer 2').
 */
export function cleanActivity(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const phase = ACTIVITY_PHASES.includes(String(raw.phase || '').toUpperCase())
    ? String(raw.phase).toUpperCase()
    : 'IDLE';
  const fallbackSec = ACTIVITY_PHASE_SECONDS[phase] || 0;
  const durationSec = Math.min(7200, Math.max(60, Number(raw.durationSec) || fallbackSec || 60));
  const showOnScreen = raw.showOnScreen === undefined || raw.showOnScreen === null
    ? true
    : !(raw.showOnScreen === false || raw.showOnScreen === 0 || String(raw.showOnScreen).toLowerCase() === 'false');
  const presentSeconds = Math.min(600, Math.max(30, Number(raw.presentSeconds) || ACTIVITY_PHASE_SECONDS.PRESENT));
  const rawDur = raw.durations && typeof raw.durations === 'object' && !Array.isArray(raw.durations) ? raw.durations : {};
  const durationFor = (key, fallback) => Math.min(7200, Math.max(60, Number(rawDur[key]) || fallback));
  // Urutan presentasi hasil undian: index tim unik 0-9. Kosong = urutan papan.
  const presentOrder = [...new Set((Array.isArray(raw.presentOrder) ? raw.presentOrder : [])
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= LAB_PRESENT_INDEX_MAX))]
    .slice(0, LAB_MAX_TEAMS);
  return {
    phase,
    startedAt: raw.startedAt ? String(raw.startedAt).slice(0, 30) : null,
    durationSec,
    showOnScreen,
    cardIndex: Math.min(5, Math.max(0, Number(raw.cardIndex) || 0)),
    presentIndex: Math.min(LAB_PRESENT_INDEX_MAX, Math.max(0, Number(raw.presentIndex) || 0)),
    // 0 Pot, 1 Tas, 2 foto bersama. Sesi lama tanpa field ini mulai di slide Pot.
    presentSlide: Math.min(2, Math.max(0, Math.floor(Number(raw.presentSlide) || 0))),
    presentStartedAt: raw.presentStartedAt ? String(raw.presentStartedAt).slice(0, 30) : null,
    presentSeconds,
    presentOrder,
    presentDrawnAt: raw.presentDrawnAt ? String(raw.presentDrawnAt).slice(0, 30) : null,
    durations: {
      A1: durationFor('A1', ACTIVITY_PHASE_SECONDS.A1),
      A2: durationFor('A2', ACTIVITY_PHASE_SECONDS.A2),
      PRESENT: durationFor('PRESENT', presentSeconds),
    },
  };
}

/** Pecah daftar nama dari teks bebas (koma/titik-koma/baris baru). */
function splitNames(raw, max = 20) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Materialisasi Draft Sesi CREATIVE_LAB → papan tim + state aktivitas.
 * Membaca `storedDraft` (bentuk { [section]: { [field]: string } }).
 * Nama/anggota yang kosong tidak dikarang (tim tanpa nama dilewati).
 */
export function creativeLabFromDraft(storedDraft) {
  const d = storedDraft && typeof storedDraft === 'object' ? storedDraft : {};
  const groups = d.groups && typeof d.groups === 'object' ? d.groups : {};
  const teams = [];
  for (let n = 1; n <= 8; n += 1) {
    const name = str(groups[`group-${n}-name`], 80).trim();
    if (!name) continue;
    const legacyScribe = str(groups[`group-${n}-scribe`], 80);
    teams.push({
      name,
      task: str(groups[`group-${n}-task`], 200),
      members: splitNames(groups[`group-${n}-members`], 20),
      done: false,
      scribe: legacyScribe,
      station: str(groups[`group-${n}-station`], 80) || `Meja ${n}`,
      pot: splitNames(groups[`group-${n}-pot`], 6),
      bag: splitNames(groups[`group-${n}-bag`], 6),
      // Perwakilan group: field baru `group-n-rep`; fallback juru digital lama.
      repName: str(groups[`group-${n}-rep`], 80) || legacyScribe,
      repUserId: '',
      memberUserIds: [],
    });
  }
  const a1 = d['activity-1'] && typeof d['activity-1'] === 'object' ? d['activity-1'] : {};
  const a2 = d['activity-2'] && typeof d['activity-2'] === 'object' ? d['activity-2'] : {};
  const present = d.present && typeof d.present === 'object' ? d.present : {};
  const minutes = (v, fallback) => {
    const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };
  const presentSeconds = Math.min(600, Math.max(30, minutes(present['present-seconds'], ACTIVITY_PHASE_SECONDS.PRESENT)));
  return {
    teams: teams.length ? { teams } : null,
    activity: cleanActivity({
      phase: 'IDLE',
      startedAt: null,
      durationSec: ACTIVITY_PHASE_SECONDS.A1,
      showOnScreen: true,
      cardIndex: 0,
      presentIndex: 0,
      presentStartedAt: null,
      presentSeconds,
      // Slot durasi hasil draf (dipakai kontrol saat memulai tiap fase).
      durations: {
        A1: Math.min(7200, Math.max(60, minutes(a1['a1-minutes'], 15) * 60)),
        A2: Math.min(7200, Math.max(60, minutes(a2['a2-minutes'], 25) * 60)),
        PRESENT: presentSeconds,
      },
    }),
  };
}

function normLabName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Papan Creative Lab dari kelompok aktif di database.
 * `memberUserIds` = semua anggota aktif yang punya akun (akses feed).
 * `members` = roster tampilan, check-in didahulukan, maks 8.
 * `lockOrder` mempertahankan indeks tim yang sudah punya update karya.
 */
export function buildCreativeLabTeams(dbGroups, opts = {}) {
  const checked = new Set((opts.checkedInIds || []).map((id) => String(id)));
  const existing = Array.isArray(opts.existingTeams) ? opts.existingTeams : [];
  const lockOrder = Boolean(opts.lockOrder);
  const byName = new Map();
  for (const g of Array.isArray(dbGroups) ? dbGroups : []) {
    const key = normLabName(g?.name);
    if (key && !byName.has(key)) byName.set(key, g);
  }

  const makeFresh = (canonical, index) => {
    const g = byName.get(normLabName(canonical));
    const people = [];
    const seen = new Set();
    for (const m of g?.members || []) {
      const id = String(m?.userId || m?.id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      people.push({ id, name: String(m?.name || m?.user?.name || '').trim() });
    }
    people.sort((a, b) => {
      const ac = checked.has(a.id) ? 0 : 1;
      const bc = checked.has(b.id) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return a.name.localeCompare(b.name, 'id');
    });
    const roster = people.filter((p) => p.name).slice(0, LAB_ROSTER_MAX);
    return {
      groupId: g?.id ? String(g.id) : '',
      name: g?.name ? String(g.name).trim() : canonical,
      missing: !g,
      task: '',
      members: roster.map((p) => p.name),
      done: false,
      scribe: '',
      station: `Meja ${index + 1}`,
      pot: [],
      bag: [],
      repUserId: '',
      repName: '',
      memberUserIds: people.map((p) => p.id).slice(0, 20),
      _people: people,
    };
  };

  const fresh = CREATIVE_LAB_GROUP_NAMES.map((name, i) => makeFresh(name, i));

  const applyExisting = (base, ex) => {
    if (!ex) {
      const { _people, ...rest } = base;
      return rest;
    }
    const ids = new Set(base.memberUserIds);
    const names = new Set(base._people.map((p) => p.name.toLowerCase()).filter(Boolean));
    const keepList = (list) => (Array.isArray(list) ? list : [])
      .map((n) => String(n || '').trim())
      .filter((n) => n && names.has(n.toLowerCase()))
      .slice(0, 4);
    const repId = String(ex.repUserId || '');
    const repOk = Boolean(repId) && ids.has(repId);
    const person = repOk ? base._people.find((p) => p.id === repId) : null;
    const { _people, ...rest } = base;
    return {
      ...rest,
      task: str(ex.task, 200),
      station: str(ex.station, 80) || rest.station,
      done: Boolean(ex.done),
      pot: keepList(ex.pot),
      bag: keepList(ex.bag),
      repUserId: repOk ? repId : '',
      repName: repOk ? (person?.name || str(ex.repName, 80)) : '',
      scribe: str(ex.scribe, 80),
    };
  };

  const matchFresh = (ex, consumed) => fresh.find((f) => {
    if (consumed.has(f)) return false;
    const idMatch = f.groupId && String(ex?.groupId || '') === f.groupId;
    const nameMatch = normLabName(ex?.name) === normLabName(f.name);
    return idMatch || nameMatch;
  });

  let teams;
  if (!lockOrder) {
    const consumed = new Set();
    teams = fresh.map((base) => {
      const ex = existing.find((t) => matchFresh(t, consumed) === base);
      if (ex) consumed.add(base);
      return applyExisting(base, ex);
    });
  } else {
    const consumed = new Set();
    teams = [];
    for (const ex of existing) {
      const base = matchFresh(ex, consumed);
      if (!base) {
        if (!str(ex?.name, 80)) continue;
        teams.push({
          groupId: str(ex.groupId, 64),
          name: str(ex.name, 80),
          missing: false,
          task: str(ex.task, 200),
          members: (Array.isArray(ex.members) ? ex.members : []).slice(0, 20).map((m) => str(m, 80)).filter(Boolean),
          done: Boolean(ex.done),
          scribe: str(ex.scribe, 80),
          station: str(ex.station, 80),
          pot: (Array.isArray(ex.pot) ? ex.pot : []).slice(0, 6).map((m) => str(m, 80)).filter(Boolean),
          bag: (Array.isArray(ex.bag) ? ex.bag : []).slice(0, 6).map((m) => str(m, 80)).filter(Boolean),
          repUserId: str(ex.repUserId, 64),
          repName: str(ex.repName, 80),
          memberUserIds: [...new Set((Array.isArray(ex.memberUserIds) ? ex.memberUserIds : []).map((m) => str(m, 64)).filter(Boolean))].slice(0, 20),
        });
        continue;
      }
      consumed.add(base);
      teams.push(applyExisting(base, ex));
    }
    for (const base of fresh) {
      if (consumed.has(base)) continue;
      teams.push(applyExisting(base, null));
    }
    teams = teams.slice(0, LAB_MAX_TEAMS);
  }

  return {
    teams,
    missing: fresh.filter((f) => f.missing).map((f) => f.name),
    orderLocked: lockOrder,
  };
}
