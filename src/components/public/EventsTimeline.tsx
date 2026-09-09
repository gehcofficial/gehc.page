import React, { useEffect, useState } from 'react';
import { CalendarDays, MapPin, ArrowRight, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { SectionHeader, Reveal } from './ui/SectionHeader';
import { Countdown } from './ui/Countdown';
import { EventVenueMap } from './ui/EventVenueMap';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { eventDayState } from '../../lib/event-dates';

const todayISO = () => new Date().toISOString().slice(0, 10);

type LandingVenue = {
  venueName?: string;
  locationDetail?: string;
  mapUrl?: string;
  mapEmbedQuery?: string;
  eventDate?: string;
  status?: string;
  slug?: string;
};

type LandingFull = {
  id: string;
  title: string;
  subtitle?: string;
  bannerUrl?: string;
  category?: string;
  location_detail?: string;
  event_date?: string;
  published_at?: string;
  is_featured_event?: boolean;
  venue?: LandingVenue | null;
  isBakutau?: boolean;
  stats?: { registered?: number } | null;
};

type LandingCompact = {
  id: string;
  name: string;
  status: string;
  kind?: string;
  eventDate?: string;
};

/**
 * EVENTS TIMELINE [home] — 3 lapis dari /api/events/landing:
 * full = konten terbit (+venue event), compact = event bertanggal tanpa
 * konten terbit, DONE/ARSIP tidak tampil. Versi penuh ada di tab Kegiatan.
 */
export const EventsTimeline: React.FC<{ condensed?: boolean; showHeader?: boolean }> = ({
  condensed = true,
  showHeader = true,
}) => {
  const { contentItems, setPublicTab } = useApp();
  const { t } = useLang();
  const slots = useMediaSlots();
  const [full, setFull] = useState<LandingFull[]>([]);
  const [compact, setCompact] = useState<LandingCompact[]>([]);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [eventClosed, setEventClosed] = useState(false);

  useEffect(() => {
    fetch('/api/events/landing')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFull(d.full || []);
        setCompact(d.compact || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!full.some((f) => f.isBakutau)) return;
    fetch('/api/events/bakutau')
      .then((r) => r.json())
      .then((d) => {
        setRegisteredCount(d.stats?.registered ?? null);
        setEventClosed(d.status === 'ARCHIVED');
      })
      .catch(() => {});
  }, [full]);

  const activities = contentItems
    .filter((c) => c.type === 'ACTIVITY' && c.is_published)
    .map((c) => ({ ...c, date: c.event_date || c.published_at }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcoming = activities.filter((a) => a.date >= todayISO());
  const featured = full.find((f) => f.is_featured_event) || full.find((f) => f.isBakutau) || full[0] || null;
  const restFull = featured ? full.filter((f) => f.id !== featured.id) : [];
  const past = activities.filter((a) => !upcoming.includes(a));
  const pastShown = condensed ? past.slice(0, 3) : past;

  const fmtDate = (iso?: string) =>
    iso
      ? new Date(iso.includes('T') ? iso : `${iso}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      : '—';

  const fmtWib = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      })
      : null;

  const cardDate = (item: LandingFull) => {
    if (item.venue?.eventDate) return `${fmtWib(item.venue.eventDate)} WIB`;
    return fmtDate(item.event_date || item.published_at);
  };

  const cardLocation = (item: LandingFull) =>
    item.location_detail || item.venue?.locationDetail || null;

  const cardBanner = (item: LandingFull) =>
    item.id === 'cnt-bakutau'
      ? slots.kegiatan.bakuTau || item.bannerUrl || slots.kegiatan.bannerDefault
      : item.bannerUrl || slots.kegiatan.bannerDefault;

  const renderFullCard = (item: LandingFull) => {
    const isBakutau = item.isBakutau;
    const count = isBakutau ? registeredCount : (item.stats?.registered ?? null);
    const showStats = count !== null;
    const closed = (isBakutau && eventClosed) || item.venue?.status === 'ARCHIVED';
    // Badge mengikuti tanggal WIB: hari-H → hijau, selain itu "Akan Datang".
    const happening = eventDayState(item.venue?.eventDate || item.event_date) === 'today';
    return (
      <div key={item.id} className="relative overflow-hidden rounded-[36px] bg-[#111111] text-white shadow-2xl">
        <img
          src={cardBanner(item)}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
        <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-xl">
            {happening ? (
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-3">
                {t.events.happeningToday}
              </span>
            ) : (
              <span className="inline-block px-3 py-1 rounded-full bg-[#FF416C] text-white text-[10px] font-black uppercase tracking-widest mb-3">
                {t.events.featuredBadge}
              </span>
            )}
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {item.title}
            </h3>
            {item.subtitle && (
              <p className="text-sm text-white/70 mt-2 leading-relaxed">{item.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-white/80">
              <span className="flex items-center gap-1.5 capitalize">
                <CalendarDays className="w-3.5 h-3.5 text-[#FF416C]" />
                {cardDate(item)}
              </span>
              {cardLocation(item) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF416C]" />
                  {cardLocation(item)}
                </span>
              )}
            </div>
            {item.venue?.venueName && (
              <div className="mt-5 rounded-2xl overflow-hidden border border-white/10 bg-black/30 p-3">
                <EventVenueMap
                  venueName={item.venue.venueName}
                  locationDetail={item.venue.locationDetail}
                  mapUrl={item.venue.mapUrl}
                  embedQuery={item.venue.mapEmbedQuery}
                  compact
                  inverted
                />
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-3 self-start lg:self-end">
            {!closed && item.venue?.eventDate && <Countdown targetIso={item.venue.eventDate} />}
            {showStats && (
              <p className="text-[10px] font-bold text-white/70 flex items-center gap-1.5 justify-center">
                <Users className="w-3.5 h-3.5" /> {count} peserta terdaftar
              </p>
            )}
            {!closed && item.venue?.slug && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setPublicTab('event-signup', { eventSlug: isBakutau ? 'bakutau' : item.venue!.slug! });
                  }}
                  className="w-full px-4 py-2.5 rounded-full bg-[#FF416C] hover:bg-[#ff2d5e] text-white text-xs font-black uppercase tracking-wider shadow-lg transition-colors"
                >
                  {t.events.joinCta}
                </button>
              </div>
            )}
            {closed && (
              <p className="text-[10px] font-bold text-white/50 text-center uppercase tracking-wider">
                Pendaftaran ditutup
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      {showHeader && (
        <SectionHeader eyebrow={t.events.eyebrow} title={t.events.title} align="center" />
      )}

      <div className="mt-12 space-y-10">
        {/* Kartu penuh */}
        {featured && (
          <div className="space-y-6">
            {renderFullCard(featured)}
            {restFull.map((item) => renderFullCard(item))}
          </div>
        )}

        {/* Kartu kompak: event rutin bertanggal tanpa konten terbit */}
        {compact.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8C8880] mb-5">
              Ibadah & agenda rutin
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {compact.map((e, i) => (
                <Reveal key={e.id} delay={i * 0.05}>
                  <div className="h-full bg-white rounded-[24px] border border-[#D9D7D0]/50 p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-black text-[#1B1B1B] leading-snug">{e.name}</h4>
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF416C]/10 text-[#FF416C]">
                        {e.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8C8880] mt-2 flex items-center gap-1.5 capitalize">
                      <CalendarDays className="w-3.5 h-3.5 text-[#FF416C]" />
                      {fmtDate(e.eventDate)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
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
