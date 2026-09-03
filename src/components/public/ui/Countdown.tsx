import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useLang } from '../../../context/LangContext';

const FALLBACK_ISO = '2026-09-12T15:00:00+07:00';

function diffParts(target: Date, now: Date) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return { days, hours, min, sec, past: ms === 0 };
}

/** Countdown menuju BAKU TAU 4.0 — tick tiap detik. */
export const Countdown: React.FC<{ targetIso?: string | null }> = ({ targetIso }) => {
  const { t } = useLang();
  const target = new Date(targetIso || FALLBACK_ISO);
  const [parts, setParts] = useState(() => diffParts(target, new Date()));

  useEffect(() => {
    const next = new Date(targetIso || FALLBACK_ISO);
    const tick = () => setParts(diffParts(next, new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  if (parts.past) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
        <CalendarClock className="w-3 h-3" /> {t.events.happeningToday}
      </span>
    );
  }

  const cells = [
    { v: parts.days, l: t.events.days },
    { v: parts.hours, l: t.events.hours },
    { v: parts.min, l: t.events.min },
    { v: parts.sec, l: t.events.sec },
  ];

  return (
    <div className="flex items-center gap-3" aria-label={t.events.startsIn}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5" />
        {t.events.startsIn}
      </span>
      <div className="flex items-center gap-1.5">
        {cells.map((c) => (
          <span key={c.l} className="flex items-baseline gap-1">
            <span className="text-lg font-black tabular-nums">{String(c.v).padStart(2, '0')}</span>
            <span className="text-[9px] uppercase opacity-50">{c.l}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
