import { describe, it, expect } from 'vitest';
import {
  JURY_CRITERIA,
  JURY_WEIGHTS,
  ROUND_STEPS,
  ROUND_STEP_SECONDS,
  cleanRounds,
  jurySideScore,
  roundStepLabel,
} from '../../server/lib/session-stage.mjs';
import {
  ROUND_STEPS as CLIENT_STEPS,
  ROUND_STEP_SECONDS as CLIENT_STEP_SECONDS,
  jurySideScore as clientJurySideScore,
  roundStepLabel as clientRoundStepLabel,
} from '../../src/lib/session-engine';

describe('debat: langkah ronde (11 langkah = 1200 dtk)', () => {
  it('berisi 11 langkah (3×240s + 8×60s)', () => {
    expect(ROUND_STEPS).toHaveLength(11);
    expect(ROUND_STEP_SECONDS).toHaveLength(11);
    expect(ROUND_STEP_SECONDS.reduce((a, b) => a + b, 0)).toBe(1200);
    expect(ROUND_STEP_SECONDS.filter((s) => s === 240)).toHaveLength(3);
    expect(ROUND_STEP_SECONDS.filter((s) => s === 60)).toHaveLength(8);
  });

  it('label langkah aman untuk indeks tak dikenal', () => {
    expect(roundStepLabel(0)).toBe(ROUND_STEPS[0].label);
    expect(roundStepLabel(99)).toBe(ROUND_STEPS[0].label);
    expect(roundStepLabel(undefined)).toBe(ROUND_STEPS[0].label);
  });

  it('paritas konstanta klien ↔ server', () => {
    expect(CLIENT_STEPS.map((s) => s.key)).toEqual(ROUND_STEPS.map((s) => s.key));
    expect(CLIENT_STEP_SECONDS).toEqual(ROUND_STEP_SECONDS);
    expect(clientRoundStepLabel(4)).toBe(roundStepLabel(4));
  });
});

describe('debat: lembar juri 4 kriteria berbobot', () => {
  it('bobot total 100 (biblika 40 · logika 30 · teamwork 20 · etika 10)', () => {
    expect(JURY_CRITERIA.map((c) => c.weight).reduce((a, b) => a + b, 0)).toBe(100);
    expect(JURY_WEIGHTS).toEqual({ biblika: 40, logika: 30, teamwork: 20, etika: 10 });
  });

  it('jurySideScore menjumlahkan + membatasi pada bobot maksimum', () => {
    expect(jurySideScore({ biblika: 40, logika: 30, teamwork: 20, etika: 10 })).toBe(100);
    expect(jurySideScore({ biblika: 999, logika: -5, teamwork: 0, etika: 0 })).toBe(40);
    expect(jurySideScore(null)).toBe(0);
    expect(clientJurySideScore({ biblika: 30, logika: 20, teamwork: 10, etika: 5 })).toBe(65);
  });
});

describe('debat: cleanRounds kompatibel mundur + diperluas', () => {
  it('sesi lama (tanpa field baru) tetap normal + default aman', () => {
    const out = cleanRounds({
      rounds: [{ mosi: 'A vs B', pro: 'Tim 1', kontra: 'Tim 2', proScore: 70, kontraScore: 60 }],
      current: 0,
      phase: 'brief',
    });
    expect(out).not.toBeNull();
    expect(out!.rounds[0].mosi).toBe('A vs B');
    expect(out!.rounds[0].proScore).toBe(70);
    expect(out!.rounds[0].jury).toEqual([]);
    expect(out!.step).toBe(0);
    expect(out!.stepSeconds).toBe(ROUND_STEP_SECONDS[0]);
    expect(out!.stepShowOnScreen).toBe(true);
    expect(out!.teams).toEqual({ pro: { name: '', mentor: '', members: [] }, kontra: { name: '', mentor: '', members: [] } });
    expect(out!.trapReveal).toBe('');
  });

  it('membawa langkah, tim, juri, dan Trap Reveal', () => {
    const out = cleanRounds({
      rounds: [
        {
          mosi: 'M1',
          proScore: 0,
          kontraScore: 0,
          jury: [{ name: 'Juri A', pro: { biblika: 40, logika: 30, teamwork: 20, etika: 10 }, kontra: { biblika: 20, logika: 10 } }],
        },
      ],
      current: 0,
      phase: 'pro',
      step: 3,
      stepStartedAt: '2026-10-04T01:00:00.000Z',
      stepSeconds: 240,
      stepShowOnScreen: false,
      teams: { pro: { name: 'Api', mentor: 'M1', members: ['a', 'b'] }, kontra: { name: 'Angin', mentor: 'M2', members: ['c'] } },
      trapReveal: 'Kedua sisi adalah dikotomi palsu.',
    });
    expect(out!.step).toBe(3);
    expect(out!.stepSeconds).toBe(240);
    expect(out!.stepShowOnScreen).toBe(false);
    expect(out!.stepStartedAt).toBe('2026-10-04T01:00:00.000Z');
    expect(out!.teams.pro).toEqual({ name: 'Api', mentor: 'M1', members: ['a', 'b'] });
    expect(out!.teams.kontra.members).toEqual(['c']);
    expect(out!.rounds[0].jury[0].name).toBe('Juri A');
    expect(out!.rounds[0].jury[0].kontra).toEqual({ biblika: 20, logika: 10, teamwork: 0, etika: 0 });
    expect(out!.trapReveal).toContain('dikotomi palsu');
  });

  it('step di luar rentang dijepit & null bukan objek ditolak', () => {
    const out = cleanRounds({ rounds: [{ mosi: 'x' }], step: 99 });
    expect(out!.step).toBe(ROUND_STEPS.length - 1);
    expect(cleanRounds(null)).toBeNull();
    expect(cleanRounds([])).toBeNull();
  });
});
