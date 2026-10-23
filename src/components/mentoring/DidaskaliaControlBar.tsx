import React from 'react';
import type { MentoringStatus } from '../../lib/mentoring';
import { STATUS_LABELS } from '../../lib/mentoring';

type ExtendChipProps = {
  canRun: boolean;
  busy?: boolean;
  onExtend: (seconds: number) => void;
};

const ExtendChips: React.FC<ExtendChipProps> = ({ canRun, busy, onExtend }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">+ waktu:</span>
    {[
      { sec: 5, label: '+5 dtk' },
      { sec: 60, label: '+1 mnt' },
      { sec: 300, label: '+5 mnt' },
    ].map((p) => (
      <button
        key={p.sec}
        type="button"
        disabled={!canRun || busy}
        onClick={() => onExtend(p.sec)}
        className="px-2.5 py-1 rounded-full border border-[#D9D7D0] text-[10px] font-bold text-[#1B1B1B] hover:border-brand disabled:opacity-50"
      >
        {p.label}
      </button>
    ))}
  </div>
);

export type DidaskaliaControlBarProps = {
  status: MentoringStatus;
  busy?: boolean;
  phaseStrip: React.ReactNode;
  statusExtra?: React.ReactNode;
  extend?: ExtendChipProps;
  onClose: () => void;
  onResetDraft: () => void;
  onStopTimer?: () => void;
  onResetStage?: () => void;
  showStageControls?: boolean;
};

/**
 * Satu bar kontrol atas Didaskalia (zona A–D): siklus sesi, langkah fase,
 * timer/+waktu, status. Konten kerja tetap di panel bawah.
 */
export const DidaskaliaControlBar: React.FC<DidaskaliaControlBarProps> = ({
  status,
  busy,
  phaseStrip,
  statusExtra,
  extend,
  onClose,
  onResetDraft,
  onStopTimer,
  onResetStage,
  showStageControls,
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] w-full sm:w-auto">Siklus</span>
      <button
        type="button"
        disabled={busy}
        onClick={onClose}
        title="Menutup sesi (status CLOSED) — bukan hanya menghentikan timer"
        className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 bg-[#1B1B1B]"
      >
        Tutup Sesi
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onResetDraft}
        title="Menghapus jawaban audiens dan karya Lab — permanen"
        className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider disabled:opacity-60 bg-white !text-[#8C8880] border border-[#D9D7D0]"
      >
        Reset ke Draft
      </button>
    </div>

    <div className="flex flex-wrap items-center gap-2 border-t border-[#EFEDE8] pt-3">
      <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] w-full sm:w-auto">Langkah</span>
      {phaseStrip}
    </div>

    {(extend || showStageControls) && (
      <div className="flex flex-wrap items-center gap-3 border-t border-[#EFEDE8] pt-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Timer</span>
        {extend && <ExtendChips {...extend} busy={busy} />}
        {showStageControls && onStopTimer && (
          <button
            type="button"
            disabled={busy}
            onClick={onStopTimer}
            title="Hanya menghentikan timer fase — sesi tetap berjalan"
            className="px-3 py-1.5 rounded-full border border-[#D9D7D0] text-[10px] font-bold disabled:opacity-50"
          >
            Stop timer
          </button>
        )}
        {showStageControls && onResetStage && (
          <button
            type="button"
            disabled={busy}
            onClick={onResetStage}
            title="Reset panggung ke Undian — tidak menghapus jawaban audiens"
            className="px-3 py-1.5 rounded-full border border-[#D9D7D0] text-[10px] font-bold disabled:opacity-50"
          >
            Reset panggung
          </button>
        )}
      </div>
    )}

    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#8C8880] border-t border-[#EFEDE8] pt-2">
      <span>Status: {STATUS_LABELS[status]}</span>
      {statusExtra}
    </div>
  </div>
);

export default DidaskaliaControlBar;
