import { describe, expect, it } from 'vitest';
import {
  canEnableLabRunnerKey,
  defaultLabCompleted,
  labAudienceShowsPresentOrder,
  mergeValidateAndStampLabActivity,
  validateLabActivityTransition,
} from '../../server/lib/lab-step-gate.mjs';
import { defaultCreativeLabActivity } from '../../server/lib/session-stage.mjs';

describe('lab-step-gate', () => {
  it('runner keys mengikuti urutan Start → Briefing → Sesi', () => {
    const pre = defaultCreativeLabActivity();
    expect(canEnableLabRunnerKey('START', pre)).toBe(true);
    expect(canEnableLabRunnerKey('BRIEFING', pre)).toBe(false);

    const started = {
      ...pre,
      phase: 'START',
      startedAt: '2026-10-25T10:00:00.000Z',
      completed: { ...defaultLabCompleted(), START_AT: '2026-10-25T10:00:00.000Z' },
    };
    expect(canEnableLabRunnerKey('BRIEFING', started)).toBe(true);
    expect(canEnableLabRunnerKey('A1', started)).toBe(false);

    const briefing = {
      ...started,
      phase: 'BRIEFING',
      completed: { ...started.completed, BRIEFING_AT: '2026-10-25T10:10:00.000Z' },
    };
    expect(canEnableLabRunnerKey('A1', briefing)).toBe(false);

    const drawn = {
      ...briefing,
      presentDrawnAt: '2026-10-25T10:12:00.000Z',
      completed: { ...briefing.completed, DRAW_AT: '2026-10-25T10:12:00.000Z' },
    };
    expect(canEnableLabRunnerKey('A1', drawn)).toBe(true);
  });

  it('menolak lompati langkah (409 message)', () => {
    const pre = defaultCreativeLabActivity();
    const skip = { ...pre, phase: 'A1', startedAt: '2026-10-25T10:00:00.000Z' };
    expect(validateLabActivityTransition(pre, skip)).toMatch(/tidak boleh dilewati/i);
  });

  it('mergeValidate men-stamp START_AT saat Start Sesi', () => {
    const pre = defaultCreativeLabActivity();
    const next = {
      ...pre,
      phase: 'START',
      startedAt: '2026-10-25T10:00:00.000Z',
    };
    const out = mergeValidateAndStampLabActivity(pre, next);
    expect(out.error).toBeUndefined();
    expect(out.activity?.completed?.START_AT).toBeTruthy();
  });

  it('DONE hanya dari PRESENT dengan presentComplete', () => {
    const present = {
      ...defaultCreativeLabActivity(),
      phase: 'PRESENT',
      completed: { ...defaultLabCompleted(), PRESENT_AT: '2026-10-25T12:00:00.000Z' },
    };
    expect(validateLabActivityTransition(present, { ...present, phase: 'DONE' })).toMatch(/selesai/i);
    expect(validateLabActivityTransition(present, { ...present, phase: 'DONE', presentComplete: true })).toBeNull();
  });

  it('CHIPS terbuka setelah presentComplete, dan self-heal saat DONE tanpa DONE_AT', () => {
    const presentDone = {
      ...defaultCreativeLabActivity(),
      phase: 'PRESENT',
      presentComplete: true,
      completed: {
        ...defaultLabCompleted(),
        PRESENT_AT: '2026-10-25T12:00:00.000Z',
      },
    };
    expect(canEnableLabRunnerKey('CHIPS', presentDone)).toBe(true);

    const stuckDone = {
      ...presentDone,
      phase: 'DONE',
      completed: { ...presentDone.completed, DONE_AT: '2026-10-25T12:30:00.000Z' },
    };
    expect(canEnableLabRunnerKey('CHIPS', stuckDone)).toBe(true);
    expect(canEnableLabRunnerKey('CHIPS', { ...presentDone, presentComplete: false })).toBe(false);
  });

  it('urutan presentasi hanya menit pertama fase PRESENT', () => {
    const t0 = '2026-10-25T12:00:00.000Z';
    expect(labAudienceShowsPresentOrder('PRESENT', t0, Date.parse(t0) + 30_000)).toBe(true);
    expect(labAudienceShowsPresentOrder('PRESENT', t0, Date.parse(t0) + 90_000)).toBe(false);
    expect(labAudienceShowsPresentOrder('BRIEFING', t0, Date.parse(t0))).toBe(false);
  });
});
