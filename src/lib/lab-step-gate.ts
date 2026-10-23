/**
 * Creative Lab step gate — mirror server/lib/lab-step-gate.mjs (UI gating).
 */

export const LAB_PHASES = ['PRE', 'BRIEFING', 'DRAW', 'A1', 'A2', 'PRESENT', 'DONE'] as const;
export type LabPhase = (typeof LAB_PHASES)[number];

export type LabCompleted = {
  BRIEFING_AT: string | null;
  DRAW_AT: string | null;
  A1_AT: string | null;
  A2_AT: string | null;
  PRESENT_AT: string | null;
  DONE_AT: string | null;
};

export type LabGateActivity = {
  phase?: string | null;
  startedAt?: string | null;
  presentDrawnAt?: string | null;
  completed?: Partial<LabCompleted> | null;
};

export function defaultLabCompleted(): LabCompleted {
  return {
    BRIEFING_AT: null,
    DRAW_AT: null,
    A1_AT: null,
    A2_AT: null,
    PRESENT_AT: null,
    DONE_AT: null,
  };
}

export function cleanLabCompleted(raw: unknown): LabCompleted {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const pick = (k: string) => (o[k] ? String(o[k]).slice(0, 30) : null);
  return {
    BRIEFING_AT: pick('BRIEFING_AT'),
    DRAW_AT: pick('DRAW_AT'),
    A1_AT: pick('A1_AT'),
    A2_AT: pick('A2_AT'),
    PRESENT_AT: pick('PRESENT_AT'),
    DONE_AT: pick('DONE_AT'),
  };
}

export function normalizeLabPhase(phase?: string | null, startedAt?: string | null): LabPhase {
  const p = String(phase || 'PRE').toUpperCase();
  if (p === 'IDLE') return startedAt ? 'BRIEFING' : 'PRE';
  if ((LAB_PHASES as readonly string[]).includes(p)) return p as LabPhase;
  return 'PRE';
}

export function canEnableLabRunnerKey(key: string, activity: LabGateActivity | null | undefined): boolean {
  const a = activity || {};
  const phase = normalizeLabPhase(a.phase, a.startedAt);
  const c = cleanLabCompleted(a.completed);
  const drawn = Boolean(a.presentDrawnAt || c.DRAW_AT);

  switch (String(key || '').toUpperCase()) {
    case 'BRIEFING':
      return phase === 'PRE' && !c.BRIEFING_AT;
    case 'DRAW':
      return Boolean(c.BRIEFING_AT) && !drawn && (phase === 'BRIEFING' || phase === 'DRAW');
    case 'A1':
      return drawn && !c.A1_AT;
    case 'A2':
      return Boolean(c.A1_AT) && !c.A2_AT;
    case 'PRESENT':
      return Boolean(c.A2_AT) && !c.PRESENT_AT;
    case 'WRAPUP':
      return Boolean(c.PRESENT_AT) || phase === 'DONE' || Boolean(c.DONE_AT);
    default:
      return false;
  }
}
