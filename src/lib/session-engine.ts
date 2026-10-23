/**
 * Engine sesi hari-H generik (fondasi semua pola ibadah).
 *
 * Post-to-Post memakai alur khususnya (src/lib/mentoring.ts — kompatibel mundur).
 * Lima pola lain memakai registry segmen di sini: urutan segmen + gerbang buka
 * mengikuti status server yang sama (DRAFT → LIKERT_OPEN → RUNNING → WRAPUP → CLOSED).
 */

import { canOpenSegment, segmentFor, type SegmentId } from './mentoring';

export type PatternSegment = { id: string; label: string; hint: string };

/** Pola lama yang dilebur — selalu dipetakan ke penggantinya. */
export const MERGED_PATTERN_ALIAS: Record<string, string> = {
  DUAL_MONOLOG: 'MONOLOG',
};

/** Metadata pola: slug Inggris + label tampilan Indonesia (enum DB `code` tidak diubah). */
export const PATTERN_CATALOG_META: Record<
  string,
  { key: string; titleEn: string; displayLabelId: string }
> = {
  MONOLOG: { key: 'monolog-dialog', titleEn: 'Monolog Dialog', displayLabelId: 'Monolog & Dialog' },
  BEDAH_FILM: { key: 'movie-breakdown', titleEn: 'Movie Breakdown', displayLabelId: 'Bedah Film' },
  DEBAT: { key: 'battle-of-minds', titleEn: 'Battle of Minds', displayLabelId: 'Debat' },
  CREATIVE_LAB: { key: 'creative-lab', titleEn: 'Creative Lab', displayLabelId: 'Creative Lab' },
  THREE_SEQUENCES: { key: 'mission-sequence', titleEn: 'Mission Sequence', displayLabelId: 'Misi Bersama' },
  POST_TO_POST: { key: 'post-to-post', titleEn: 'Post to Post', displayLabelId: 'Post to Post' },
};

/** Slug / alias lama → enum `code` kanonis. */
export const PATTERN_KEY_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(PATTERN_CATALOG_META).flatMap(([code, m]) => [
    [m.key, code],
    [code, code],
  ]),
);

export function patternKey(code: string | null | undefined): string {
  const c = resolvePatternCode(code);
  return PATTERN_CATALOG_META[c]?.key || String(c || '').toLowerCase();
}

export function patternDisplayLabel(code: string | null | undefined): string {
  const c = resolvePatternCode(code);
  return PATTERN_CATALOG_META[c]?.displayLabelId || c;
}

export function matchesPatternCode(code: string | null | undefined, keyOrCode: string): boolean {
  const c = resolvePatternCode(code);
  const probe = String(keyOrCode || '').trim();
  if (!probe) return false;
  const upper = probe.toUpperCase();
  if (c === upper) return true;
  if (resolvePatternCode(upper) === c) return true;
  const fromKey = PATTERN_KEY_TO_CODE[probe.toLowerCase()];
  return fromKey ? resolvePatternCode(fromKey) === c : false;
}

/** Selesaikan kode pola (terapkan alias pola yang dilebur). */
export function resolvePatternCode(code: string | null | undefined): string {
  const c = String(code || '').toUpperCase();
  return MERGED_PATTERN_ALIAS[c] || c;
}

/** Urutan segmen per pola (id stabil — dipakai gerbang + stepper UI). */
export const PATTERN_SEGMENTS: Record<string, PatternSegment[]> = {
  MONOLOG: [
    { id: 'sambutan', label: 'Sambutan', hint: 'Salam personal + tema pekan sambil menunggu akses dibuka.' },
    { id: 'lagu', label: 'Bedah Lagu', hint: 'Nomor buku + kisah + makna tiap bait; catat Q1-Q3.' },
    { id: 'catatan', label: 'Diskusi', hint: 'Jawab Q yang dibuka pemicu.' },
    { id: 'satu-kata', label: 'Lesson Learned', hint: 'Pilih maks 3 chip + undian kesaksian.' },
    { id: 'penutup', label: 'Penutup', hint: 'Komitmen + transisi 5 menit + rekap + unduh.' },
  ],
  DEBAT: [
    { id: 'mosi', label: 'Mosi & Tim', hint: 'Mosi ronde aktif + langkah & timer + tim kamu.' },
    { id: 'catatan', label: 'Catatan Argumen', hint: 'Argumen terbaik + yang meyakinkanmu.' },
    { id: 'komitmen', label: 'Komitmen', hint: 'Siapa yang akan kamu nasihati + unduh rekap.' },
  ],
  BEDAH_FILM: [
    { id: 'likert-awal', label: 'Likert Awal', hint: '5 pernyataan baseline sebelum nonton (wajib semua).' },
    { id: 'nonton', label: 'Nonton & Catat', hint: 'Catat 3 Q selama film — tiap jawaban ada afirmasi firman.' },
    { id: 'likert-akhir', label: 'Likert Akhir', hint: '5 item yang sama + Lesson Learned terbuka serentak.' },
    { id: 'lesson-learned', label: 'Lesson Learned', hint: 'Pilih maks 3 chip + komitmen.' },
    { id: 'kesaksian', label: 'Kesaksian', hint: 'Undi 1 Mentee + 1 Mentor + unduh rekap.' },
  ],
  THREE_SEQUENCES: [
    { id: 'misi', label: 'Sesi 3 · Mission Room', hint: 'Kerjakan seluruh misi bersama tim gabunganmu. Peran di dalam tim hanya pembagian tugas.' },
    { id: 'laporan', label: 'Laporan & Catat', hint: 'Tulis hasil tim gabungan + pelajaran misimu.' },
    { id: 'komitmen', label: 'Penutup Sesi', hint: 'Deklarasi Coram Deo + unduh rekap. Id segmen tetap komitmen.' },
  ],
  CREATIVE_LAB: [
    { id: 'briefing', label: 'Firman & Briefing', hint: '10 menit layar judul firman; 5 menit panggil perwakilan. Undian sudah di depan.' },
    { id: 'aktivitas-1', label: 'Sesi 1', hint: 'Tulis di kertas; pilih 2 pertanyaan untuk diisi di web.' },
    { id: 'aktivitas-2', label: 'Sesi 2', hint: 'Perwakilan mengisi makna & foto; yang lain melihat progres.' },
    { id: 'presentasi', label: 'Presentasi Kelompok', hint: 'Satu slide per aktivitas seni + Commitment. Reaksi Suka/Biasa/Kurang.' },
    { id: 'refleksi', label: 'Refleksi', hint: 'Reaksi presentasi + komitmen pribadi.' },
    { id: 'penutup', label: 'Penutup', hint: 'Liturgi penutup + unduh rekap.' },
  ],
};

export const POST_TO_POST_ORDER: SegmentId[] = ['likert', 'arah', 'kunjungan', 'lesson'];

/** State progres film untuk stepper (pre/post likert, chip, gate AKHIR). */
export type FilmProgress = {
  preAnswered?: boolean;
  postAnswered?: boolean;
  chipDone?: boolean;
  screeningOn?: boolean;
  /** Gate ronde AKHIR terbuka (kontrol M3) — peserta maju ke likert-akhir. */
  postOpen?: boolean;
  /** Gate ronde AWAL masih terbuka (kontrol M0) — peserta telat tanpa jawaban tak terkunci. */
  preOpen?: boolean;
};

/** State panggung Creative Lab (fase aktivitas + kelompok yang presentasi). */
export type ActivityProgress = {
  activityPhase?: string | null;
  presentIndex?: number;
};

/** Progres segmen gabungan (film + aktivitas) — aditif, kompatibel pola lama. */
export type SessionProgress = FilmProgress & ActivityProgress;

/** Segmen aktif generik: maju mengikuti status + fase MONOLOG (F1/F2/F3/CLOSING). */
export function segmentForPattern(
  code: string | null | undefined,
  status: string,
  filled: boolean,
  live?: { phaseName?: string | null },
  extra?: SessionProgress,
): string {
  const c = resolvePatternCode(code);
  if (c === 'POST_TO_POST' || !PATTERN_SEGMENTS[c]) return segmentFor(status as never, filled) as string;
  const order = PATTERN_SEGMENTS[c].map((s) => s.id);
  const st = String(status || '').toUpperCase();
  if (st === 'CLOSED') return order[order.length - 1];
  if (c === 'MONOLOG') {
    const phase = String(live?.phaseName || '').toUpperCase();
    if (st === 'WRAPUP') return phase === 'CLOSING' ? 'penutup' : 'satu-kata';
    if (st === 'RUNNING') return phase === 'F2' ? 'catatan' : order[1] || order[0];
    return order[0];
  }
  // BEDAH_FILM: likert-awal → nonton → likert-akhir (+Lesson Learned serentak) → lesson-learned → kesaksian.
  // Maju mengikuti GATE kontrol (postOpen), bukan countdown — film mengikuti durasi tayang.
  if (c === 'BEDAH_FILM') {
    const e = extra || {};
    if (st === 'WRAPUP') return e.chipDone ? 'kesaksian' : 'lesson-learned';
    if (st === 'RUNNING') {
      // Peserta telat saat gate AWAL sudah dikunci (M1) lanjut nonton — bukan terkunci.
      if (!e.preAnswered && e.preOpen !== false) return 'likert-awal';
      if (e.postOpen || e.postAnswered) {
        if (!e.postAnswered) return 'likert-akhir';
        if (!e.chipDone) return 'lesson-learned';
        return 'kesaksian';
      }
      return 'nonton';
    }
    return 'likert-awal';
  }
  // CREATIVE_LAB: segmen maju mengikuti fase panggung (A1 → A2 → PRESENT → DONE).
  if (c === 'CREATIVE_LAB') {
    const phase = String((extra || {}).activityPhase || 'IDLE').toUpperCase();
    if (st === 'CLOSED') return 'penutup';
    if (st === 'WRAPUP') return 'refleksi';
    if (st === 'RUNNING') {
      if (phase === 'A1') return 'aktivitas-1';
      if (phase === 'A2') return 'aktivitas-2';
      if (phase === 'PRESENT') return 'presentasi';
      if (phase === 'DONE') return 'refleksi';
      if (phase === 'DRAW') return 'briefing';
      return 'briefing';
    }
    return 'briefing';
  }
  if (st === 'WRAPUP') return order[order.length - 1];
  if (st === 'RUNNING') {
    return filled ? order[order.length - 1] : order[1] || order[0];
  }
  return order[0];
}

/** Gerbang buka segmen generik (monoton maju; kompatibel post-to-post). */
export function canOpenSegmentPattern(
  code: string | null | undefined,
  segment: string,
  status: string,
  filled: boolean,
  live?: { phaseName?: string | null },
  extra?: SessionProgress,
): boolean {
  const c = resolvePatternCode(code);
  if (c === 'POST_TO_POST' || !PATTERN_SEGMENTS[c]) {
    return canOpenSegment(segment as SegmentId, status as never, filled);
  }
  const order = PATTERN_SEGMENTS[c].map((s) => s.id);
  const target = segmentForPattern(c, status, filled, live, extra);
  return order.indexOf(segment) <= order.indexOf(target);
}

/**
 * Segmen efektif dengan pin mundur (kembali ke flow yang sudah terbuka).
 * Pin dipakai hanya bila tahapnya sudah terbuka (indeks ≤ tahap alur server);
 * selain itu (pin ke depan / tak dikenal / kosong) ikut alur server — sehingga
 * polling yang memajukan alur tak pernah menarik mundur paksa.
 */
export function resolvePinnedSegment(
  order: string[],
  pinned: string | null,
  derived: string,
): string {
  if (!pinned || !order.includes(pinned)) return derived;
  if (!order.includes(derived)) return pinned;
  return order.indexOf(pinned) <= order.indexOf(derived) ? pinned : derived;
}

/** Slot catatan peserta per pola (topicCode WorshipNote; KOMITMEN selalu terakhir). */
export type NoteSlot = { key: string; label: string; placeholder: string };

export const COMMITMENT_KEY = 'KOMITMEN';

export const NOTE_SLOTS: Record<string, NoteSlot[]> = {
  MONOLOG: [
    { key: 'FGD-OBSERVE', label: 'Q1 Observasi — apa kata teks?', placeholder: 'Tulis hasil pengamatan kelompokmu...' },
    { key: 'FGD-INTERPRET', label: 'Q2 Interpretasi — apa artinya?', placeholder: 'Kaitkan dengan tema pekan...' },
    { key: 'FGD-APPLY', label: 'Q3 Aplikasi — langkah nyata', placeholder: 'Langkah nyatamu minggu ini...' },
    { key: 'DEEP-Q1', label: 'Q4 Di mana kamu melihat dirimu?', placeholder: 'Tulis jawaban pertanyaan 4...' },
    { key: 'DEEP-Q2', label: 'Q5 Langkah pulangmu?', placeholder: 'Tulis jawaban pertanyaan 5...' },
  ],
  DEBAT: [
    { key: 'ARGUMEN', label: 'Argumen terbaik yang kamu dengar', placeholder: 'Tulis + dari tim mana...' },
    { key: 'YAKIN', label: 'Apa yang meyakinkanmu?', placeholder: 'Mosi + alasan...' },
  ],
  BEDAH_FILM: [
    { key: 'FILM-Q1', label: 'Kapan terakhir berakting suci?', placeholder: 'Tulis jawabanmu...' },
    { key: 'FILM-Q2', label: 'Topeng terberatmu?', placeholder: 'Tulis jawabanmu...' },
    { key: 'FILM-Q3', label: 'Langkah otentik minggu ini?', placeholder: 'Tulis komitmen spesifik...' },
  ],
  THREE_SEQUENCES: [
    { key: 'LAPORAN', label: 'Laporan misimu', placeholder: 'Hasil tim gabungan + pelajaran...' },
  ],
  CREATIVE_LAB: [
    { key: 'JAR-ROOT', label: 'A Root I Carry', placeholder: 'Nilai iman/tradisi baik yang ingin kamu bawa...' },
    { key: 'JAR-TRUTH', label: 'A Truth I Need to Remember', placeholder: 'Kebenaran tentang Kristus yang ingin kamu ingat...' },
    { key: 'JAR-LOST', label: 'When I Feel Lost', placeholder: 'Pesan penguatan saat merasa jauh dari Tuhan...' },
    { key: 'JAR-COMMUNITY', label: 'A Word for My Community', placeholder: 'Pesan untuk anggota kelompokmu...' },
    { key: 'JAR-VERSE', label: 'A Verse to Hold Onto', placeholder: 'Ayat + referensi yang ingin kamu pegang...' },
    { key: 'JAR-STEP', label: 'My Next Faith Step', placeholder: 'Satu tindakan nyata minggu ini...' },
  ],
};

export function noteSlotsFor(code: string | null | undefined): NoteSlot[] {
  const c = resolvePatternCode(code);
  const slots = NOTE_SLOTS[c] || [];
  return [...slots, { key: COMMITMENT_KEY, label: 'Komitmen pribadiku', placeholder: 'Satu komitmen spesifik minggu ini...' }];
}

/** Widget per segmen: welcome | guide | song | chips | rounds | screening | teams | testimony | notes | download | likert | activity. */
export type SegmentWidget = 'welcome' | 'guide' | 'song' | 'chips' | 'rounds' | 'screening' | 'teams' | 'testimony' | 'notes' | 'download' | 'likert' | 'activity' | 'jar' | 'lab';

/** Urutan kunci Q terpandu MONOLOG (3 FGD + 2 deep sharing). */
export const MONOLOG_QUESTION_KEYS = ['FGD-OBSERVE', 'FGD-INTERPRET', 'FGD-APPLY', 'DEEP-Q1', 'DEEP-Q2'];

/** Q ke-n (1-5) terbuka bila currentQ dari kontrol >= n. */
export function isQuestionOpen(questionIndex1Based: number, currentQ: number): boolean {
  return Number(currentQ || 0) >= questionIndex1Based;
}

/** Pasangan pernyataan Likert film PRE/POST (urutan = sortOrder server). */
export type FilmLikertPair = {
  n: number;
  text: string;
  preId: string | null;
  postId: string | null;
  pre: number | null;
  post: number | null;
  delta: number | null;
};

export function filmLikertPairs(
  items: { id: string; topicCode: string; text: string }[],
  myValues: Record<string, number>,
): FilmLikertPair[] {
  const pre = (items || []).filter((i) => String(i.topicCode || '').toUpperCase() === 'FILM_PRE');
  const post = (items || []).filter((i) => String(i.topicCode || '').toUpperCase() === 'FILM_POST');
  const n = Math.max(pre.length, post.length);
  const out: FilmLikertPair[] = [];
  for (let k = 0; k < n; k += 1) {
    const a = pre[k] || null;
    const b = post[k] || null;
    const pv = a && myValues[a.id] != null ? Number(myValues[a.id]) : null;
    const qv = b && myValues[b.id] != null ? Number(myValues[b.id]) : null;
    out.push({
      n: k + 1,
      text: (a?.text || b?.text || '').trim(),
      preId: a?.id || null,
      postId: b?.id || null,
      pre: pv,
      post: qv,
      delta: pv != null && qv != null ? qv - pv : null,
    });
  }
  return out;
}

/** Rata-rata agregat pre/post per pasangan (untuk layar + delta). */
export function filmLikertMeans(
  pairs: FilmLikertPair[],
  means: Record<string, { avg: number; n: number }>,
): { n: number; preAvg: number | null; preN: number; postAvg: number | null; postN: number; delta: number | null }[] {
  return (pairs || []).map((p) => {
    const a = p.preId ? means[p.preId] : null;
    const b = p.postId ? means[p.postId] : null;
    const preAvg = a ? Number(a.avg) : null;
    const postAvg = b ? Number(b.avg) : null;
    return {
      n: p.n,
      preAvg,
      preN: a ? Number(a.n) || 0 : 0,
      postAvg,
      postN: b ? Number(b.n) || 0 : 0,
      delta: preAvg != null && postAvg != null ? Math.round((postAvg - preAvg) * 10) / 10 : null,
    };
  });
}

/**
 * Pilihan Likert film saat payload polling (20 dtk) menyegar: pertahankan
 * pilihan lokal yang belum dikirim, isi hanya yang belum ada dari jawaban
 * tersimpan server, dan buang id ronde lain (id PRE≠POST). Mengembalikan
 * referensi lama bila tak ada perubahan agar tak memicu re-render.
 */
export function mergeFilmVals(
  prev: Record<string, number>,
  pairs: FilmLikertPair[],
  round: 'PRE' | 'POST',
  myValues: Record<string, number> | null | undefined,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const p of pairs || []) {
    const id = round === 'PRE' ? p.preId : p.postId;
    if (!id) continue;
    const local = prev[id];
    const server = myValues?.[id];
    const v = local != null ? local : server != null ? Number(server) : null;
    if (v != null && Number.isFinite(v)) next[id] = v;
  }
  const keys = Object.keys(next);
  const same = keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k]);
  return same ? prev : next;
}

/** Langkah baku 1 ronde debat (11 langkah = 20 menit = 1200 dtk) — paritas server. */
export const ROUND_STEPS: { key: string; label: string; seconds: number }[] = [
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

export const ROUND_STEP_SECONDS = ROUND_STEPS.map((s) => s.seconds);

export const JURY_CRITERIA: { key: string; label: string; weight: number }[] = [
  { key: 'biblika', label: 'Argumen biblika', weight: 40 },
  { key: 'logika', label: 'Logika', weight: 30 },
  { key: 'teamwork', label: 'Teamwork', weight: 20 },
  { key: 'etika', label: 'Etika', weight: 10 },
];

export const JURY_WEIGHTS: Record<string, number> = { biblika: 40, logika: 30, teamwork: 20, etika: 10 };

export function roundStepLabel(step: number | string | null | undefined): string {
  const s = ROUND_STEPS[Number(step)] || ROUND_STEPS[0];
  return s.label;
}

/** Skor satu sisi (PRO/KONTRA) dari 4 kriteria berbobot (maks 100). */
export function jurySideScore(side: Record<string, unknown> | null | undefined): number {
  const o = side && typeof side === 'object' ? side : {};
  return JURY_CRITERIA.reduce((n, c) => n + Math.min(c.weight, Math.max(0, Number(o[c.key]) || 0)), 0);
}

export const SEGMENT_WIDGETS: Record<string, Record<string, SegmentWidget[]>> = {
  MONOLOG: {
    sambutan: ['welcome'],
    lagu: ['song', 'notes'],
    catatan: ['notes'],
    'satu-kata': ['chips', 'testimony', 'download'],
    penutup: ['testimony', 'notes', 'download'],
  },
  DEBAT: {
    mosi: ['rounds', 'teams'],
    catatan: ['rounds', 'notes'],
    komitmen: ['rounds', 'notes', 'download'],
  },
  BEDAH_FILM: {
    'likert-awal': ['likert'],
    nonton: ['screening', 'notes'],
    'likert-akhir': ['likert', 'chips'],
    'lesson-learned': ['chips', 'notes', 'download'],
    kesaksian: ['testimony', 'download'],
  },
  THREE_SEQUENCES: {
    misi: ['teams'],
    laporan: ['teams', 'notes'],
    komitmen: ['notes', 'download'],
  },
  CREATIVE_LAB: {
    pembuka: ['welcome'],
    briefing: ['guide'],
    'aktivitas-1': ['activity', 'jar', 'teams'],
    'aktivitas-2': ['activity', 'lab', 'teams'],
    presentasi: ['teams', 'lab'],
    refleksi: ['chips', 'notes', 'download'],
    penutup: ['chips', 'download'],
  },
};

export function widgetsFor(code: string | null | undefined, segment: string): SegmentWidget[] {
  const c = resolvePatternCode(code);
  return SEGMENT_WIDGETS[c]?.[segment] || [];
}

/** Label modul sesi (registry tampilan; sumber kebenaran isi ada di DB). */
export const SESSION_MODULE_LABELS: Record<string, string> = {
  likert: 'Likert',
  rooms: 'Ruang',
  timer: 'Timer',
  notes: 'Catatan',
  chips: 'Chip',
  wordcloud: 'Word cloud',
  rounds: 'Ronde debat',
  screening: 'Pemutaran',
  teams: 'Tim misi',
  fgd: 'Panduan FGD',
  testimony: 'Undian kesaksian',
  activity: 'Aktivitas & timer',
};

export function sessionModuleLabel(code: string): string {
  return SESSION_MODULE_LABELS[code] || code;
}
