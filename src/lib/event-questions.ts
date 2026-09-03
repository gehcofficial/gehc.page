export type EventQuestionType = 'TEXT' | 'BOOLEAN' | 'SELECT' | 'MULTI';

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
