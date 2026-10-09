import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { TestimonyPick } from '../../lib/mentoring';

const ROLE_LABEL: Record<string, string> = {
  MENTEE: 'Mentee',
  MENTOR: 'Mentor',
  CO_MENTOR: 'Co-mentor',
  OTHER: 'Jemaat',
  ANY: 'Jemaat',
};

/**
 * Roda undian kesaksian (layar proyektor): saat hasil baru masuk, nama
 * berputar ±2,5 detik lalu berhenti di nama terpilih (nama + grup).
 * Murni tampilan — undian dilakukan server via kontrol.
 */
export const TestimonyWheel: React.FC<{ picks: TestimonyPick[] }> = ({ picks }) => {
  const sig = useMemo(() => picks.map((p) => `${p.slot}:${p.userId}`).join('|'), [picks]);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<TestimonyPick[]>(picks);
  const timer = useRef<number | null>(null);
  const interval = useRef<number | null>(null);

  useEffect(() => {
    if (!sig) {
      setShown([]);
      return;
    }
    setSpinning(true);
    interval.current = window.setInterval(() => {
      setShown(() => [...picks].sort(() => Math.random() - 0.5));
    }, 90);
    timer.current = window.setTimeout(() => {
      if (interval.current) window.clearInterval(interval.current);
      setShown(picks);
      setSpinning(false);
    }, 2500);
    return () => {
      if (interval.current) window.clearInterval(interval.current);
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!spinning) setShown(picks);
  }, [picks, spinning]);

  if (!picks.length) return null;

  return (
    <section className="rounded-[28px] bg-gradient-to-br from-brand/20 to-brand-end/20 border border-brand/30 p-8">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-4 inline-flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-brand" />
        {spinning ? 'Mengundi kesaksian…' : 'Terpilih untuk bersaksi'}
      </p>
      <div className={`grid gap-4 ${shown.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {shown.map((p, i) => (
          <div
            key={`${p.slot}-${p.userId}-${i}`}
            className={`rounded-2xl p-5 text-center transition-all ${
              spinning ? 'bg-white/5 blur-[1px]' : 'bg-white/10 border border-white/15'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-brand">Slot {p.slot}</p>
            <p className="font-display text-lg font-black mt-1 truncate" title={p.name}>
              {p.name}
            </p>
            <p className="text-[10px] text-white/50 mt-1">{[p.groupName, ROLE_LABEL[p.role] || p.role].filter(Boolean).join(' · ')}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
