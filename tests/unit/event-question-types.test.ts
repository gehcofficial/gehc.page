import { describe, it, expect } from 'vitest';
import {
  QUESTION_TYPES,
  normQuestionType,
  typeNeedsOptions,
} from '../../server/lib/event-question-bank.mjs';
import { normEventQuestionType } from '../../src/lib/event-questions';

describe('QUESTION_TYPES', () => {
  it('memuat 8 tipe ala Google Form', () => {
    for (const t of ['SHORT_TEXT', 'LONG_TEXT', 'BOOLEAN', 'DROPDOWN', 'SINGLE', 'MULTI', 'DATE', 'NUMBER']) {
      expect(QUESTION_TYPES).toContain(t);
    }
  });

  it('normQuestionType memetakan alias lawas', () => {
    expect(normQuestionType('TEXT')).toBe('SHORT_TEXT');
    expect(normQuestionType('SELECT')).toBe('DROPDOWN');
    expect(normQuestionType('date')).toBe('DATE');
    expect(normQuestionType('NGACO')).toBe('SHORT_TEXT');
  });

  it('typeNeedsOptions hanya untuk tipe pilihan', () => {
    expect(typeNeedsOptions('DROPDOWN')).toBe(true);
    expect(typeNeedsOptions('SINGLE')).toBe(true);
    expect(typeNeedsOptions('MULTI')).toBe(true);
    expect(typeNeedsOptions('SHORT_TEXT')).toBe(false);
    expect(typeNeedsOptions('DATE')).toBe(false);
    expect(typeNeedsOptions('NUMBER')).toBe(false);
  });

  it('normEventQuestionType klien konsisten dengan server', () => {
    expect(normEventQuestionType('TEXT')).toBe('SHORT_TEXT');
    expect(normEventQuestionType('SELECT')).toBe('DROPDOWN');
    expect(normEventQuestionType('NUMBER')).toBe('NUMBER');
  });
});
