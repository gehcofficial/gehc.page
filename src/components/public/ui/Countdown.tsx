import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useLang } from '../../../context/LangContext';

const TARGET_ISO = '2026-09-05T16:00:00+07:00'; // Sabtu 5 Sep 2026, 16:00 WIB

function diffParts(target: Date, now: Date) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  return { days, hours, min, past: ms === 0 };
}

/** Countdown menuju BAKU TAU 4.0 — 5 Sep 2026 16:00 WIB. */
export const Countdown: React.FC = () => {
  const { t } = useLang();
  const target = new Date(TARGET_ISO);
  const [parts, setParts] = useState(() => diffParts(target, new Date()));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(target, new Date())), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
