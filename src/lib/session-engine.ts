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
    { id: 'panduan', label: 'Panduan', hint: 'Baca 5 pertanyaan dari firman pekan.' },
    { id: 'lagu', label: 'Bedah Lagu', hint: 'Makna tiap bait + penyanyi.' },
    { id: 'catatan', label: 'Diskusi', hint: 'Jawab Q yang dibuka pemicu.' },
    { id: 'satu-kata', label: 'Satu Kata', hint: 'Satu kata untuk minggumu.' },
    { id: 'komitmen', label: 'Komitmen', hint: 'Satu langkah nyata + unduh rekap.' },
  ],
  DEBAT: [
    { id: 'mosi', label: 'Mosi & Tim', hint: 'Lihat mosi ronde dan tim kamu.' },
    { id: 'catatan', label: 'Catatan Argumen', hint: 'Argumen terbaik + yang meyakinkanmu.' },
    { id: 'komitmen', label: 'Komitmen', hint: 'Siapa yang akan kamu nasihati + unduh rekap.' },
  ],
  BEDAH_FILM: [
    { id: 'nonton', label: 'Nonton & Catat', hint: 'Catat 3 jawaban selama/paralel film.' },
    { id: 'kesaksian', label: 'Kesaksian', hint: 'Undian 4 orang + tulis komitmenmu.' },
    { id: 'komitmen', label: 'Komitmen Otentik', hint: 'Topeng yang dilepas + unduh rekap.' },
  ],
  THREE_SEQUENCES: [
    { id: 'misi', label: 'Mission Room', hint: 'Ikuti peran tim kamu.' },
    { id: 'laporan', label: 'Laporan & Catat', hint: 'Tulis hasil + pelajaran misimu.' },
    { id: 'komitmen', label: 'Deklarasi', hint: 'Deklarasi Coram Deo + unduh rekap.' },
  ],
};

export const POST_TO_POST_ORDER: SegmentId[] = ['likert', 'arah', 'kunjungan', 'lesson'];

/** Segmen aktif generik: maju mengikuti status; `filled` (sudah mencatat) memajukan satu langkah saat RUNNING. */
export function segmentForPattern(code: string | null | undefined, status: string, filled: boolean): string {
  const c = resolvePatternCode(code);
  if (c === 'POST_TO_POST' || !PATTERN_SEGMENTS[c]) return segmentFor(status as never, filled) as string;
  const order = PATTERN_SEGMENTS[c].map((s) => s.id);
  const st = String(status || '').toUpperCase();
  if (st === 'WRAPUP' || st === 'CLOSED') return order[order.length - 1];
  if (st === 'RUNNING') return filled ? order[order.length - 1] : order[1] || order[0];
  return order[0];
}

/** Gerbang buka segmen generik (monoton maju; kompatibel post-to-post). */
export function canOpenSegmentPattern(
  code: string | null | undefined,
  segment: string,
  status: string,
  filled: boolean,
): boolean {
  const c = resolvePatternCode(code);
  if (c === 'POST_TO_POST' || !PATTERN_SEGMENTS[c]) {
    return canOpenSegment(segment as SegmentId, status as never, filled);
  }
  const order = PATTERN_SEGMENTS[c].map((s) => s.id);
  const target = segmentForPattern(c, status, filled);
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
    { key: 'SATU-KATA', label: 'Satu kata untuk minggumu', placeholder: 'Contoh: Lelah, Pulang, Lega...' },
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

/** Widget per segmen: guide | song | rounds | screening | teams | testimony | notes | download. */
export type SegmentWidget = 'guide' | 'song' | 'rounds' | 'screening' | 'teams' | 'testimony' | 'notes' | 'download';

/** Urutan kunci Q terpandu MONOLOG (3 FGD + 2 deep sharing). */
export const MONOLOG_QUESTION_KEYS = ['FGD-OBSERVE', 'FGD-INTERPRET', 'FGD-APPLY', 'DEEP-Q1', 'DEEP-Q2'];

/** Q ke-n (1-5) terbuka bila currentQ dari kontrol >= n. */
export function isQuestionOpen(questionIndex1Based: number, currentQ: number): boolean {
  return Number(currentQ || 0) >= questionIndex1Based;
}

export const SEGMENT_WIDGETS: Record<string, Record<string, SegmentWidget[]>> = {
  MONOLOG: {
    panduan: ['guide', 'notes', 'download'],
    lagu: ['song'],
    catatan: ['notes'],
    'satu-kata': ['notes'],
    komitmen: ['testimony', 'notes', 'download'],
  },
  DEBAT: {
    mosi: ['rounds'],
    catatan: ['rounds', 'notes'],
    komitmen: ['rounds', 'notes', 'download'],
  },
  BEDAH_FILM: {
    nonton: ['screening', 'notes'],
    kesaksian: ['testimony', 'notes'],
    komitmen: ['notes', 'download'],
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
