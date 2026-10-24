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

export type TestimonyPick = {
  userId: string;
  name: string;
  role: string;
  groupName?: string | null;
  slot: number;
  at?: string;
};

export type JurySide = { biblika: number; logika: number; teamwork: number; etika: number };

export type SessionJury = { name: string; pro: JurySide; kontra: JurySide };

export type SessionRound = {
  mosi: string;
  pro: string;
  kontra: string;
  proScore: number;
  kontraScore: number;
  /** Lembar juri berbobot per ronde (4 kriteria × PRO/KONTRA). */
  jury?: SessionJury[];
};

export type DebatTeam = { name: string; mentor: string; members: string[] };

export type SessionRounds = {
  rounds: SessionRound[];
  current: number;
  phase: string;
  /** Langkah aktif 1 ronde (0-10) + timer langkah (display-only). */
  step?: number;
  stepStartedAt?: string | null;
  stepSeconds?: number;
  stepShowOnScreen?: boolean;
  /** Kartu tim PRO/KONTRA (delegasi 3 orang). */
  teams?: { pro: DebatTeam; kontra: DebatTeam };
  /** Naskah Trap Reveal (konklusi membongkar dikotomi palsu). */
  trapReveal?: string;
} | null;

export type SessionScreening = { title: string; durationMin: number; startedAt: string | null; preShow: string[] } | null;

export type SessionTeam = {
  name: string;
  task: string;
  members: string[];
  done: boolean;
  /** Creative Lab: meja/stasiun, sub-tim paralel Pot & Tas. */
  scribe?: string;
  station?: string;
  pot?: string[];
  bag?: string[];
  /** Creative Lab: perwakilan & anggota terhubung akun (untuk feed group). */
  repUserId?: string;
  repName?: string;
  memberUserIds?: string[];
  /** Id kelompok Beyonders. Kosong bila baris peringatan (belum ada di database). */
  groupId?: string;
  missing?: boolean;
  /** Mission Sequence: dua kelompok yang digabung jadi satu tim. */
  pair?: string[];
  /** Peran di dalam tim gabungan (bukan tim terpisah). */
  roles?: string;
};

/** Satu update karya/foto Creative Lab (hanya group sendiri untuk peserta). */
export type SessionLabUpdate = {
  id: string;
  teamIndex: number;
  teamName: string;
  userId: string;
  userName: string;
  kind: 'POT' | 'BAG' | 'COMMIT' | 'GROUP' | 'NOTE' | string;
  body: string;
  progress: number | null;
  photoUrl: string | null;
  thumbUrl: string | null;
  acknowledgedAt?: string | null;
  createdAt: string | null;
};

export type SessionLabTeamSummary = {
  index: number;
  name: string;
  repName: string;
  repUserId: string;
  memberCount: number;
  done: boolean;
  pot: { meaning: string; progress: number | null; photos: SessionLabUpdate[] };
  bag: { meaning: string; progress: number | null; photos: SessionLabUpdate[] };
  commitment: string;
  groupPhoto: SessionLabUpdate | null;
  photoCount: number;
  photoComplete: boolean;
  progressPct?: number | null;
  voteBackStatus?: string;
  recapStatus?: string;
  lastUpdateAt: string | null;
  updateCount: number;
};

export type SessionLabSummary = {
  teams: SessionLabTeamSummary[];
  presentOrder: number[];
  keyDirections?: string;
  updates?: SessionLabUpdate[];
} | null;

export type SessionLabReactions = {
  open: boolean;
  presentingTeamIndex: number | null;
  myVote: string | null;
  released: boolean;
  counts: { code: string; label: string; count: number }[] | null;
};

/** POV peserta: hanya group sendiri. */
export type SessionLabMine = {
  teamIndex: number | null;
  teamName: string | null;
  isRep: boolean;
  repName: string;
  members: string[];
  done: boolean;
  phase: string;
  updates: SessionLabUpdate[];
  reactions?: SessionLabReactions;
  /** Pengurus sesi boleh mengerjakan kelompok mana pun tanpa jadi anggota. */
  asAdmin?: boolean;
  teamChoices?: { index: number; name: string }[];
} | null;

export type SessionTeams = { teams: SessionTeam[] } | null;

export type SessionSong = {
  title: string;
  about: string;
  singer: string;
  bookRef?: string;
  writer?: string;
  story?: string;
  songId?: string;
} | null;

export type SessionFgdState = { currentQ: number; triggerBy: string | null; triggerName: string | null } | null;

/** Timer fase aktif (MONOLOG F1/F2/F3/CLOSING + film M0 = jendela Likert AWAL 5'). Display-only; transisi manual. */
export type SessionPhase = { name: 'F1' | 'F2' | 'F3' | 'CLOSING' | 'M0'; startedAt: string; durationSec: number; showOnScreen?: boolean } | null;

/** Preferensi tiap fase (durasi + tampil di layar proyektor; diatur kontrol). */
export type PhasePrefs = Partial<Record<'F1' | 'F2' | 'F3' | 'CLOSING', { durationSec: number; showOnScreen: boolean }>>;

/** State panggung Creative Lab (fase aktivitas + timer + kartu jar + presentasi). */
export type SessionActivity = {
  phase: 'PRE' | 'START' | 'BRIEFING' | 'DRAW' | 'IDLE' | 'A1' | 'A2' | 'PRESENT' | 'DONE';
  startedAt: string | null;
  durationSec: number;
  showOnScreen: boolean;
  cardIndex: number;
  presentIndex: number;
  /** 0 = Pot, 1 = Bag, 2 = Commitment. Kosong pada sesi lama berarti slide Pot. */
  presentSlide?: number;
  presentStartedAt: string | null;
  presentSeconds: number;
  /** Urutan presentasi hasil undian (index tim). */
  presentOrder?: number[];
  presentSkipped?: number[];
  presentPostponed?: number[];
  presentDrawnAt?: string | null;
  durations?: { A1: number; A2: number; PRESENT: number };
  completed?: {
    START_AT?: string | null;
    BRIEFING_AT?: string | null;
    DRAW_AT?: string | null;
    A1_AT?: string | null;
    A2_AT?: string | null;
    PRESENT_AT?: string | null;
    DONE_AT?: string | null;
  };
} | null;

/** Ringkasan naskah Creative Lab dari draft sesi (layar & HP peserta). */
export type SessionActivityBrief = {
  firmanTitle?: string;
  firmanPoints?: string;
  teksUtamaRef?: string;
  teksUtamaText?: string;
  briefing: {
    core: string; rules: string; jarIntro: string; scribe: string; draw: string;
    audienceDirective?: string; projectorDirective?: string;
  };
  a1: { title: string; subtitle: string; goal: string; tools: string; steps: string; output: string; minutes: number };
  a2: {
    title: string; goal: string; tools: string;
    stationA: { media: string; theme: string };
    stationB: { media: string; theme: string };
    pot: string; bag: string;
    potMeaning: string; bagMeaning: string;
    report: string; commit: string; minutes: number;
  };
  present: { order: string; questions: string; seconds: number };
  closing: { script: string; commit: string; prayer: string };
  activities?: Array<{
    index: number; title: string; minutes: number;
    konteks?: string; pertanyaan?: string; contoh?: string;
    stationMedia?: string; stationTheme?: string;
    stationBMedia?: string; stationBTheme?: string;
  }>;
  activityCount?: number;
} | null;

/** Sepuluh kelompok Beyonders. Duplikat daftar server agar UI tidak mengimpor `.mjs`. */
export const BEYONDERS_GROUPS = [
  'Agape', 'Avodah', 'Dunamis', 'Echad', 'Hesed', 'Kairos', 'Logos', 'Metanoia', 'Ruach', 'Shalom',
] as const;

export const MISSION_TEAM_CAP = 5;
export const MISSION_INTERNAL_ROLES = 'Soal · Lapangan · Narasi · Presentasi · Editor (peran di dalam tim, bukan tim terpisah)';

/** Lima tim gabungan default: kelompok 1+2, 3+4, … Nama memakai '&'. */
export function defaultJointTeams(groupNames: readonly string[] = BEYONDERS_GROUPS) {
  const names = groupNames.map((n) => String(n || '').trim()).filter(Boolean);
  return Array.from({ length: MISSION_TEAM_CAP }, (_, i) => {
    const a = names[i * 2] || `Kelompok ${i * 2 + 1}`;
    const b = names[i * 2 + 1] || `Kelompok ${i * 2 + 2}`;
    return {
      name: `${a} & ${b}`,
      task: 'Menjalankan seluruh misi bersama.',
      members: [] as string[],
      done: false,
      pair: [a, b],
      roles: MISSION_INTERNAL_ROLES,
    };
  });
}

export function labStationCopy(brief?: SessionActivityBrief) {
  const a = brief?.a2?.stationA;
  const b = brief?.a2?.stationB;
  return {
    mediaA: a?.media || 'Pot',
    themeA: a?.theme || 'Grow What You Believe',
    mediaB: b?.media || 'Bag',
    themeB: b?.theme || 'Carry the Gospel',
  };
}

export type SessionJarCard = { key: string; code: string; title: string; direction: string };

export type OneWordCount = { text: string; count: number };

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
    /** Gate 2 ronde film (AWAL/AKHIR); pola lain abaikan. */
    rounds?: { pre: string; post: string } | null;
    /** Rata-rata per itemId (untuk delta pre→post film). */
    means?: Record<string, { avg: number; n: number }>;
  };
  chips: { list: { code: string; label: string; topicCode?: string | null }[]; mine: string[]; open: boolean };
  me: { id: string; name: string };
  notes: Record<string, string>;
  /** Panduan FGD / pertanyaan pola (dari draft sesi). */
  guide: string[];
  /** 2 pertanyaan deep sharing (MONOLOG gabungan). */
  deepGuide?: string[];
  /** Lagu bedah pekan ini (MONOLOG gabungan). */
  song?: SessionSong;
  /** Status trigger Q mentor (MONOLOG gabungan). */
  fgd?: SessionFgdState;
  /** Afirmasi firman BEDAH_FILM (dari draft sesi; tampil setelah menjawab). */
  affirmations?: { notes: Record<string, string>; likertLow: string; likertHigh: string } | null;
  /** Fase aktif + countdown (MONOLOG gabungan). */
  phase?: SessionPhase;
  /** Preferensi tiap fase (diatur kontrol; default durasi baku + tampil). */
  phasePrefs?: PhasePrefs | null;
  testimony: TestimonyPick[];
  rounds?: SessionRounds;
  screening?: SessionScreening;
  teams?: SessionTeams;
  /** Creative Lab: panggung aktivitas, brief & 6 kartu jar. */
  activity?: SessionActivity;
  activityBrief?: SessionActivityBrief;
  jarCards?: SessionJarCard[];
  /** Creative Lab: update group sendiri (perwakilan/anggota). */
  lab?: SessionLabMine;
  myResult: MentoringMyResult | null;
  rooms: MentoringRoom[];
  progress: { submitted: number; total: number };
  resetAt?: string | null;
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
  guide: string[];
  deepGuide?: string[];
  song?: SessionSong;
  fgd?: SessionFgdState;
  phase?: SessionPhase;
  phasePrefs?: PhasePrefs | null;
  testimony: TestimonyPick[];
  oneWord?: OneWordCount[];
  rounds?: SessionRounds;
  screening?: SessionScreening;
  /** Gate 2 ronde Likert film (AWAL/AKHIR) — label step M3 di layar. */
  likertRounds?: { pre: string; post: string } | null;
  teams?: SessionTeams;
  /** Creative Lab: panggung aktivitas, brief & 6 kartu jar. */
  activity?: SessionActivity;
  activityBrief?: SessionActivityBrief;
  jarCards?: SessionJarCard[];
  /** Creative Lab: ringkasan semua group + foto untuk layar. */
  lab?: SessionLabSummary;
  /** Agregat ronde film (delta pre→post di layar). */
  likertMeans?: { pre: { avg: number | null; n: number }; post: { avg: number | null; n: number }; delta: number | null } | null;
  wrapUpAt: string | null;
  /** Marker reset draf — klien kosongkan cache lokal bila berubah. */
  resetAt?: string | null;
};

export function isMentoringHash(hash: string): boolean {
  const h = String(hash || '');
  return h === '#/mentoring' || h.startsWith('#/mentoring/') || h.startsWith('#/mentoring?');
}

function decodeHashSeg(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseMentoringHash(hash: string): MentoringRoute | null {
  const raw = String(hash || '')
    .replace(/^#\/?/, '')
    .split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  if (seg[0] !== 'mentoring') return null;
  const tail = String(seg[2] || '').toLowerCase();
  const view: MentoringView = tail === 'layar' ? 'layar' : tail === 'kontrol' ? 'kontrol' : 'peserta';
  return { slug: decodeHashSeg(seg[1] || ''), view };
}

export function mentoringCodeKey(slug: string): string {
  return `gehc_mentoring_code_${slug}`;
}

/** Kode proyektor dari query di dalam hash (`#/mentoring/<slug>/layar?code=`). */
export function codeFromMentoringHash(hash: string): string {
  const q = String(hash || '').split('?')[1] || '';
  const code = new URLSearchParams(q).get('code') || '';
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export const LAB_PRESENT_SLIDES = ['Pot', 'Bag', 'Commitment'] as const;

/** Kuota foto Creative Lab. Sama dengan server `LAB_PHOTO_LIMIT`. */
export const LAB_PHOTO_CAP = { POT: 2, BAG: 2, GROUP: 1 } as const;

/** Centang pelukis di kartu kelompok — ditampilkan sama dengan kuota foto stasiun. */
export const LAB_STATION_CAP = LAB_PHOTO_CAP.POT;

/**
 * Berikutnya/Sebelumnya di kontrol presentasi.
 * Slide 0→1→2, lalu kelompok berikutnya di presentOrder. Setelah slide terakhir
 * kelompok terakhir, fase menjadi DONE. Sesi tanpa presentSlide dianggap slide 0.
 */
export function stepLabPresentation(
  activity: { presentIndex?: number; presentSlide?: number },
  orderLength: number,
  direction: 1 | -1,
  slideMax = 2,
): { phase: 'PRESENT' | 'DONE'; presentIndex: number; presentSlide: number } {
  const maxSlide = Math.max(0, Math.floor(Number(slideMax) || 0));
  const count = Math.max(0, Math.floor(Number(orderLength) || 0));
  const last = Math.max(0, count - 1);
  let index = Math.floor(Number(activity?.presentIndex) || 0);
  if (!Number.isInteger(index) || index < 0) index = 0;
  if (index > last) index = last;
  let slide = Math.floor(Number(activity?.presentSlide) || 0);
  if (!Number.isInteger(slide) || slide < 0) slide = 0;
  if (slide > maxSlide) slide = maxSlide;
  if (direction > 0) {
    if (slide < maxSlide) return { phase: 'PRESENT', presentIndex: index, presentSlide: slide + 1 };
    if (count === 0 || index >= last) return { phase: 'DONE', presentIndex: index, presentSlide: maxSlide };
    return { phase: 'PRESENT', presentIndex: index + 1, presentSlide: 0 };
  }
  if (slide > 0) return { phase: 'PRESENT', presentIndex: index, presentSlide: slide - 1 };
  if (index <= 0) return { phase: 'PRESENT', presentIndex: 0, presentSlide: 0 };
  return { phase: 'PRESENT', presentIndex: index - 1, presentSlide: maxSlide };
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
