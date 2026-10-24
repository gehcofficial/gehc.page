/**
 * Creative Lab step gate — mirror server/lib/lab-step-gate.mjs (UI gating).
 */

export const LAB_PHASES = ['PRE', 'START', 'BRIEFING', 'A1', 'A2', 'PRESENT', 'DONE'] as const;
export type LabPhase = (typeof LAB_PHASES)[number];

export type LabCompleted = {
  START_AT: string | null;
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
  presentStartedAt?: string | null;
  completed?: Partial<LabCompleted> | null;
};

export function defaultLabCompleted(): LabCompleted {
  return {
    START_AT: null,
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
    START_AT: pick('START_AT'),
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
  if (p === 'IDLE') return startedAt ? 'START' : 'PRE';
  if (p === 'DRAW') return 'BRIEFING';
  if ((LAB_PHASES as readonly string[]).includes(p)) return p as LabPhase;
  return 'PRE';
}

export function canEnableLabRunnerKey(key: string, activity: LabGateActivity | null | undefined): boolean {
  const a = activity || {};
  const phase = normalizeLabPhase(a.phase, a.startedAt);
  const c = cleanLabCompleted(a.completed);
  const drawn = Boolean(a.presentDrawnAt || c.DRAW_AT);

  switch (String(key || '').toUpperCase()) {
    case 'START':
      return phase === 'PRE' && !c.START_AT;
    case 'BRIEFING':
      return phase === 'START' && Boolean(c.START_AT) && !c.BRIEFING_AT;
    case 'A1':
      return (phase === 'BRIEFING' || drawn) && drawn && !c.A1_AT;
    case 'A2':
      return Boolean(c.A1_AT) && !c.A2_AT;
    case 'PRESENT':
      return Boolean(c.A2_AT) && !c.PRESENT_AT;
    case 'CHIPS':
    case 'WRAPUP':
      return Boolean(c.PRESENT_AT) && phase !== 'DONE' && !c.DONE_AT;
    case 'LOCK':
      return phase === 'DONE' || Boolean(c.DONE_AT);
    default:
      return false;
  }
}

export function labAudienceShowsPresentOrder(
  phase?: string | null,
  presentStartedAt?: string | null,
  nowMs = Date.now(),
): boolean {
  const p = normalizeLabPhase(phase);
  if (p !== 'PRESENT' || !presentStartedAt) return false;
  const start = Date.parse(String(presentStartedAt));
  if (Number.isNaN(start)) return false;
  return nowMs - start < 60_000;
}
