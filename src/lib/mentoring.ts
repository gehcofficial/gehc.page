export type MentoringView = 'peserta' | 'layar' | 'kontrol';

export type MentoringRoute = { slug: string; view: MentoringView };

export type MentoringStatus = 'DRAFT' | 'LIKERT_OPEN' | 'RUNNING' | 'WRAPUP' | 'CLOSED';

export type MentoringTopic = { code: string; label: string; pic?: string | null };

export type MentoringRoom = {
  code: string;
  label: string;
  floor: number;
  floorLabel: string;
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
  myResult: MentoringMyResult | null;
  rooms: MentoringRoom[];
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

export const STATUS_LABELS: Record<MentoringStatus, string> = {
  DRAFT: 'Belum dibuka',
  LIKERT_OPEN: 'Pengisian Likert',
  RUNNING: 'Sesi berjalan',
  WRAPUP: 'Wrap-up',
  CLOSED: 'Selesai',
};
