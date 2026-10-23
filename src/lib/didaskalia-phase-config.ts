import type { MentoringStatus } from './mentoring';
import { resolvePatternCode } from './session-engine';
import { canEnableLabRunnerKey, type LabGateActivity } from './lab-step-gate';

export type LabStepContext = { activity?: LabGateActivity | null };

export type DidaskaliaPhaseStep = {
  key: string;
  label: string;
  /** Tombol aktif bila true untuk status sesi saat ini. */
  enabledWhen: (status: MentoringStatus, lab?: LabStepContext) => boolean;
};

const includes = (status: MentoringStatus, ...allowed: MentoringStatus[]) =>
  allowed.includes(status);

export const CREATIVE_LAB_DAY_FLOW =
  'Briefing (instruksi + tombol Undian terpisah) → Sesi 1 (Reminder Jar 15′) → Sesi 2 (Art Stations 25′) → Presentasi Kelompok → Konklusi → Buka Satu Kata. Timer display-only; transisi manual berurutan.';

export function monologPhaseSteps(prefMin: (key: string) => number): DidaskaliaPhaseStep[] {
  return [
    { key: 'F1', label: `Sesi 1 · Bedah Lagu · ${prefMin('F1')}′`, enabledWhen: (s) => s === 'DRAFT' },
    { key: 'F2', label: `Sesi 2 · Deep Sharing · ${prefMin('F2')}′`, enabledWhen: (s) => s === 'RUNNING' },
    { key: 'F3', label: `Sesi 3 · Kesaksian · ${prefMin('F3')}′`, enabledWhen: (s) => s === 'RUNNING' },
    { key: 'CLOSING', label: `Konklusi · ${prefMin('CLOSING')}′`, enabledWhen: (s) => s === 'WRAPUP' },
  ];
}

/** Movie Breakdown — mengikuti Creative Lab: Firman → Briefing → M0 … M4 */
export function filmPhaseSteps(): DidaskaliaPhaseStep[] {
  return [
    { key: 'FIRMAN', label: 'Firman · layar judul', enabledWhen: (s) => includes(s, 'DRAFT', 'LIKERT_OPEN') },
    { key: 'BRIEFING', label: 'Briefing · 5′', enabledWhen: (s) => includes(s, 'DRAFT', 'LIKERT_OPEN') },
    { key: 'M0', label: 'Buka Likert AWAL · 5′', enabledWhen: (s) => includes(s, 'DRAFT', 'LIKERT_OPEN') },
    { key: 'M1', label: 'Mulai Film (ikuti film)', enabledWhen: (s) => s === 'LIKERT_OPEN' },
    { key: 'M3', label: 'Buka Likert AKHIR + LL · 5′', enabledWhen: (s) => s === 'RUNNING' },
    { key: 'M4', label: 'Undi + Kesaksian · 10′', enabledWhen: (s) => s === 'RUNNING' },
  ];
}

export function creativeLabPhaseSteps(): DidaskaliaPhaseStep[] {
  const labEnabled = (key: string) => (_s: MentoringStatus, lab?: LabStepContext) =>
    canEnableLabRunnerKey(key, lab?.activity);
  return [
    { key: 'BRIEFING', label: 'Briefing', enabledWhen: labEnabled('BRIEFING') },
    { key: 'DRAW', label: 'Undian', enabledWhen: labEnabled('DRAW') },
    { key: 'A1', label: 'Sesi 1', enabledWhen: labEnabled('A1') },
    { key: 'A2', label: 'Sesi 2', enabledWhen: labEnabled('A2') },
    { key: 'PRESENT', label: 'Presentasi', enabledWhen: labEnabled('PRESENT') },
    {
      key: 'WRAPUP',
      label: 'Buka Satu Kata',
      enabledWhen: (s, lab) =>
        (s === 'RUNNING' || s === 'WRAPUP') && canEnableLabRunnerKey('WRAPUP', lab?.activity),
    },
  ];
}

export function debatPhaseSteps(): DidaskaliaPhaseStep[] {
  return [
    { key: 'D0', label: 'Mulai Ronde 1 · Reveal 1′', enabledWhen: (s) => includes(s, 'DRAFT', 'LIKERT_OPEN') },
    { key: 'D1', label: 'Ronde Berikutnya', enabledWhen: (s) => s === 'RUNNING' },
    { key: 'D2', label: 'Trap Reveal · 20′', enabledWhen: (s) => s === 'RUNNING' },
  ];
}

export function postToPostPhaseSteps(): DidaskaliaPhaseStep[] {
  return [
    { key: 'LIKERT', label: 'Buka Akses Likert', enabledWhen: (s) => includes(s, 'DRAFT', 'LIKERT_OPEN') },
    { key: 'START', label: 'Mulai Kunjungan Pos', enabledWhen: (s) => s === 'LIKERT_OPEN' || s === 'RUNNING' },
    { key: 'WRAPUP', label: 'Lesson Learned', enabledWhen: (s) => s === 'RUNNING' },
  ];
}

export function missionSequencePhaseSteps(): DidaskaliaPhaseStep[] {
  return [
    { key: 'START', label: 'Mulai Sesi / Snack & Merge', enabledWhen: (s) => includes(s, 'DRAFT', 'LIKERT_OPEN') },
    { key: 'MISSION', label: 'Mission Room', enabledWhen: (s) => s === 'RUNNING' },
    { key: 'WRAPUP', label: 'Laporan & Penutup', enabledWhen: (s) => s === 'RUNNING' || s === 'WRAPUP' },
  ];
}

export function phaseStepsForPattern(
  patternCode: string | null | undefined,
  prefMin: (key: string) => number,
): DidaskaliaPhaseStep[] {
  const code = resolvePatternCode(patternCode);
  switch (code) {
    case 'MONOLOG':
      return monologPhaseSteps(prefMin);
    case 'BEDAH_FILM':
      return filmPhaseSteps();
    case 'CREATIVE_LAB':
      return creativeLabPhaseSteps();
    case 'DEBAT':
      return debatPhaseSteps();
    case 'POST_TO_POST':
      return postToPostPhaseSteps();
    case 'THREE_SEQUENCES':
      return missionSequencePhaseSteps();
    default:
      return [];
  }
}

export function dayFlowHintForPattern(patternCode: string | null | undefined): string | null {
  const code = resolvePatternCode(patternCode);
  if (code === 'CREATIVE_LAB') return CREATIVE_LAB_DAY_FLOW;
  if (code === 'BEDAH_FILM') {
    return 'Firman → Briefing → Likert AWAL → Mulai Film → Likert AKHIR + Lesson Learned → Undi & Kesaksian.';
  }
  if (code === 'DEBAT') return 'Praise & Worship (firman) → Ronde debat → Trap Reveal konklusi.';
  if (code === 'POST_TO_POST') return 'Likert → Briefing → Kunjungan Pos → Lesson Learned.';
  if (code === 'THREE_SEQUENCES') return 'Firman di P&W → Snack & Merge → Mission Room → Laporan → Penutup.';
  if (code === 'MONOLOG') return 'Bedah Lagu → Deep Sharing → Kesaksian → Konklusi.';
  return null;
}
