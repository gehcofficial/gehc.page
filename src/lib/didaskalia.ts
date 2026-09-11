/**
 * Didaskalia Studio — tipe & util bersama (dipakai UI Studio + generator PDF).
 * Bentuk data selaras dengan server/lib/didaskalia-ai.mjs.
 */

export const HOMILETIC_METHODS = [
  'Ekspositori',
  'Tematik/Sistematik',
  'Naratif',
  'Historis-Redemptif',
  'Analisis Kata',
  'Komparatif/Kontras',
  'Problem-Solution',
  'Induktif',
] as const;

export const RITUAL_TYPES = ['INTERNAL_SYNC', 'SERVING_BRIEFING', 'GENERAL_EQUIPPING'] as const;
export type RitualType = (typeof RITUAL_TYPES)[number];

export const RITUAL_LABELS: Record<RitualType, string> = {
  INTERNAL_SYNC: 'Internal Sync',
  SERVING_BRIEFING: 'Serving Group Briefing',
  GENERAL_EQUIPPING: 'General Equipping',
};

export const RITUAL_REF_BY_TYPE: Record<RitualType, string> = {
  INTERNAL_SYNC: 'SYNC',
  SERVING_BRIEFING: 'SERVING',
  GENERAL_EQUIPPING: 'EQUIP',
};

export const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export type DidaskaliaPath = {
  pathIndex: number;
  dayLabel: string;
  title: string;
  scriptureRef: string;
  scriptureText: string;
  homileticLens: string[];
  hookQuestion: string;
  illustration: string;
  reflection: string;
  observeQ: string;
  interpretQ: string;
  applyQ: string;
  fgdQuestions: string[];
  bridge: string;
  imageStem: string;
};

export type DidaskaliaSlide = { title: string; bullets: string[]; visualNote: string };

export type DidaskaliaSermon = {
  methods: string[];
  rationale: string;
  summary: string;
  slideOutline: DidaskaliaSlide[];
};

export type DidaskaliaComment = {
  id: string;
  userId?: string | null;
  userName?: string | null;
  role?: string | null;
  text: string;
  at: string;
  resolved?: boolean;
};

export type DidaskaliaRitual = {
  type: RitualType;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: string;
  notes?: string;
  meetUrl?: string;
};

export type DidaskaliaRenderFile = { name: string; driveFileId: string; pathIndex?: number };
export type DidaskaliaRenderMeta = {
  version: number;
  renderedAt: string;
  driveFolder?: string | null;
  files: DidaskaliaRenderFile[];
  contentHash?: string | null;
};

export type DidaskaliaStudio = {
  chapterNo: string;
  fundamentalFirman: { ref: string; text: string };
  kitabFokus: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  authorId?: string | null;
  reviewerId?: string | null;
  homileticMethods: string[];
  paths: DidaskaliaPath[];
  sermon: DidaskaliaSermon;
  discussion: DidaskaliaComment[];
  rituals: DidaskaliaRitual[];
  render: Partial<Record<'pembekalan' | 'khutbah' | 'rhb', DidaskaliaRenderMeta>>;
};

export type DidaskaliaWeek = {
  index: number;
  date: string;
  theme?: string;
  mentoringTheme?: string;
  servingTheme?: string;
  studio: DidaskaliaStudio;
};

export function defaultPath(i: number): DidaskaliaPath {
  return {
    pathIndex: i + 1,
    dayLabel: DAY_LABELS[i] || `Hari ${i + 1}`,
    title: `Path ${i + 1}`,
    scriptureRef: '',
    scriptureText: '',
    homileticLens: [],
    hookQuestion: '',
    illustration: '',
    reflection: '',
    observeQ: '',
    interpretQ: '',
    applyQ: '',
    fgdQuestions: [],
    bridge: '',
    imageStem: '',
  };
}

export function defaultStudio(): DidaskaliaStudio {
  return {
    chapterNo: '',
    fundamentalFirman: { ref: '', text: '' },
    kitabFokus: '',
    status: 'DRAFT',
    authorId: null,
    reviewerId: null,
    homileticMethods: [],
    paths: Array.from({ length: 7 }, (_, i) => defaultPath(i)),
    sermon: { methods: [], rationale: '', summary: '', slideOutline: [] },
    discussion: [],
    rituals: [],
    render: {},
  };
}

/** Pastikan selalu ada 7 Path dengan field lengkap. */
export function ensurePaths(studio: DidaskaliaStudio): DidaskaliaPath[] {
  const list = Array.isArray(studio.paths) ? studio.paths : [];
  return Array.from({ length: 7 }, (_, i) => ({ ...defaultPath(i), ...(list[i] || {}) }));
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draf',
    REVIEW: 'Review',
    APPROVED: 'Disetujui',
    PUBLISHED: 'Rilis',
  };
  return map[status] || status;
}

/** Hash ringan (sinkron) untuk deteksi perubahan konten vs yang sudah dirilis. */
export function hashContent(obj: unknown): string {
  const str = JSON.stringify(obj ?? null);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (((h2 >>> 0) * 4294967296 + (h1 >>> 0)) >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

export function needsRepublish(studio: DidaskaliaStudio, doc: 'pembekalan' | 'khutbah' | 'rhb'): boolean {
  const meta = studio.render?.[doc];
  if (!meta) return true;
  const payload =
    doc === 'khutbah'
      ? { fundamentalFirman: studio.fundamentalFirman, kitabFokus: studio.kitabFokus, sermon: studio.sermon }
      : { chapterNo: studio.chapterNo, fundamentalFirman: studio.fundamentalFirman, kitabFokus: studio.kitabFokus, paths: studio.paths };
  return hashContent(payload) !== meta.contentHash;
}
