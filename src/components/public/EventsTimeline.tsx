import React from 'react';
import { CalendarDays, MapPin, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { SectionHeader, Reveal } from './ui/SectionHeader';
import { Countdown } from './ui/Countdown';

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * EVENTS TIMELINE [home] — kartu unggulan acak terdekat (BAKU TAU 4.0)
 * + garis waktu lampau→kini. Versi penuh ada di tab Kegiatan.
 */
export const EventsTimeline: React.FC<{ condensed?: boolean; showHeader?: boolean }> = ({
  condensed = true,
  showHeader = true,
}) => {
  const { contentItems, setPublicTab } = useApp();
  const { t } = useLang();

  const activities = contentItems
    .filter((c) => c.type === 'ACTIVITY' && c.is_published)
    .map((c) => ({ ...c, date: c.event_date || c.published_at }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcoming = activities.filter((a) => a.date >= todayISO());
  const featured = upcoming.find((a) => a.is_featured_event) || upcoming[0];
  const past = activities.filter((a) => !upcoming.includes(a) && a !== featured);
  const pastShown = condensed ? past.slice(0, 3) : past;

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      {showHeader && (
        <SectionHeader eyebrow={t.events.eyebrow} title={t.events.title} align="center" />
      )}

      <div className="mt-12 space-y-10">
        {/* Kartu unggulan */}
        {featured && (
          <Reveal>
            <div className="relative overflow-hidden rounded-[36px] bg-[#111111] text-white shadow-2xl">
              <img
                src={featured.bannerUrl}
                alt={featured.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
              <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="max-w-xl">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#FF416C] text-white text-[10px] font-black uppercase tracking-widest mb-3">
                    {t.events.featuredBadge}
                  </span>
                  <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                    {featured.title}
                  </h3>
                  {featured.subtitle && (
                    <p className="text-sm text-white/70 mt-2 leading-relaxed">{featured.subtitle}</p>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-white/80">
                    {(featured.event_date || featured.published_at) && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-[#FF416C]" />
                        {fmtDate(featured.event_date || featured.published_at)}
                      </span>
                    )}
                    {featured.location_detail && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#FF416C]" />
                        {featured.location_detail}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 space-y-3 self-start lg:self-end">
                  <Countdown />
                  <button
                    onClick={() => setPublicTab('join')}
                    className="w-full px-4 py-2.5 rounded-full bg-[#FF416C] hover:bg-[#ff2d5e] text-white text-xs font-black uppercase tracking-wider shadow-lg transition-colors"
                  >
                    {t.events.joinCta}
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* Garis waktu lampau */}
        {pastShown.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C8880] mb-5">
              {t.events.pastEyebrow}
            </p>
            <div
              className={`relative pl-6 space-y-${condensed ? '5' : '6'} before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D9D7D0]`}
            >
              {pastShown.map((a, i) => (
                <Reveal key={a.id} delay={i * 0.06}>
                  <div className="relative bg-white rounded-[24px] border border-[#D9D7D0]/50 p-5 hover:shadow-lg transition-shadow">
                    <span className="absolute -left-[22px] top-6 w-3 h-3 rounded-full border-[3px] border-[#FF416C] bg-white" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-black text-[#1B1B1B]">{a.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3F1EC] text-[#8C8880] shrink-0">
                        {fmtDate(a.date)}
                      </span>
                    </div>
                    {a.subtitle && <p className="text-xs text-[#8C8880] mt-1 line-clamp-2">{a.subtitle}</p>}
                    {a.category && (
                      <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF416C]/10 text-[#FF416C]">
                        {a.category}
                      </span>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {condensed && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setPublicTab('events')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#D9D7D0] bg-white hover:border-black text-xs font-bold transition-colors"
            >
              {t.events.viewAll}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
