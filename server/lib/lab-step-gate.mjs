/**
 * Creative Lab — urutan langkah ketat (server source of truth + mirror di src/lib).
 */

export const LAB_PHASES = ['PRE', 'BRIEFING', 'DRAW', 'A1', 'A2', 'PRESENT', 'DONE'];

const STEP_INDEX = {
  PRE: 0,
  BRIEFING: 1,
  DRAW: 2,
  A1: 3,
  A2: 4,
  PRESENT: 5,
  DONE: 6,
};

export function defaultLabCompleted() {
  return {
    BRIEFING_AT: null,
    DRAW_AT: null,
    A1_AT: null,
    A2_AT: null,
    PRESENT_AT: null,
    DONE_AT: null,
  };
}

export function cleanLabCompleted(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const pick = (k) => (o[k] ? String(o[k]).slice(0, 30) : null);
  return {
    BRIEFING_AT: pick('BRIEFING_AT'),
    DRAW_AT: pick('DRAW_AT'),
    A1_AT: pick('A1_AT'),
    A2_AT: pick('A2_AT'),
    PRESENT_AT: pick('PRESENT_AT'),
    DONE_AT: pick('DONE_AT'),
  };
}

/** Map fase lama `IDLE` → PRE (belum mulai) atau BRIEFING (sudah mulai). */
export function normalizeLabPhase(phase, startedAt) {
  const p = String(phase || 'PRE').toUpperCase();
  if (p === 'IDLE') return startedAt ? 'BRIEFING' : 'PRE';
  if (LAB_PHASES.includes(p)) return p;
  return 'PRE';
}

export function labPhaseStepIndex(phase, startedAt) {
  return STEP_INDEX[normalizeLabPhase(phase, startedAt)] ?? 0;
}

/**
 * Tombol runner kontrol: BRIEFING, DRAW, A1, A2, PRESENT, WRAPUP.
 */
export function canEnableLabRunnerKey(key, activity) {
  const a = activity && typeof activity === 'object' ? activity : {};
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

function isoNow() {
  return new Date().toISOString();
}

/** Set timestamp completed saat fase maju (server). */
export function stampLabCompletedOnTransition(prev, next) {
  const out = { ...next, completed: cleanLabCompleted(next.completed || prev?.completed) };
  const pPhase = normalizeLabPhase(prev?.phase, prev?.startedAt);
  const nPhase = normalizeLabPhase(out.phase, out.startedAt);
  const now = isoNow();

  if (nPhase === 'BRIEFING' && !out.completed.BRIEFING_AT) out.completed.BRIEFING_AT = now;
  if ((out.presentDrawnAt && !prev?.presentDrawnAt) || (nPhase === 'DRAW' && pPhase !== 'DRAW' && !out.completed.DRAW_AT)) {
    if (!out.completed.DRAW_AT) out.completed.DRAW_AT = out.presentDrawnAt || now;
  }
  if (nPhase === 'A1' && pPhase !== 'A1' && !out.completed.A1_AT) out.completed.A1_AT = now;
  if (nPhase === 'A2' && pPhase !== 'A2' && !out.completed.A2_AT) out.completed.A2_AT = now;
  if (nPhase === 'PRESENT' && pPhase !== 'PRESENT' && !out.completed.PRESENT_AT) out.completed.PRESENT_AT = now;
  if (nPhase === 'DONE' && pPhase !== 'DONE' && !out.completed.DONE_AT) out.completed.DONE_AT = now;

  return out;
}

/**
 * Validasi transisi fase. null = OK; string = pesan error (409).
 */
export function validateLabActivityTransition(prev, next) {
  const pPhase = normalizeLabPhase(prev?.phase, prev?.startedAt);
  const nPhase = normalizeLabPhase(next?.phase, next?.startedAt);
  const pi = labPhaseStepIndex(pPhase);
  const ni = labPhaseStepIndex(nPhase);

  if (ni < pi) {
    return 'Transisi mundur tidak diizinkan — gunakan Reset panggung atau Reset Draf.';
  }

  if (ni === pi) {
    if (!prev?.presentDrawnAt && next?.presentDrawnAt && pi < STEP_INDEX.DRAW) {
      return 'Undian hanya boleh dijalankan setelah Briefing dimulai.';
    }
    return null;
  }

  if (ni > pi + 1) {
    return 'Langkah aktivitas tidak boleh dilewati — ikuti urutan Briefing → Undian → Sesi 1 → Sesi 2 → Presentasi.';
  }

  const c = cleanLabCompleted(next.completed || prev?.completed);
  if (nPhase === 'BRIEFING' && pPhase !== 'PRE') {
    return 'Briefing hanya bisa dimulai dari tahap awal.';
  }
  if (nPhase === 'DRAW' && pPhase !== 'BRIEFING') {
    return 'Undian hanya bisa dijalankan saat Briefing.';
  }
  if (nPhase === 'A1') {
    if (!next.presentDrawnAt && !c.DRAW_AT) return 'Sesi 1 terbuka setelah undian selesai.';
  }
  if (nPhase === 'A2' && !c.A1_AT) return 'Sesi 2 terbuka setelah Sesi 1 dimulai.';
  if (nPhase === 'PRESENT' && !c.A2_AT) return 'Presentasi terbuka setelah Sesi 2 dimulai.';
  if (nPhase === 'DONE' && pPhase !== 'PRESENT' && pPhase !== 'A2') {
    return 'Konklusi mengikuti Presentasi.';
  }

  return null;
}

export function mergeValidateAndStampLabActivity(prev, incoming) {
  const err = validateLabActivityTransition(prev, incoming);
  if (err) return { error: err };
  const stamped = stampLabCompletedOnTransition(prev, incoming);
  return { activity: stamped };
}
