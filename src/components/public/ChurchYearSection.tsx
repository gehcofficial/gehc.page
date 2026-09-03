import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Church } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { Reveal } from './ui/SectionHeader';
import { Countdown } from './ui/Countdown';

type PublicEntry = {
  id: string;
  startDate: string;
  name: string;
  nameEn?: string | null;
  level: string;
  source: 'LITURGICAL' | 'GMIM_FIXED' | 'JEMAAT';
  season?: string | null;
  scriptureRef?: string | null;
};

const SOURCE_STYLE: Record<string, string> = {
  LITURGICAL: 'bg-[#FF416C]/10 text-[#FF416C]',
  GMIM_FIXED: 'bg-amber-500/10 text-amber-700',
  JEMAAT: 'bg-emerald-500/10 text-emerald-700',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * KALENDER GEREJAWI [home/kegiatan] — hari raya liturgis, tanggal tetap GMIM,
 * dan agenda jemaat yang ditandai publik di portal.
 */
export const ChurchYearSection: React.FC<{ limit?: number }> = ({ limit = 6 }) => {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState<PublicEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const year = new Date().getFullYear();
    fetch(`/api/church-calendar/public?from=${year}-01-01&to=${year + 1}-12-31`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoaded(true));
  }, []);

  const upcoming = useMemo(() => {
    const today = todayISO();
    return entries.filter((e) => e.startDate >= today).slice(0, limit);
  }, [entries, limit]);

  const next = upcoming[0];

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

  const displayName = (e: PublicEntry) => (lang === 'en' && e.nameEn ? e.nameEn : e.name);

  if (loaded && upcoming.length === 0) return null;

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C8880] flex items-center gap-1.5">
            <Church className="w-3.5 h-3.5 text-[#FF416C]" /> {t.events.churchYearEyebrow}
          </p>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1B1B1B] mt-1">
            {t.events.churchYearTitle}
          </h3>
        </div>
        {next && (
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880] mb-1.5">
              {t.events.churchYearNext} · {displayName(next)}
            </p>
            <Countdown targetIso={`${next.startDate}T00:00:00+07:00`} />
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {upcoming.map((e, i) => (
          <Reveal key={e.id} delay={i * 0.05}>
            <div className="h-full bg-white rounded-[24px] border border-[#D9D7D0]/50 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-black text-[#1B1B1B] leading-snug">{displayName(e)}</h4>
                <span
                  className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    SOURCE_STYLE[e.source] || SOURCE_STYLE.JEMAAT
                  }`}
                >
                  {e.level}
                </span>
              </div>
              <p className="text-xs text-[#8C8880] mt-2 flex items-center gap-1.5 capitalize">
                <CalendarDays className="w-3.5 h-3.5 text-[#FF416C]" />
                {fmt(e.startDate)}
              </p>
              {e.scriptureRef && (
                <p className="text-[10px] text-[#8C8880] mt-1 italic">{e.scriptureRef}</p>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};
