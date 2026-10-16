import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, MapPin, ArrowRight, Users, Clock3, Presentation, HandHeart, Home } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { SectionHeader, Reveal } from './ui/SectionHeader';
import { EventsLandingSkeleton } from './ui/Skeleton';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { Countdown } from './ui/Countdown';
import { EventVenueMap } from './ui/EventVenueMap';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { eventDayState, splitThemeDate, fmtTimeWib } from '../../lib/event-dates';

const todayISO = () => new Date().toISOString().slice(0, 10);

type LandingVenue = {
  venueName?: string;
  locationDetail?: string;
  mapUrl?: string;
  mapEmbedQuery?: string;
  eventDate?: string;
  status?: string;
  slug?: string;
  eventId?: string;
  serviceType?: string | null;
  kind?: string | null;
};

type LandingWorship = {
  patternCode?: string | null;
  patternName?: string | null;
  sessionTitle?: string | null;
  status?: string | null;
};

type LandingServing = {
  responsible?: string | null;
  host?: string | null;
  projected?: boolean;
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
  worship?: LandingWorship | null;
  serving?: LandingServing | null;
};

type LandingCompact = {
  id: string;
  name: string;
  status: string;
  kind?: string;
  eventDate?: string;
};

/**
 * Box tengah kartu penuh: Pola Ibadah + grup serving (tanpa nama petugas).
 * - SERVING_DAY → Penanggung + Tuan Rumah (nama grup saja).
 * - MENTORING_DAY → "Komisi + Tim Kerja" (label saja).
 * - BAKUTAU → null (tidak tampil).
 * Fallback: bila landing belum bawa serving nyata, ambil proyeksi publik
 * /api/db/service-schedule?from=day&to=day (sudah termasuk "(perkiraan)").
 */
const EventMiddleInfo: React.FC<{ item: LandingFull }> = ({ item }) => {
  const serviceType = String(item.venue?.serviceType || '').toUpperCase();
  const isMentoring = serviceType === 'MENTORING_DAY';
  const isServing = serviceType === 'SERVING_DAY';
  const worship = item.worship || null;
  const [fallback, setFallback] = useState<LandingServing | null>(null);

  const eventIso = item.venue?.eventDate || item.event_date || null;
  const dayKey = (() => {
    if (!eventIso) return null;
    const t = new Date(eventIso).getTime();
    if (Number.isNaN(t)) return null;
    return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
  })();

  useEffect(() => {
    if (item.isBakutau || !isServing || item.serving || !dayKey) return;
    let cancelled = false;
    fetch(`/api/db/service-schedule?from=${dayKey}&to=${dayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const s = (d.serving || {})[dayKey] as LandingServing | undefined;
        if (s && (s.responsible || s.host)) setFallback(s);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [item.isBakutau, isServing, item.serving, dayKey]);

  if (item.isBakutau) return null;
  const serving = item.serving || fallback;
  const showWorship = Boolean(worship?.patternName || worship?.patternCode);
  const showBox = showWorship || isServing || isMentoring || Boolean(serving?.responsible || serving?.host);
  if (!showBox) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-md p-4 sm:p-5 space-y-3 min-w-0">
      {showWorship && (
        <div className="flex items-start gap-2">
          <Presentation className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Pola Ibadah</p>
            <p className="text-sm font-black text-white leading-snug truncate">
              {worship?.patternName || worship?.patternCode}
            </p>
            {worship?.sessionTitle && (
              <p className="text-[11px] text-white/60 leading-snug line-clamp-2">{worship.sessionTitle}</p>
            )}
          </div>
        </div>
      )}
      {isMentoring ? (
        <div className="flex items-start gap-2">
          <HandHeart className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Penanggung Jawab</p>
            <p className="text-xs font-bold text-white/90">Komisi + Tim Kerja</p>
          </div>
        </div>
      ) : (serving?.responsible || serving?.host) ? (
        <div className="space-y-2">
          {serving?.responsible && (
            <div className="flex items-start gap-2">
              <HandHeart className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Penanggung Jawab</p>
                <p className="text-xs font-bold text-white/90 truncate">
                  {serving.responsible}
                  {serving.projected ? <span className="font-normal text-white/50"> (perkiraan)</span> : null}
                </p>
              </div>
            </div>
          )}
          {serving?.host && (
            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Tuan Rumah</p>
                <p className="text-xs font-bold text-white/90 truncate">
                  {serving.host}
                  {serving.projected ? <span className="font-normal text-white/50"> (perkiraan)</span> : null}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
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
  const { contentItems, setPublicTab, ensureContent } = useApp();
  const { t } = useLang();
  const [landingLoading, setLandingLoading] = useState(true);
  useEffect(() => { void ensureContent(); }, [ensureContent]);
  const slots = useMediaSlots();
  const [full, setFull] = useState<LandingFull[]>([]);
  const [compact, setCompact] = useState<LandingCompact[]>([]);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [eventClosed, setEventClosed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadLanding = () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLandingLoading(true);
    fetch('/api/events/landing', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setFull(d.full || []);
        setCompact(d.compact || []);
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLandingLoading(false); });
  };

  useEffect(() => {
    loadLanding();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const past = activities.filter((a) => !upcoming.includes(a));
  const pastShown = condensed ? past.slice(0, 3) : past;

  // Kartu penuh mengikuti event yang masih berjalan / akan datang; arsip & selesai dilewati.
  const fullDate = (item: LandingFull) => item.venue?.eventDate || item.event_date || item.published_at || null;
  const fullHidden = (item: LandingFull) => ['ARCHIVED', 'DONE'].includes(String(item.venue?.status || '').toUpperCase());
  const fullTime = (item: LandingFull) => {
    const d = fullDate(item);
    const t = d ? new Date(d).getTime() : NaN;
    return Number.isNaN(t) ? Infinity : t;
  };
  const fullCards = full.filter((f) => !fullHidden(f)).sort((a, b) => fullTime(a) - fullTime(b));
  const featured = fullCards[0] || null;
  const restFull = featured ? fullCards.filter((f) => f.id !== featured.id) : [];

  const fmtDate = (iso?: string) =>
    iso
      ? new Date(iso.includes('T') ? iso : `${iso}T00:00:00`).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      : '—';

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
    // Badge mengikuti tanggal WIB: hari-H ? hijau, selain itu "Akan Datang".
    const happening = eventDayState(item.venue?.eventDate || item.event_date) === 'today';
    // Judul dipecah: tema (h3) + tanggal (baris 2) agar tidak gantung "17".
    const { theme } = splitThemeDate(item.title);
    const eventIso = item.venue?.eventDate || item.event_date || item.published_at || null;
    const timeOnly = fmtTimeWib(item.venue?.eventDate || null);
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
        <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row gap-6 lg:gap-8">
          <div className="flex-1 min-w-0 max-w-xl">
            {happening ? (
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-3">
                {t.events.happeningToday}
              </span>
            ) : (
              <span className="inline-block px-3 py-1 rounded-full bg-brand text-white text-[10px] font-black uppercase tracking-widest mb-3">
                {t.events.featuredBadge}
              </span>
            )}
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight text-balance">
              {theme}
            </h3>
            {eventIso && (
              <p className="text-sm sm:text-base font-bold text-white/90 mt-1.5 capitalize flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-brand shrink-0" />
                {fmtDate(eventIso)}
              </p>
            )}
            {item.subtitle && (
              <p className="text-sm text-white/70 mt-2 leading-relaxed">{item.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-white/80">
              {timeOnly ? (
                <span className="flex items-center gap-1.5">
                  <Clock3 className="w-3.5 h-3.5 text-brand" />
                  {timeOnly}
                </span>
              ) : null}
              {cardLocation(item) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
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

          <div className="flex-1 min-w-0 lg:max-w-xs self-start lg:self-center">
            <EventMiddleInfo item={item} />
          </div>

          <div className="shrink-0 lg:w-60 space-y-3 self-start lg:self-end">
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
                  className="w-full px-4 py-2.5 rounded-full bg-brand hover:bg-[#ff2d5e] text-white text-xs font-black uppercase tracking-wider shadow-lg transition-colors"
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
        {landingLoading ? (
          <div className="relative">
            <EventsLandingSkeleton />
            <LoadingOverlay
              variant="section"
              kind="events"
              timeoutMs={15000}
              onTimeout={() => abortRef.current?.abort()}
              onRetry={loadLanding}
            />
          </div>
        ) : (
          <>
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
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                        {e.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8C8880] mt-2 flex items-center gap-1.5 capitalize">
                      <CalendarDays className="w-3.5 h-3.5 text-brand" />
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
                    <span className="absolute -left-[22px] top-6 w-3 h-3 rounded-full border-[3px] border-brand bg-white" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-black text-[#1B1B1B]">{a.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3F1EC] text-[#8C8880] shrink-0">
                        {fmtDate(a.date)}
                      </span>
                    </div>
                    {a.subtitle && <p className="text-xs text-[#8C8880] mt-1 line-clamp-2">{a.subtitle}</p>}
                    {a.category && (
                      <span className="inline-block mt-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand">
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
          </>
        )}
      </div>
    </section>
  );
};

