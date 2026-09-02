import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BakuTauWelcomeCard } from './BakuTauWelcomeCard';
import { EventVenueMap } from '../public/ui/EventVenueMap';

export const EventInfoPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bakuTau, setBakuTau] = useState<{
    registered: boolean;
    whatsappGroupUrl?: string | null;
    eventDate?: string;
    venueName?: string;
    locationDetail?: string;
    mapUrl?: string | null;
    mapEmbedQuery?: string;
    checkInCode?: string | null;
    registeredAt?: string | null;
  } | null>(null);
  const [stats, setStats] = useState<{ registered?: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/me/baku-tau-registration', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/events/bakutau').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([reg, ev]) => {
        setBakuTau({
          registered: reg.registered,
          whatsappGroupUrl: reg.registered ? (reg.whatsappGroupUrl || null) : null,
          eventDate: reg.eventDate || ev.eventDate,
          venueName: reg.venueName || ev.venueName,
          locationDetail: reg.locationDetail || ev.locationDetail,
          mapUrl: reg.mapUrl || ev.mapUrl,
          mapEmbedQuery: reg.mapEmbedQuery || ev.mapEmbedQuery,
          checkInCode: reg.checkInCode || null,
          registeredAt: reg.registeredAt || null,
        });
        setStats(ev.stats || null);
      })
      .catch(() => setBakuTau(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat info event…
      </div>
    );
  }

  const eventDateLabel = bakuTau?.eventDate
    ? new Date(bakuTau.eventDate).toLocaleString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#FF416C] mb-1">BAKU TAU 4.0</p>
        <h2 className="text-2xl font-black tracking-tight">Info Event</h2>
        <p className="text-sm text-[#8C8880] mt-2 leading-relaxed">
          Pengumuman, lokasi, dan grup WhatsApp peserta. Portal ini terbuka selama onboarding — lengkapi profil untuk akses fitur mentoring penuh.
        </p>
        {stats?.registered != null && (
          <p className="text-xs font-bold text-[#1B1B1B] mt-3">{stats.registered} peserta terdaftar</p>
        )}
      </div>

      {bakuTau?.registered ? (
        <BakuTauWelcomeCard
          whatsappGroupUrl={bakuTau.whatsappGroupUrl}
          eventDate={bakuTau.eventDate}
          venueName={bakuTau.venueName}
          locationDetail={bakuTau.locationDetail}
          mapUrl={bakuTau.mapUrl}
          mapEmbedQuery={bakuTau.mapEmbedQuery}
          checkInCode={bakuTau.checkInCode}
          registeredAt={bakuTau.registeredAt}
        />
      ) : (
        <div className="rounded-[28px] border border-dashed border-[#D9D7D0] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[#1B1B1B]">Belum terdaftar kehadiran</p>
          <p className="text-xs text-[#8C8880] mt-1">Daftar dulu di halaman event publik.</p>
          <a
            href="#/event/bakutau"
            onClick={(e) => { e.preventDefault(); window.location.hash = '#/event/bakutau'; }}
            className="inline-block mt-4 px-4 py-2 rounded-full bg-[#FF416C] text-white text-xs font-black uppercase"
          >
            Daftar Kehadiran
          </a>
        </div>
      )}

      {!bakuTau?.registered && bakuTau?.venueName && (
        <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6">
          {eventDateLabel && (
            <p className="text-xs font-bold text-[#1B1B1B] mb-3 capitalize">{eventDateLabel} WIB</p>
          )}
          <EventVenueMap
            venueName={bakuTau.venueName}
            locationDetail={bakuTau.locationDetail}
            mapUrl={bakuTau.mapUrl}
            embedQuery={bakuTau.mapEmbedQuery}
            compact
          />
        </div>
      )}
    </div>
  );
};
