import { describe, expect, it } from 'vitest';
import {
  CREATIVE_LAB_DAY_FLOW,
  debatPhaseSteps,
  filmPhaseSteps,
  missionSequencePhaseSteps,
  monologPhaseSteps,
  phaseStepsForPattern,
  postToPostPhaseSteps,
} from '../../src/lib/didaskalia-phase-config';

describe('didaskalia-phase-config', () => {
  it('monolog steps order F1→CLOSING', () => {
    const steps = monologPhaseSteps(() => 5);
    expect(steps.map((s) => s.key)).toEqual(['F1', 'F2', 'F3', 'CLOSING']);
    expect(steps[0].enabledWhen('DRAFT')).toBe(true);
    expect(steps[1].enabledWhen('RUNNING')).toBe(true);
  });

  it('film includes Firman and Briefing before M0', () => {
    const keys = filmPhaseSteps().map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(['FIRMAN', 'BRIEFING', 'M0', 'M1']);
  });

  it('creative lab day flow mentions Undian and Briefing', () => {
    expect(CREATIVE_LAB_DAY_FLOW).toMatch(/Undian/);
    expect(CREATIVE_LAB_DAY_FLOW).toMatch(/Briefing/);
  });

  it('resolves pattern code aliases', () => {
    expect(phaseStepsForPattern('BEDAH_FILM', () => 1).length).toBeGreaterThan(4);
    expect(phaseStepsForPattern('MONOLOG', () => 1).length).toBe(4);
  });

  it('debat, post-to-post, and mission sequence step keys', () => {
    expect(debatPhaseSteps().map((s) => s.key)).toEqual(['D0', 'D1', 'D2']);
    expect(postToPostPhaseSteps().map((s) => s.key)).toEqual(['LIKERT', 'START', 'WRAPUP']);
    expect(missionSequencePhaseSteps().map((s) => s.key)).toEqual(['START', 'MISSION', 'WRAPUP']);
    expect(debatPhaseSteps()[0].enabledWhen('LIKERT_OPEN')).toBe(true);
  });
});
