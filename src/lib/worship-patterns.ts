/**
 * Helper katalog Pola Ibadah (Didaskalia) — dipakai tab Katalog Studio + tests.
 * Template baku playbook: 7 bagian + slot adaptasi {{tema}}/{{firman_ref}}/{{firman_text}}/{{kitab_fokus}}.
 */

export type WorshipPatternPhase = {
  no?: number;
  title?: string;
  minutes?: number;
  owner?: string;
  notes?: string;
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

/** Total menit dari phases (abaikan fase tanpa menit). */
export function patternTotalMinutes(phases?: WorshipPatternPhase[] | null): number {
  return (phases || []).reduce((n, f) => n + (Number(f?.minutes) || 0), 0);
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
};

export function moduleLabel(code: string): string {
  return MODULE_LABELS[code] || code;
}
