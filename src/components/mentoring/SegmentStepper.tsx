import React from 'react';
import { Check, Lock } from 'lucide-react';
import { SEGMENTS, type MentoringStatus, type SegmentId, canOpenSegment } from '../../lib/mentoring';

type Props = {
  active: SegmentId;
  done: SegmentId[];
  status: MentoringStatus;
  answered: boolean;
  onSelect: (segment: SegmentId) => void;
};

/** Navigasi 4 segmen hari-H: terkunci sampai syaratnya terpenuhi, boleh mundur. */
export const SegmentStepper: React.FC<Props> = ({ active, done, status, answered, onSelect }) => {
  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Tahap mentoring">
      {SEGMENTS.map((seg, idx) => {
        const unlocked = canOpenSegment(seg.id, status, answered);
        const isActive = seg.id === active;
        const isDone = done.includes(seg.id);
        return (
          <button
            key={seg.id}
            type="button"
            disabled={!unlocked}
            onClick={() => onSelect(seg.id)}
            className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
              isActive
                ? 'bg-gradient-to-r from-brand to-brand-end text-white border-transparent'
                : isDone
                  ? 'bg-brand/10 text-brand border-brand/20'
                  : unlocked
                    ? 'bg-white text-[#8C8880] border-[#D9D7D0] hover:border-brand'
                    : 'bg-[#F3F1EC] text-[#BDBAB2] border-[#E9E8E4]'
            }`}
          >
            {isDone && !isActive ? (
              <Check className="w-3 h-3" />
            ) : !unlocked ? (
              <Lock className="w-3 h-3" />
            ) : (
              <span className="w-3.5 text-center">{idx + 1}</span>
            )}
            {seg.label}
          </button>
        );
      })}
    </nav>
  );
};

export default SegmentStepper;
