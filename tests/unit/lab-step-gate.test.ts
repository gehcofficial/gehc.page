import { describe, expect, it } from 'vitest';
import {
  canEnableLabRunnerKey,
  defaultLabCompleted,
  mergeValidateAndStampLabActivity,
  validateLabActivityTransition,
} from '../../server/lib/lab-step-gate.mjs';
import { defaultCreativeLabActivity } from '../../server/lib/session-stage.mjs';

describe('lab-step-gate', () => {
  it('runner keys mengikuti urutan ketat', () => {
    const pre = defaultCreativeLabActivity();
    expect(canEnableLabRunnerKey('BRIEFING', pre)).toBe(true);
    expect(canEnableLabRunnerKey('DRAW', pre)).toBe(false);
    expect(canEnableLabRunnerKey('A1', pre)).toBe(false);

    const briefing = {
      ...pre,
      phase: 'BRIEFING',
      startedAt: '2026-10-25T10:00:00.000Z',
      completed: { ...defaultLabCompleted(), BRIEFING_AT: '2026-10-25T10:00:00.000Z' },
    };
    expect(canEnableLabRunnerKey('DRAW', briefing)).toBe(true);
    expect(canEnableLabRunnerKey('A1', briefing)).toBe(false);

    const drawn = {
      ...briefing,
      phase: 'DRAW',
      presentDrawnAt: '2026-10-25T10:05:00.000Z',
      completed: { ...briefing.completed, DRAW_AT: '2026-10-25T10:05:00.000Z' },
    };
    expect(canEnableLabRunnerKey('A1', drawn)).toBe(true);
  });

  it('menolak lompati langkah (409 message)', () => {
    const pre = defaultCreativeLabActivity();
    const skip = { ...pre, phase: 'A1', startedAt: '2026-10-25T10:00:00.000Z' };
    expect(validateLabActivityTransition(pre, skip)).toMatch(/tidak boleh dilewati/i);
  });

  it('mergeValidate men-stamp completed saat maju', () => {
    const pre = defaultCreativeLabActivity();
    const next = {
      ...pre,
      phase: 'BRIEFING',
      startedAt: '2026-10-25T10:00:00.000Z',
    };
    const out = mergeValidateAndStampLabActivity(pre, next);
    expect(out.error).toBeUndefined();
    expect(out.activity?.completed?.BRIEFING_AT).toBeTruthy();
  });
});
