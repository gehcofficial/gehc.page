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
    { id: 'mosi', label: 'Mosi & Tim', hint: 'Lihat mosi ronde dan tim kamu.' },
    { id: 'catatan', label: 'Catatan Argumen', hint: 'Argumen terbaik + yang meyakinkanmu.' },
    { id: 'komitmen', label: 'Komitmen', hint: 'Siapa yang akan kamu nasihati + unduh rekap.' },
  ],
  BEDAH_FILM: [
    { id: 'likert-awal', label: 'Likert Awal', hint: '5 pernyataan baseline sebelum nonton (wajib semua).' },
    { id: 'nonton', label: 'Nonton & Catat', hint: 'Catat 3 adegan paralel firman selama film.' },
    { id: 'deep', label: 'Deep Sharing', hint: '3 pertanyaan wajib + komitmen.' },
    { id: 'likert-akhir', label: 'Likert Akhir', hint: '5 item yang sama — lihat perubahanmu.' },
    { id: 'komitmen', label: 'Komitmen + Chip', hint: 'Komitmen otentik + chip Lesson Learned.' },
    { id: 'kesaksian', label: 'Kesaksian', hint: 'Undi 1 Mentee + 1 Mentor + unduh rekap.' },
  ],
  THREE_SEQUENCES: [
    { id: 'misi', label: 'Mission Room', hint: 'Ikuti peran tim kamu.' },
    { id: 'laporan', label: 'Laporan & Catat', hint: 'Tulis hasil + pelajaran misimu.' },
    { id: 'komitmen', label: 'Deklarasi', hint: 'Deklarasi Coram Deo + unduh rekap.' },
  ],
};

export const POST_TO_POST_ORDER: SegmentId[] = ['likert', 'arah', 'kunjungan', 'lesson'];

/** State progres film untuk stepper (pre/post likert, deep, chip, screening). */
export type FilmProgress = {
  preAnswered?: boolean;
  postAnswered?: boolean;
  deepFilled?: boolean;
  chipDone?: boolean;
  screeningOn?: boolean;
};

/** Segmen aktif generik: maju mengikuti status + fase MONOLOG (F1/F2/F3/CLOSING). */
export function segmentForPattern(
  code: string | null | undefined,
  status: string,
  filled: boolean,
  live?: { phaseName?: string | null },
  extra?: FilmProgress,
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
  // BEDAH_FILM: likert-awal → nonton → deep → likert-akhir → komitmen → kesaksian.
  if (c === 'BEDAH_FILM') {
    const e = extra || {};
    if (st === 'WRAPUP') return e.chipDone ? 'kesaksian' : 'komitmen';
    if (st === 'RUNNING') {
      if (!e.preAnswered) return 'likert-awal';
      if (e.screeningOn) return 'nonton';
      if (!e.deepFilled) return 'deep';
      if (!e.postAnswered) return 'likert-akhir';
      if (!e.chipDone) return 'komitmen';
      return 'kesaksian';
    }
    return 'likert-awal';
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
  extra?: FilmProgress,
): boolean {
  const c = resolvePatternCode(code);
  if (c === 'POST_TO_POST' || !PATTERN_SEGMENTS[c]) {
    return canOpenSegment(segment as SegmentId, status as never, filled);
  }
  const order = PATTERN_SEGMENTS[c].map((s) => s.id);
  const target = segmentForPattern(c, status, filled, live, extra);
  return order.indexOf(segment) <= order.indexOf(target);
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
    { key: 'LAPORAN', label: 'Laporan misimu', placeholder: 'Peran + hasil tim + pelajaran...' },
  ],
};

export function noteSlotsFor(code: string | null | undefined): NoteSlot[] {
  const c = resolvePatternCode(code);
  const slots = NOTE_SLOTS[c] || [];
  return [...slots, { key: COMMITMENT_KEY, label: 'Komitmen pribadiku', placeholder: 'Satu komitmen spesifik minggu ini...' }];
}

/** Widget per segmen: welcome | guide | song | chips | rounds | screening | teams | testimony | notes | download | likert. */
export type SegmentWidget = 'welcome' | 'guide' | 'song' | 'chips' | 'rounds' | 'screening' | 'teams' | 'testimony' | 'notes' | 'download' | 'likert';

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

export const SEGMENT_WIDGETS: Record<string, Record<string, SegmentWidget[]>> = {
  MONOLOG: {
    sambutan: ['welcome'],
    lagu: ['song', 'notes'],
    catatan: ['notes'],
    'satu-kata': ['chips', 'testimony', 'download'],
    penutup: ['testimony', 'notes', 'download'],
  },
  DEBAT: {
    mosi: ['rounds'],
    catatan: ['rounds', 'notes'],
    komitmen: ['rounds', 'notes', 'download'],
  },
  BEDAH_FILM: {
    'likert-awal': ['likert'],
    nonton: ['screening', 'notes'],
    deep: ['notes'],
    'likert-akhir': ['likert'],
    komitmen: ['chips', 'notes', 'download'],
    kesaksian: ['testimony', 'download'],
  },
  THREE_SEQUENCES: {
    misi: ['teams'],
    laporan: ['teams', 'notes'],
    komitmen: ['notes', 'download'],
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
};

export function sessionModuleLabel(code: string): string {
  return SESSION_MODULE_LABELS[code] || code;
}
