import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { GIFT_BANK, scoreAnswers } from '../../../../data/giftBank';

export const GiftTestWizard: React.FC<{
  onFinish: (result: { top5: { key: string; label: string; score: number }[]; scores: Record<string, number> }) => void;
}> = ({ onFinish }) => {
  const totalItems = GIFT_BANK.length * 3;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);

  const items = useMemo(
    () =>
      GIFT_BANK.flatMap((g) =>
        g.items.map((text, ii) => ({
          key: `${g.key}-${ii}`,
          text,
          giftLabel: g.label,
        }))
      ),
    []
  );

  const answeredCount = Object.keys(answers).length;
  const current = items[step];
  const done = answeredCount === totalItems;

  const setAnswer = (v: number) => {
    setAnswers((prev) => ({ ...prev, [current.key]: v }));
    if (step < items.length - 1) {
      setTimeout(() => setStep((s) => Math.min(s + 1, items.length - 1)), 120);
    }
  };

  if (done) {
    const result = scoreAnswers(answers);
    return (
      <div className="bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Tes selesai
        </p>
        <h4 className="text-lg font-black">Top-5 Karunia Rohanimu</h4>
        <div className="mt-3 space-y-2">
          {result.top5.map((g, i) => (
            <div key={g.key} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#181818] text-white text-[10px] font-black flex items-center justify-center">{i + 1}</span>
              <span className="text-sm font-bold">{g.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden ml-2">
                <div className="h-full bg-[#FF416C]" style={{ width: `${(g.score / 15) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold tabular-nums">{g.score}/15</span>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            onFinish({
              top5: result.top5,
              scores: Object.fromEntries(result.scores.map((s) => [s.key, s.score])),
            })
          }
          className="mt-5 w-full py-3 rounded-full bg-[#181818] text-white text-xs font-black uppercase tracking-wider"
        >
          Simpan & Lanjut
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[28px] border border-[#D9D7D0]/60 p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">{current.giftLabel}</p>
        <p className="text-[10px] font-bold tabular-nums text-[#8C8880]">
          {step + 1}/{totalItems}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full bg-[#FF416C] transition-all" style={{ width: `${(answeredCount / totalItems) * 100}%` }} />
      </div>
      <p className="text-base font-semibold leading-relaxed min-h-[72px]">{current.text}</p>
      <div className="grid grid-cols-5 gap-1.5 mt-5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setAnswer(v)}
            className={`py-3 rounded-xl border text-sm font-black transition-all ${
              answers[current.key] === v
                ? 'bg-[#181818] text-white border-black'
                : 'bg-white border-[#D9D7D0] hover:border-black'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-3 text-[10px] text-[#8C8880] font-semibold">
        <span>Sangat tidak setuju</span>
        <span>Sangat setuju</span>
      </div>
      <div className="flex justify-between mt-4">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="p-2 rounded-full border border-[#D9D7D0] disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setStep((s) => Math.min(items.length - 1, s + 1))} disabled={step >= items.length - 1 || !answers[current.key]}
          className="p-2 rounded-full border border-[#D9D7D0] disabled:opacity-30">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
