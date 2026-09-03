import React from 'react';
import { CalendarClock, MessageCircle } from 'lucide-react';
import { EventVenueMap } from '../public/ui/EventVenueMap';

type Props = {
  whatsappGroupUrl?: string | null;
  eventDate?: string;
  venueName?: string;
  locationDetail?: string;
  mapUrl?: string | null;
  mapEmbedQuery?: string;
  compact?: boolean;
  onCompleteProfile?: () => void;
  checkInCode?: string | null;
  registeredAt?: string | null;
};

export const BakuTauWelcomeCard: React.FC<Props> = ({
  whatsappGroupUrl,
  eventDate = '2026-09-12T15:00:00+07:00',
  venueName = 'GMIM Eben Haezer Cikarang',
  locationDetail = 'Cikarang, Bekasi',
  mapUrl = 'https://share.google/Ro2jBSuGfrzfg49nP',
  mapEmbedQuery = 'GMIM Eben Haezer Cikarang, Cikarang, Bekasi',
  compact = false,
  onCompleteProfile,
  checkInCode,
  registeredAt,
}) => {
  const dateLabel = new Date(eventDate).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });

  return (
    <div className={`rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white ${compact ? 'p-4' : 'p-6'} space-y-4`}>
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-2">
          <CalendarClock className="w-3 h-3" />
          BAKU TAU 4.0
        </span>
        {!compact && (
          <h2 className="font-black text-[#1B1B1B] text-lg">
            Kamu sudah terdaftar!
          </h2>
        )}
        <p className={`text-xs text-[#8C8880] capitalize ${compact ? '' : 'mt-1'}`}>{dateLabel} WIB</p>
        <p className="text-xs text-[#5C5850] mt-2 leading-relaxed">
          Gabung grup WhatsApp peserta untuk info terbaru, carpool, dan pengumuman event.
        </p>
      </div>

      {!compact && (
        <EventVenueMap
          venueName={venueName}
          locationDetail={locationDetail}
          mapUrl={mapUrl}
          embedQuery={mapEmbedQuery}
          compact
        />
      )}

      {checkInCode && (
        <div className={`rounded-2xl border border-emerald-200 bg-white text-center space-y-2 ${compact ? 'p-3' : 'p-4'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
            QR daftar ulang hari H
          </p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${compact ? 120 : 180}x${compact ? 120 : 180}&ecc=M&data=${encodeURIComponent(checkInCode)}`}
            alt="QR daftar ulang BAKU TAU"
            width={compact ? 120 : 180}
            height={compact ? 120 : 180}
            className="mx-auto rounded-xl border border-emerald-100"
          />
          <p className="text-[10px] font-mono text-[#5C5850] break-all">{checkInCode}</p>
          {registeredAt && (
            <p className="text-[10px] text-[#8C8880]">
              Terdaftar {new Date(registeredAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </p>
          )}
          <p className="text-[10px] text-[#8C8880] leading-relaxed">
            Tunjukkan QR ini ke panitia saat daftar ulang di lokasi.
          </p>
        </div>
      )}

      {whatsappGroupUrl ? (
        <a
          href={whatsappGroupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Gabung Grup WhatsApp
        </a>
      ) : (
        <div className="rounded-2xl bg-white border border-dashed border-emerald-200 p-3 text-center">
          <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed">
            Link grup belum tersedia. Admin isi di Program & Event → Edit → Grup WhatsApp peserta, lalu refresh halaman ini.
          </p>
          <button
            type="button"
            disabled
            className="mt-2 w-full py-2.5 rounded-xl bg-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-wider cursor-not-allowed"
          >
            Gabung Grup WhatsApp
          </button>
        </div>
      )}

      {onCompleteProfile && (
        <button
          type="button"
          onClick={onCompleteProfile}
          className="w-full py-2.5 rounded-2xl border border-[#D9D7D0] bg-white text-[11px] font-bold text-[#5C5850] hover:border-[#1B1B1B] transition-colors"
        >
          Lengkapi profil dulu
        </button>
      )}
    </div>
  );
};
