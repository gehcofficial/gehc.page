import React from 'react';
import type { MentoringStatus } from '../../lib/mentoring';
import { dayFlowHintForPattern, phaseStepsForPattern } from '../../lib/didaskalia-phase-config';
import { DidaskaliaControlBar } from './DidaskaliaControlBar';

export type DidaskaliaSessionControlsProps = {
  patternCode: string;
  status: MentoringStatus;
  busy?: boolean;
  activePhaseKey?: string | null;
  activeActivityPhase?: string | null;
  prefMin: (key: string) => number;
  onRunStep: (key: string) => void;
  onClose: () => void;
  onResetDraft: () => void;
  onExtend: (seconds: number) => void;
  extendCanRun: boolean;
  showStageControls?: boolean;
  onStopTimer?: () => void;
  onResetStage?: () => void;
  statusExtra?: React.ReactNode;
  showDayFlow?: boolean;
};

export const DidaskaliaSessionControls: React.FC<DidaskaliaSessionControlsProps> = ({
  patternCode,
  status,
  busy,
  activePhaseKey,
  activeActivityPhase,
  prefMin,
  onRunStep,
  onClose,
  onResetDraft,
  onExtend,
  extendCanRun,
  showStageControls,
  onStopTimer,
  onResetStage,
  statusExtra,
  showDayFlow,
}) => {
  const steps = phaseStepsForPattern(patternCode, prefMin);
  const hint = dayFlowHintForPattern(patternCode);

  const phaseStrip = (
    <>
      {steps.map((step) => {
        const active =
          activePhaseKey === step.key ||
          (activeActivityPhase && activeActivityPhase === step.key);
        const enabled = step.enabledWhen(status);
        return (
          <button
            key={step.key}
            type="button"
            disabled={busy || !enabled}
            onClick={() => onRunStep(step.key)}
            className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 ${
              active ? 'ring-2 ring-offset-2 ring-brand bg-[#1B1B1B]' : 'bg-emerald-600'
            }`}
          >
            {step.label}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="space-y-3">
      <DidaskaliaControlBar
        status={status}
        busy={busy}
        phaseStrip={phaseStrip}
        statusExtra={statusExtra}
        extend={{ canRun: extendCanRun, onExtend }}
        onClose={onClose}
        onResetDraft={onResetDraft}
        showStageControls={showStageControls}
        onStopTimer={onStopTimer}
        onResetStage={onResetStage}
      />
      {showDayFlow && hint && (
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
          <b>Alur hari-H:</b> {hint}
        </div>
      )}
    </div>
  );
};

export default DidaskaliaSessionControls;
