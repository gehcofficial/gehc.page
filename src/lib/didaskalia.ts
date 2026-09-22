/**
 * Didaskalia Studio — tipe & util bersama (dipakai UI Studio + generator PDF).
 * Bentuk data selaras dengan server/lib/didaskalia-ai.mjs.
 */

import { HOMILETIC_METHOD_NAMES } from '../data/homiletic-methods';

export const HOMILETIC_METHODS: readonly string[] = HOMILETIC_METHOD_NAMES;

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

/** Lima section baku RHB harian (urutan tetap). */
export const RHB_SECTIONS = [
  { key: 'PENGANTAR', title: 'Pengantar' },
  { key: 'PEMBAHASAN_TEMATIS', title: 'Pembahasan Tematis' },
  { key: 'MAKNA_IMPLIKASI', title: 'Makna dan Implikasi bagi Beyonders' },
  { key: 'REFLEKSI_PRIBADI', title: 'Refleksi Pribadi' },
  { key: 'DISKUSI_KELOMPOK', title: 'Diskusi Kelompok' },
] as const;

export type RhbSectionKey = (typeof RHB_SECTIONS)[number]['key'];

/** Section RHB: teks + gambar opsional (fileId Drive). */
export type DidaskaliaRhbSection = {
  key: RhbSectionKey;
  title: string;
  body: string;
  imageFileId?: string;
};

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
  /** Hero hari (opsional) untuk deck RHB. */
  coverImageFileId?: string;
  /** 5 section RHB harian. */
  rhbSections?: DidaskaliaRhbSection[];
};

/** Gambar presentasi per dokumen: cover + per-path + per-section RHB. */
export type DidaskaliaPresentationImages = {
  cover?: string;
  paths?: Record<string, string>;
  rhb?: Record<string, Record<string, string>>;
};

export type DidaskaliaSlide = { title: string; bullets: string[]; visualNote: string };

/** Analisa komposisi metode khotbah (persen) untuk pembekalan. */
export type DidaskaliaMethodMix = { method: string; percent: number; note?: string };

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
  /** Snapshot konten saat publish (freeze) — dipakai deck presentasi. */
  snapshot?: DidaskaliaPresentationSnapshot | null;
};

/** Snapshot konten yang dibekukan saat publish. */
export type DidaskaliaPresentationSnapshot = {
  doc: 'pembekalan' | 'khutbah' | 'rhb';
  weekIndex: number;
  date: string;
  theme: string;
  chapterNo: string;
  fundamentalFirman: { ref: string; text: string };
  kitabFokus: string;
  methodMix: DidaskaliaMethodMix[];
  paths: DidaskaliaPath[];
  sermon: DidaskaliaSermon;
  images: DidaskaliaPresentationImages;
};

export type DidaskaliaStudio = {
  chapterNo: string;
  fundamentalFirman: { ref: string; text: string };
  kitabFokus: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
  authorId?: string | null;
  reviewerId?: string | null;
  homileticMethods: string[];
  methodMix: DidaskaliaMethodMix[];
  paths: DidaskaliaPath[];
  sermon: DidaskaliaSermon;
  discussion: DidaskaliaComment[];
  rituals: DidaskaliaRitual[];
  presentation?: DidaskaliaPresentationImages;
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

export function defaultRhbSections(): DidaskaliaRhbSection[] {
  return RHB_SECTIONS.map((s) => ({ key: s.key, title: s.title, body: '' }));
}

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
    coverImageFileId: '',
    rhbSections: defaultRhbSections(),
  };
}

/** Normalisasi 5 section RHB: key & urutan tetap, body/gambar dari data tersimpan. */
export function ensureRhbSections(raw: unknown): DidaskaliaRhbSection[] {
  const list = Array.isArray(raw) ? raw : [];
  return RHB_SECTIONS.map((s) => {
    const found = list.find((x) => x && typeof x === 'object' && (x as DidaskaliaRhbSection).key === s.key) as DidaskaliaRhbSection | undefined;
    return {
      key: s.key,
      title: found?.title?.trim() || s.title,
      body: typeof found?.body === 'string' ? found.body : '',
      imageFileId: typeof found?.imageFileId === 'string' ? found.imageFileId : '',
    };
  });
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
    methodMix: [],
    paths: Array.from({ length: 7 }, (_, i) => defaultPath(i)),
    sermon: { methods: [], rationale: '', summary: '', slideOutline: [] },
    discussion: [],
    rituals: [],
    presentation: {},
    render: {},
  };
}

/** Pastikan selalu ada 7 Path dengan field lengkap. */
export function ensurePaths(studio: DidaskaliaStudio): DidaskaliaPath[] {
  const list = Array.isArray(studio.paths) ? studio.paths : [];
  return Array.from({ length: 7 }, (_, i) => {
    const merged = { ...defaultPath(i), ...(list[i] || {}) };
    return { ...merged, rhbSections: ensureRhbSections(merged.rhbSections) };
  });
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
