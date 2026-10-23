import React from 'react';
import { useLabActivityContext } from '../../context/LabActivityContext';
import type { MentoringLivePayload } from '../../lib/mentoring';
import { DidaskaliaSessionControls } from './DidaskaliaSessionControls';

type Detail = {
  session: { status: string; id: string };
};

type Props = {
  detail: Detail;
  live: MentoringLivePayload | null;
  busy: boolean;
  prefMin: (key: string) => number;
  onWrapup: () => void;
  onClose: () => void;
  onResetDraft: () => void;
};

export const MentoringLabControls: React.FC<Props> = ({
  detail,
  live,
  busy,
  prefMin,
  onWrapup,
  onClose,
  onResetDraft,
}) => {
  const lab = useLabActivityContext();
  const status = detail.session.status as import('../../lib/mentoring').MentoringStatus;

  const onRunStep = (key: string) => {
    switch (key) {
      case 'DRAW':
        void lab.startDraw();
        break;
      case 'BRIEFING':
        void lab.startBriefing();
        break;
      case 'A1':
        lab.startPhase('A1');
        break;
      case 'A2':
        lab.startPhase('A2');
        break;
      case 'PRESENT':
        lab.startPresent();
        break;
      case 'WRAPUP':
        onWrapup();
        break;
      default:
        break;
    }
  };

  const extendCanRun = Boolean(lab.activity.startedAt || lab.activity.presentStartedAt);

  return (
    <DidaskaliaSessionControls
      patternCode="CREATIVE_LAB"
      status={status}
      busy={busy || lab.busy}
      activeActivityPhase={lab.activity.phase}
      prefMin={prefMin}
      onRunStep={onRunStep}
      onClose={onClose}
      onResetDraft={onResetDraft}
      onExtend={(s) => void lab.extendActivityPhase(s)}
      extendCanRun={extendCanRun}
      showStageControls
      onStopTimer={() => void lab.stopTimer()}
      onResetStage={() => lab.resetStage()}
      showDayFlow
      statusExtra={
        <span className="ml-2 font-mono text-[#1B1B1B]">
          {lab.phaseLabel} · {Math.max(0, Math.floor(lab.remainingMs / 1000))} dtk
        </span>
      }
    />
  );
};

export default MentoringLabControls;
