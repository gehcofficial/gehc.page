import React, { useEffect, useRef, useState } from 'react';
import { fmtClock, type MentoringTimer } from '../../lib/mentoring';

type Props = {
  timer: MentoringTimer;
  size?: 'sm' | 'lg';
  tone?: 'light' | 'dark';
  onExpire?: () => void;
};

/** Hitung mundur tersinkron server (offset dari `serverNow`). */
export const SessionTimer: React.FC<Props> = ({ timer, size = 'sm', tone = 'light', onExpire }) => {
  const offsetRef = useRef(0);
  const [remaining, setRemaining] = useState(timer.remaining);

  useEffect(() => {
    offsetRef.current = Date.parse(timer.serverNow) - Date.now();
    setRemaining(timer.remaining);
  }, [timer.serverNow, timer.remaining, timer.startedAt]);

  useEffect(() => {
    const startedMs = timer.startedAt ? Date.parse(timer.startedAt) : null;
    const tick = () => {
      if (startedMs === null) {
        setRemaining(timer.timerSeconds);
        return;
      }
      const now = Date.now() + offsetRef.current;
      const left = Math.max(0, timer.timerSeconds - Math.floor((now - startedMs) / 1000));
      setRemaining(left);
      if (left === 0) onExpire?.();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timer.startedAt, timer.timerSeconds, onExpire]);

  const low = remaining <= 120;
  const base = low ? 'text-red-500' : tone === 'dark' ? 'text-white' : 'text-[#1B1B1B]';
  return (
    <span
      className={
        size === 'lg'
          ? `font-display font-black tabular-nums text-6xl sm:text-8xl ${base}`
          : `font-bold tabular-nums text-lg ${base}`
      }
    >
      {fmtClock(remaining)}
    </span>
  );
};

export default SessionTimer;
