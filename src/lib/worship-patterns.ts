/**
 * Helper katalog Pola Ibadah (Didaskalia) — dipakai tab Katalog Studio + tests.
 * Template baku playbook: 7 bagian + slot adaptasi {{tema}}/{{firman_ref}}/{{firman_text}}/{{kitab_fokus}}.
 */

/** Jangkar waktu relatif terhadap T0 (jam jemaat mulai). PRA = T-minus (kru, sebelum T0). */
export type PhaseAnchor = 'PRA' | 'ACARA' | 'PASCA';

/** Varian pembuka fase Praise & Worship (total menit tetap). */
export type OpeningVariant = 'DOA' | 'LAGU' | 'KEDUANYA';
/** Varian persembahan + doa: HEMAT = 3 doa sekaligus; PENUH = syafaat & tutup pisah + lagu selingan. */
export type OfferingVariant = 'HEMAT' | 'PENUH';

/** Pilihan varian per pekan (disimpan di studio week, bukan katalog). */
export type WorshipPatternVariant = {
  opening?: OpeningVariant | null;
  offering?: OfferingVariant | null;
};

export const DEFAULT_PATTERN_VARIANT: WorshipPatternVariant = { opening: 'KEDUANYA', offering: 'HEMAT' };

/** Delta menit mode PENUH vs HEMAT pada fase persembahan (kanonis 10' → 16'). */
export const OFFERING_PENUH_DELTA_MIN = 6;

export type WorshipPatternPhase = {
  no?: number | null;
  title?: string | null;
  minutes?: number | null;
  owner?: string | null;
  /** Cakupan divisi: KOINONIA (selain ibadah), LITURGIA (selain firman), DIDASKALIA (elaborasi firman), MARTURIA (dokumentasi), DIAKONIA (perlengkapan & konsumsi). */
  division?: string | null;
  notes?: string | null;
  /** Jangkar waktu (default 'ACARA'). */
  anchor?: PhaseAnchor | null;
  /** Grup paralel: se-grup jalan bareng dalam window anchor main (tak tambah total). */
  parallelGroup?: string | null;
  /** 'parallel' = ikut window grup (tak tambah total); default main. */
  track?: 'main' | 'parallel' | null;
  segments?: Array<{ key?: string; label?: string; kind?: string; songs?: number }> | null;
};

export type WorshipPatternLite = {
  code: string;
  name: string;
  summary?: string | null;
  defaultDurationMin?: number | null;
  modules?: string[] | null;
  phases?: WorshipPatternPhase[] | null;
  playbook?: string | null;
  status?: string | null;
  sortOrder?: number | null;
};

export const PATTERN_TEMPLATE_HEADINGS = [
  '1. Identitas',
  '2. Pra-acara',
  '3. Rundown',
  '4. Naskah',
  '5. Modul web',
  '6. Peran',
  '7. Adaptasi',
] as const;

export const PATTERN_TEMPLATE_SLOTS = ['{{tema}}', '{{firman_ref}}', '{{firman_text}}', '{{kitab_fokus}}'] as const;

/** True bila fase dihitung ke total (trek main). Paralel tak tambah total. */
export function isMainTrack(f?: WorshipPatternPhase | null): boolean {
  return String((f as { track?: unknown })?.track || 'main').toLowerCase() !== 'parallel';
}

/** Sanitasi varian pekan (fallback default bila tak valid). */
export function sanitizePatternVariant(raw?: WorshipPatternVariant | null): WorshipPatternVariant {
  const o = String((raw as { opening?: unknown })?.opening || '').toUpperCase();
  const f = String((raw as { offering?: unknown })?.offering || '').toUpperCase();
  return {
    opening: o === 'DOA' || o === 'LAGU' || o === 'KEDUANYA' ? (o as OpeningVariant) : 'KEDUANYA',
    offering: f === 'HEMAT' || f === 'PENUH' ? (f as OfferingVariant) : 'HEMAT',
  };
}

/** Total menit trek main (paralel tak dihitung ganda). Tanpa field baru = jumlah semua (kompatibel mundur). */
export function patternTotalMinutes(phases?: WorshipPatternPhase[] | null, variant?: WorshipPatternVariant | null): number {
  const list = phases || [];
  const hasNew = list.some((f) => (f as { anchor?: unknown })?.anchor || (f as { parallelGroup?: unknown })?.parallelGroup || !isMainTrack(f));
  // Bila tak ada penanda baru, jumlah semua seperti dulu.
  let total = hasNew
    ? list.reduce((n, f) => n + (isMainTrack(f) ? Number(f?.minutes) || 0 : 0), 0)
    : list.reduce((n, f) => n + (Number(f?.minutes) || 0), 0);
  // Varian persembahan PENUH menambah delta (diambil dari toleransi penutup, bukan potong inti).
  const v = variant ? sanitizePatternVariant(variant) : null;
  if (v?.offering === 'PENUH') total += OFFERING_PENUH_DELTA_MIN;
  return total;
}

/** Total menit jemaat (ACARA + PASCA main) — PRA (kru, T-minus) di luar total baku. */
export function patternCongregationMinutes(phases?: WorshipPatternPhase[] | null, variant?: WorshipPatternVariant | null): number {
  const list = phases || [];
  const hasNew = list.some((f) => (f as { anchor?: unknown })?.anchor);
  if (!hasNew) return patternTotalMinutes(list, variant);
  const mains = list.filter((f) => isMainTrack(f) && String((f as { anchor?: unknown })?.anchor || 'ACARA').toUpperCase() !== 'PRA');
  let total = mains.reduce((n, f) => n + (Number(f?.minutes) || 0), 0);
  const v = variant ? sanitizePatternVariant(variant) : null;
  if (v?.offering === 'PENUH') total += OFFERING_PENUH_DELTA_MIN;
  return total;
}

/** Total menit kru PRA (main) — tampil terpisah sebagai T-minus, tak masuk total baku. */
export function patternPreMinutes(phases?: WorshipPatternPhase[] | null): number {
  const list = phases || [];
  return list
    .filter((f) => isMainTrack(f) && String((f as { anchor?: unknown })?.anchor || '').toUpperCase() === 'PRA')
    .reduce((n, f) => n + (Number(f?.minutes) || 0), 0);
}

export type TimelinePhase = WorshipPatternPhase & { startMin: number; endMin: number };

/**
 * Timeline relatif terhadap T0 (jam jemaat mulai).
 * PRA = negatif (T-minus), ACARA/PASCA = 0 ke atas. Paralel mewarisi window grup main.
 */
export function patternTimeline(phases?: WorshipPatternPhase[] | null): TimelinePhase[] {
  const list = phases || [];
  const mains = list.filter((f) => isMainTrack(f));
  const preTotal = mains
    .filter((f) => String((f as { anchor?: unknown })?.anchor || '').toUpperCase() === 'PRA')
    .reduce((n, f) => n + (Number(f?.minutes) || 0), 0);
  let cursor = -preTotal;
  const mainWindow = new Map<string, { startMin: number; endMin: number; order: number }>();
  const rows: Array<{ phase: WorshipPatternPhase; startMin: number; endMin: number; rank: number; main: boolean }> = [];
  mains.forEach((f, i) => {
    const m = Number(f?.minutes) || 0;
    const startMin = cursor;
    const endMin = cursor + m;
    cursor = endMin;
    const g = String(f.parallelGroup || '').trim();
    if (g && !mainWindow.has(g)) mainWindow.set(g, { startMin, endMin, order: i });
    rows.push({ phase: f, startMin, endMin, rank: i, main: true });
  });
  // Paralel: warisi window grup (fallback: sesudah kursor).
  list.forEach((f) => {
    if (isMainTrack(f)) return;
    const g = String(f.parallelGroup || '').trim();
    const win = (g && mainWindow.get(g)) || null;
    const m = Number(f?.minutes) || 0;
    const startMin = win ? win.startMin : cursor;
    let endMin = win ? win.endMin : cursor + m;
    // Bila menit paralel lebih kecil dari window, rata kiri di dalam window.
    if (win && m > 0 && m < win.endMin - win.startMin) endMin = startMin + m;
    rows.push({ phase: f, startMin, endMin, rank: win ? win.order + 0.5 : 999, main: false });
  });
  // Urut: main sesuai urutan, paralel tepat setelah grup main-nya.
  return rows
    .sort((a, b) => (a.rank - b.rank) || (Number(!a.main) - Number(!b.main)))
    .map((r) => ({ ...r.phase, startMin: r.startMin, endMin: r.endMin }));
}

/** Cek grup paralel: wajib punya 1 main anchor; paralel tak boleh melebihi window. Warning saja (bukan 400). */
export function patternParallelCheck(phases?: WorshipPatternPhase[] | null): string[] {
  const list = phases || [];
  const warnings: string[] = [];
  const groups = new Map<string, { main?: WorshipPatternPhase; parallels: WorshipPatternPhase[] }>();
  for (const f of list) {
    const g = String(f.parallelGroup || '').trim();
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, { parallels: [] });
    const e = groups.get(g)!;
    if (isMainTrack(f)) {
      if (e.main) warnings.push(`Grup paralel "${g}" punya >1 main — hanya window main pertama dipakai.`);
      else e.main = f;
    } else e.parallels.push(f);
  }
  for (const [g, e] of groups) {
    if (!e.main) warnings.push(`Grup paralel "${g}" tanpa main anchor — tampil mengikuti posisi grup.`);
    if (e.main) {
      const win = Number(e.main.minutes) || 0;
      for (const p of e.parallels) {
        if ((Number(p.minutes) || 0) > win) warnings.push(`Paralel "${p.title || g}" (${p.minutes}') melebihi window "${e.main.title || g}" (${win}').`);
      }
    }
  }
  return warnings;
}

/** Format satu titik relatif: T-15, T0, T+20. */
export function formatRel(min: number): string {
  if (min === 0) return 'T0';
  return min < 0 ? `T${min}` : `T+${min}`;
}

/** Format rentang relatif: T-15–T0 · 15'. */
export function formatRangeRel(startMin: number, endMin: number): string {
  const mins = endMin - startMin;
  return `${formatRel(startMin)}–${formatRel(endMin)} · ${mins}'`;
}

function fmtClockWib(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
  } catch {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

/**
 * Format rentang absolut dari T0 (eventDate). Bila t0 kosong/tak valid → fallback relatif.
 * Cth: formatRangeAbs(-15, 0, '2026-10-12T13:00:00+07:00') = '12:45–13:00'.
 */
export function formatRangeAbs(startMin: number, endMin: number, t0?: string | Date | null): string | null {
  if (!t0) return null;
  const base = new Date(t0).getTime();
  if (Number.isNaN(base)) return null;
  return `${fmtClockWib(base + startMin * 60000)}–${fmtClockWib(base + endMin * 60000)}`;
}

/** Cek kelengkapan template playbook: 7 heading + 4 slot adaptasi. */
export function patternTemplateCheck(pattern?: WorshipPatternLite | null): {
  headingsPresent: string[];
  headingsMissing: string[];
  slotsPresent: string[];
  slotsMissing: string[];
  complete: boolean;
} {
  const text = String(pattern?.playbook || '');
  const headingsPresent = PATTERN_TEMPLATE_HEADINGS.filter((h) => text.includes(h));
  const headingsMissing = PATTERN_TEMPLATE_HEADINGS.filter((h) => !text.includes(h));
  const slotsPresent = PATTERN_TEMPLATE_SLOTS.filter((s) => text.includes(s));
  const slotsMissing = PATTERN_TEMPLATE_SLOTS.filter((s) => !text.includes(s));
  return {
    headingsPresent,
    headingsMissing,
    slotsPresent,
    slotsMissing,
    complete: headingsMissing.length === 0 && slotsMissing.length === 0,
  };
}

/** Selisih durasi phases vs defaultDurationMin (0 = pas). */
export function patternDurationDelta(pattern?: WorshipPatternLite | null): number | null {
  if (!pattern?.defaultDurationMin) return null;
  return patternTotalMinutes(pattern.phases) - Number(pattern.defaultDurationMin);
}

export const MODULE_LABELS: Record<string, string> = {
  likert: 'Likert',
  rooms: 'Ruang',
  timer: 'Timer',
  notes: 'Catatan',
  chips: 'Chip',
  wordcloud: 'Word cloud',
  rounds: 'Ronde',
  screening: 'Pemutaran',
  teams: 'Tim',
  fgd: 'Panduan FGD',
  testimony: 'Undian kesaksian',
  activity: 'Aktivitas & timer',
};

export function moduleLabel(code: string): string {
  return MODULE_LABELS[code] || code;
}

export const DIVISION_LABELS: Record<string, string> = {
  KOINONIA: 'Koinonia',
  LITURGIA: 'Liturgia',
  DIDASKALIA: 'Didaskalia',
  MARTURIA: 'Marturia',
  DIAKONIA: 'Diakonia',
};

export const OPENING_LABELS: Record<OpeningVariant, string> = {
  DOA: 'Doa buka saja',
  LAGU: 'Nyanyian buka saja',
  KEDUANYA: 'Doa + nyanyian buka',
};

export const OFFERING_LABELS: Record<OfferingVariant, string> = {
  HEMAT: 'Gabung (3 doa sekaligus)',
  PENUH: 'Pisah + lagu selingan',
};

/** Kalimat varian untuk prompt AI / deck: pembuka + persembahan pekan ini. */
export function patternVariantText(variant?: WorshipPatternVariant | null): string {
  const v = sanitizePatternVariant(variant);
  const open =
    v.opening === 'DOA'
      ? 'Pembuka: doa buka 3 menit + praise/worship (tanpa lagu buka).'
      : v.opening === 'LAGU'
        ? 'Pembuka: 1 lagu buka + praise/worship (tanpa doa buka panjang; kurangi 1 praise bila perlu).'
        : 'Pembuka: doa buka 2 menit + 1 lagu buka + praise/worship dalam 15 menit (kurangi 1 praise bila perlu).';
  const offer =
    v.offering === 'PENUH'
      ? `Persembahan mode PENUH (+${OFFERING_PENUH_DELTA_MIN} menit): kantong jalan + lagu 1 → doa syafaat → lagu selingan → doa tutup + berkat (syafaat & tutup pisah, tiap doa diucapkan eksplisit).`
      : 'Persembahan mode HEMAT: kantong jalan; doa persembahan + syafaat + tutup sekaligus.';
  return `${open} ${offer}`;
}

export function divisionLabel(code?: string | null): string {
  const c = String(code || '').toUpperCase();
  return DIVISION_LABELS[c] || c;
}

/** Slot adaptasi playbook → kata readable (DB tetap menyimpan mentah {{...}}). */
const PLAYBOOK_SLOT_WORDS: Record<string, string> = {
  '{{tema}}': 'tema pekan',
  '{{firman_ref}}': 'Firman pekan',
  '{{firman_text}}': 'nas Firman',
  '{{kitab_fokus}}': 'kitab fokus',
};

/** Naskah playbook siap tampil: tanpa simbol mentah {{...}} (bold/list ditangani renderer md). */
export function prettyPlaybook(text?: string | null): string {
  let out = String(text || '');
  for (const [slot, words] of Object.entries(PLAYBOOK_SLOT_WORDS)) {
    out = out.split(slot).join(words);
  }
  return out;
}
