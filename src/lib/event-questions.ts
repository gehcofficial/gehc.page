export type EventQuestionType =
  | 'SHORT_TEXT'
  | 'TEXT' // alias lawas SHORT_TEXT
  | 'LONG_TEXT'
  | 'BOOLEAN'
  | 'DROPDOWN'
  | 'SELECT' // alias lawas DROPDOWN
  | 'SINGLE'
  | 'MULTI'
  | 'DATE'
  | 'NUMBER';

export const EVENT_QUESTION_TYPES: Array<{ value: EventQuestionType; label: string }> = [
  { value: 'SHORT_TEXT', label: 'Teks pendek' },
  { value: 'LONG_TEXT', label: 'Teks panjang' },
  { value: 'BOOLEAN', label: 'Ya/Tidak' },
  { value: 'DROPDOWN', label: 'Pilihan (dropdown)' },
  { value: 'SINGLE', label: 'Pilihan tunggal (radio)' },
  { value: 'MULTI', label: 'Multi-pilih' },
  { value: 'DATE', label: 'Tanggal' },
  { value: 'NUMBER', label: 'Angka' },
];

/** Samakan alias lawas dengan tipe kanonik untuk renderer. */
export function normEventQuestionType(t: unknown): EventQuestionType {
  const s = String(t || 'SHORT_TEXT').toUpperCase();
  if (s === 'TEXT') return 'SHORT_TEXT';
  if (s === 'SELECT') return 'DROPDOWN';
  return (EVENT_QUESTION_TYPES.some((x) => x.value === s) ? s : 'SHORT_TEXT') as EventQuestionType;
}

export type EventShowIf = {
  key: string;
  equals?: boolean | string | number;
  in?: Array<boolean | string | number>;
};

export type EventQuestion = {
  id: string;
  key: string;
  label: string;
  hint?: string | null;
  type: EventQuestionType;
  options: string[];
  ownerDivision: string;
  ownerSubdivision: string;
  showIf?: EventShowIf | null;
  status?: string;
  sortOrder?: number;
  enabled?: boolean;
  assignmentId?: string;
};

function answerScalar(value: unknown) {
  if (value && typeof value === 'object' && 'value' in (value as object)) {
    return (value as { value: unknown }).value;
  }
  return value;
}

export function isQuestionVisible(
  question: Pick<EventQuestion, 'showIf'>,
  answersByKey: Record<string, unknown>,
): boolean {
  const rule = question.showIf;
  if (!rule?.key) return true;
  const actual = answerScalar(answersByKey[rule.key]);
  if (Object.prototype.hasOwnProperty.call(rule, 'equals')) return actual === rule.equals;
  if (Array.isArray(rule.in)) return rule.in.includes(actual as never);
  return true;
}

export function answersByQuestionKey(
  questions: EventQuestion[],
  answersById: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    if (q.id in answersById) out[q.key] = answersById[q.id];
  }
  return out;
}
