import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, CalendarDays, MessageCircle, ArrowRight } from 'lucide-react';
import { BakuTauWelcomeCard } from './BakuTauWelcomeCard';
import { EventThankYouCard } from './EventThankYouCard';
import { EventDidaskaliaMaterials } from './EventDidaskaliaMaterials';
import { EventVenueMap } from '../public/ui/EventVenueMap';
import { EventProfileCompleteCard } from './EventProfileCompleteCard';
import { EventSelfAnswersCard } from './EventSelfAnswersCard';
import { parseHashSearch, parsePortalHash } from '../../lib/portal-routes';

const BAKU_TAU_EVENT_ID = 'evt-baku-tau-4-0';

type EvInfo = {
  id: string;
  slug?: string | null;
  name: string;
  status?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  locationDetail?: string | null;
  mapUrl?: string | null;
  mapEmbedQuery?: string | null;
  whatsappGroupUrl?: string | null;
  stats?: { registered?: number } | null;
  kind?: string | null;
  serviceType?: string | null;
};

type RegInfo = {
  registered?: boolean;
  attended?: boolean;
  checkedInAt?: string | null;
  eventStatus?: string | null;
  givenName?: string | null;
  checkInCode?: string | null;
  registeredAt?: string | null;
  whatsappGroupUrl?: string | null;
  eventDate?: string | null;
  venueName?: string | null;
  locationDetail?: string | null;
  mapUrl?: string | null;
  mapEmbedQuery?: string | null;
};

function currentEventKey(): string | null {
  try {
    return parseHashSearch(window.location.hash).get('event');
  } catch {
    return null;
  }
}

function currentPortalNs(): string {
  try {
    const r = parsePortalHash(window.location.hash);
    if (r?.namespace && r.namespace !== 'account') return r.namespace;
  } catch { /* abaikan */ }
  return 'mentee';
}

/** Event terdekat: upcoming terdekat; event ibadah diprioritaskan bila tanggalnya sama. */
function pickNearest(events: EvInfo[]): EvInfo | null {
  const dated = events.filter((e) => e.eventDate && !Number.isNaN(new Date(e.eventDate).getTime()));
  if (!dated.length) return events[0] || null;
  const now = Date.now();
  const upcoming = dated
    .filter((e) => new Date(e.eventDate as string).getTime() >= now - 12 * 3600 * 1000)
    .sort((a, b) => new Date(a.eventDate as string).getTime() - new Date(b.eventDate as string).getTime());
  if (upcoming.length) {
    const firstDay = String(upcoming[0].eventDate).slice(0, 10);
    const sameDay = upcoming.filter((e) => String(e.eventDate).slice(0, 10) === firstDay);
    return sameDay.find((e) => e.serviceType === 'MENTORING_DAY' || e.serviceType === 'SERVING_DAY') || sameDay[0];
  }
  return dated.sort((a, b) => new Date(b.eventDate as string).getTime() - new Date(a.eventDate as string).getTime())[0];
}

const STATUS_LABEL: Record<string, string> = { PLANNING: 'Direncanakan', ACTIVE: 'Aktif', DONE: 'Selesai', ARCHIVED: 'Arsip' };

export const EventInfoPanel: React.FC = () => {
  const [eventKey, setEventKey] = useState<string | null>(() => currentEventKey());
  const [ev, setEv] = useState<EvInfo | null>(null);
  const [reg, setReg] = useState<RegInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onHash = () => setEventKey(currentEventKey());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      let target: EvInfo | null = null;
      if (eventKey) {
        const r = await fetch(`/api/events/${encodeURIComponent(eventKey)}`, { credentials: 'include' });
        if (r.ok) target = await r.json();
      }
      if (!target) {
        const r = await fetch('/api/events', { credentials: 'include' });
        const d = await r.json().catch(() => ({}));
        target = pickNearest((d.events || []) as EvInfo[]);
      }
      setEv(target);
      if (target?.id) {
        const rr = await fetch(`/api/me/events/${target.id}/registration`, { credentials: 'include' });
        setReg(rr.ok ? await rr.json() : null);
      } else {
        setReg(null);
      }
      if (!target) setError('Belum ada event terdekat untuk ditampilkan.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat info event');
      setEv(null);
      setReg(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventKey]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat info event…
      </div>
    );
  }

  if (!ev) {
    return (
      <div className="rounded-[28px] border border-dashed border-[#D9D7D0] bg-white p-6 text-center max-w-2xl">
        <p className="text-sm font-bold text-[#1B1B1B]">Belum ada event</p>
        <p className="text-xs text-[#8C8880] mt-1">{error || 'Event akan muncul di sini begitu dijadwalkan.'}</p>
      </div>
    );
  }

  const statusUp = String(reg?.eventStatus || ev.status || '').toUpperCase();
  const isDone = statusUp === 'DONE' || statusUp === 'ARCHIVED';
  const isBaku = ev.id === BAKU_TAU_EVENT_ID || ev.slug === 'bakutau' || ev.slug === 'baku-tau-4-0';
  const registered = Boolean(reg?.registered);
  const attended = Boolean(reg?.attended);
  const eventDate = ev.eventDate || reg?.eventDate || null;
  const venueName = reg?.venueName || ev.venueName || '';
  const locationDetail = reg?.locationDetail || ev.locationDetail || '';
  const mapUrl = reg?.mapUrl || ev.mapUrl || null;
  const mapEmbedQuery = reg?.mapEmbedQuery || ev.mapEmbedQuery || '';
  const whatsapp = (isDone ? null : (reg?.whatsappGroupUrl || ev.whatsappGroupUrl)) || null;
  const stats = ev.stats?.registered;

  const eventDateLabel = eventDate
    ? new Date(eventDate).toLocaleString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
      })
    : null;

  const goAgenda = () => { window.location.hash = `#/portal/${currentPortalNs()}/kegiatan`; };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-1">
              {isBaku ? 'BAKU TAU 4.0' : 'Info Event'}
            </p>
            <h2 className="text-2xl font-black tracking-tight">{ev.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] font-bold text-[#8C8880]">
                {STATUS_LABEL[statusUp] || statusUp || 'Event'}
              </span>
              {eventDateLabel && (
                <span className="text-xs font-bold text-[#1B1B1B] flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> {eventDateLabel} WIB
                </span>
              )}
            </div>
            {stats != null && <p className="text-xs font-bold text-[#1B1B1B] mt-3">{stats} peserta terdaftar</p>}
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[#8C8880] hover:bg-[#F3F1EC] disabled:opacity-40"
            title="Muat ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Pasca-event: ucapan terima kasih, tanpa QR */}
      {isDone ? (
        <EventThankYouCard
          eventName={ev.name}
          eventDate={eventDate}
          givenName={reg?.givenName || null}
          attended={attended}
          checkedInAt={reg?.checkedInAt || null}
          registered={registered}
          onBrowseAgenda={goAgenda}
        />
      ) : registered ? (
        <>
          {eventDate ? (
            <BakuTauWelcomeCard
              eventName={ev.name}
              whatsappGroupUrl={whatsapp}
              eventDate={eventDate}
              venueName={venueName || undefined}
              locationDetail={locationDetail || undefined}
              mapUrl={mapUrl}
              mapEmbedQuery={mapEmbedQuery || undefined}
              checkInCode={reg?.checkInCode || null}
              registeredAt={reg?.registeredAt || null}
            />
          ) : (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm font-black text-emerald-800">Kamu terdaftar di {ev.name}</p>
              <p className="text-xs text-emerald-700 mt-1">Detail jadwal & QR menyusul dari panitia.</p>
            </div>
          )}
          {isBaku && (
            <>
              <EventProfileCompleteCard
                initial={null}
                onSaved={() => { /* profil diperbarui di tempat lain */ }}
              />
              <EventSelfAnswersCard eventId={ev.id} />
            </>
          )}
        </>
      ) : (
        <div className="rounded-[28px] border border-dashed border-[#D9D7D0] bg-white p-6 text-center space-y-3">
          <p className="text-sm font-bold text-[#1B1B1B]">{isBaku ? 'Belum terdaftar kehadiran BAKU TAU' : 'Belum terdaftar'}</p>
          <p className="text-xs text-[#8C8880] leading-relaxed">
            {isBaku
              ? 'QR dan tombol grup WhatsApp muncul setelah Anda daftar kehadiran (bukan hanya membuat akun).'
              : 'Pendaftaran/kehadiran untuk event ini dikelola panitia. Lihat agenda mendatang untuk ikut serta.'}
          </p>
          {isBaku ? (
            <a
              href="#/event/bakutau"
              onClick={(e) => { e.preventDefault(); window.location.hash = '#/event/bakutau'; }}
              className="inline-block px-4 py-2 rounded-full bg-[#FF416C] text-white text-xs font-black uppercase"
            >
              Daftar Kehadiran
            </a>
          ) : (
            <button
              type="button"
              onClick={goAgenda}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B1B1B] text-white text-xs font-black uppercase"
            >
              Lihat Agenda Mendatang <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Venue + peta */}
      {venueName && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6">
          <EventVenueMap
            venueName={venueName}
            locationDetail={locationDetail}
            mapUrl={mapUrl}
            embedQuery={mapEmbedQuery}
            compact
          />
          {whatsapp && isDone && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider"
            >
              <MessageCircle className="w-4 h-4" /> Grup WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Materi Didaskalia event ini */}
      <EventDidaskaliaMaterials eventId={ev.id} eventName={ev.name} />
    </div>
  );
};
