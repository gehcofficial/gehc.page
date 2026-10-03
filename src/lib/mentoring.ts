export type MentoringView = 'peserta' | 'layar' | 'kontrol';

export type MentoringRoute = { slug: string; view: MentoringView };

export type MentoringStatus = 'DRAFT' | 'LIKERT_OPEN' | 'RUNNING' | 'WRAPUP' | 'CLOSED';

export type MentoringTopic = { code: string; label: string; pic?: string | null };

export type MentoringRoom = {
  code: string;
  label: string;
  floor: number;
  floorLabel: string;
  venue?: { id: string; name: string; capacity: number } | null;
  capacity: number;
  isFull: boolean;
  rank: number;
  total: number;
  count: number;
};

export type MentoringTimer = {
  serverNow: string;
  startedAt: string | null;
  timerSeconds: number;
  elapsed: number;
  remaining: number;
};

export type MentoringPattern = {
  code: string;
  name: string;
  summary?: string | null;
  defaultDurationMin?: number | null;
  phases?: { no?: number; title?: string; minutes?: number; owner?: string; notes?: string }[];
  modules?: string[];
};

export type MentoringLikertItem = {
  id: string;
  topicCode: string;
  text: string;
  gospelNote?: string | null;
};

export type MentoringMyResult = {
  topicCode: string;
  topicLabel: string;
  floor: number;
  floorLabel: string;
  venue?: { id: string; name: string; capacity: number } | null;
  vulnerability: number;
  affirmations: string[];
};

export type MentoringSessionPayload = {
  session: {
    id: string;
    slug: string;
    title: string;
    status: MentoringStatus;
    sessionDate?: string | null;
    pattern: MentoringPattern | null;
    topics: MentoringTopic[];
    chipLimit: number;
  };
  timer: MentoringTimer;
  likert: {
    items: MentoringLikertItem[];
    open: boolean;
    answered: boolean;
    myValues: Record<string, number>;
  };
  chips: { list: { code: string; label: string; topicCode?: string | null }[]; mine: string[]; open: boolean };
  me: { id: string; name: string };
  notes: Record<string, string>;
  myResult: MentoringMyResult | null;
  rooms: MentoringRoom[];
  progress: { submitted: number; total: number };
};

export type MentoringLivePayload = {
  session: {
    id: string;
    slug: string;
    title: string;
    status: MentoringStatus;
    pattern: MentoringPattern | null;
    topics: MentoringTopic[];
  };
  timer: MentoringTimer;
  progress: { submitted: number; total: number };
  rooms: MentoringRoom[];
  wordcloud: { code: string; label: string; count: number }[];
  wrapUpAt: string | null;
};

export function isMentoringHash(hash: string): boolean {
  const h = String(hash || '');
  return h === '#/mentoring' || h.startsWith('#/mentoring/') || h.startsWith('#/mentoring?');
}

export function parseMentoringHash(hash: string): MentoringRoute | null {
  const raw = String(hash || '')
    .replace(/^#\/?/, '')
    .split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  if (seg[0] !== 'mentoring') return null;
  const view: MentoringView = seg[2] === 'layar' ? 'layar' : seg[2] === 'kontrol' ? 'kontrol' : 'peserta';
  return { slug: seg[1] || '', view };
}

export function mentoringCodeKey(slug: string): string {
  return `gehc_mentoring_code_${slug}`;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const SCALE_LABELS = ['Sangat tidak setuju', 'Tidak setuju', 'Netral', 'Setuju', 'Sangat setuju'];

export type SegmentId = 'likert' | 'arah' | 'kunjungan' | 'lesson';

export const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: 'likert', label: 'Likert' },
  { id: 'arah', label: 'Arah Pos' },
  { id: 'kunjungan', label: 'Kunjungan & Catatan' },
  { id: 'lesson', label: 'Lesson Learned' },
];

/**
 * Segmen yang seharusnya aktif, mengikuti status server + progres peserta.
 * Urutan: Likert → Arah Pos → Kunjungan → Lesson Learned.
 */
export function segmentFor(status: MentoringStatus, answered: boolean): SegmentId {
  if (status === 'WRAPUP' || status === 'CLOSED') return 'lesson';
  if (status === 'RUNNING') return answered ? 'kunjungan' : 'likert';
  if (status === 'LIKERT_OPEN') return answered ? 'arah' : 'likert';
  return 'likert';
}

export function canOpenSegment(segment: SegmentId, status: MentoringStatus, answered: boolean): boolean {
  if (segment === 'lesson') return status === 'WRAPUP' || status === 'CLOSED';
  if (segment === 'kunjungan') return status === 'RUNNING' || status === 'WRAPUP' || status === 'CLOSED';
  if (segment === 'arah') return answered;
  return true;
}

/** Rute kunjungan berurutan sesuai ranking kerentanan (rank 1 dulu). */
export function orderedRoute(rooms: MentoringRoom[]): MentoringRoom[] {
  return [...rooms].sort((a, b) => (a.rank || 0) - (b.rank || 0));
}

export const STATUS_LABELS: Record<MentoringStatus, string> = {
  DRAFT: 'Belum dibuka',
  LIKERT_OPEN: 'Pengisian Likert',
  RUNNING: 'Sesi berjalan',
  WRAPUP: 'Wrap-up',
  CLOSED: 'Selesai',
};
