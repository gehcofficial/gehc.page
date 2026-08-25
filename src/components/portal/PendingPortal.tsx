import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Countdown } from '../public/ui/Countdown';

interface EventDto {
  id: string;
  title: string;
  subtitle?: string | null;
  date?: string | null;
  locationDetail?: string | null;
  bannerUrl?: string | null;
}

/**
 * Portal TERBATAS untuk akun berstatus PENDING:
 * profil diri + info agenda terdekat. Menu penuh terbuka setelah
 * Komisi menyetujui pendaftaran.
 */
export const PendingPortal: React.FC = () => {
  const { authUser, setActiveView } = useApp();
  const [events, setEvents] = useState<EventDto[] | null>(null);
  const [giftDone, setGiftDone] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/events/upcoming')
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]));
    // status tes karunia dari /api/auth/me
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const g = d.user?.giftsTop5;
        setGiftDone(Array.isArray(g) && g.length > 0);
      })
      .catch(() => setGiftDone(null));
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        {/* Header */}
        <div className="rounded-[32px] bg-gradient-to-br from-[#181818] to-[#262626] p-7 text-white">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-3">
            <Clock className="w-3 h-3" /> Menunggu persetujuan Komisi
          </span>
          <h1 className="text-xl font-black leading-snug">
            Halo{authUser?.name ? `, ${authUser.name}` : ''}! 👋
          </h1>
          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            Pendaftaranmu sudah masuk. Panitia akan menyetujuinya segera —
            sambil menunggu, kamu sudah bisa melihat agenda & melengkapi profil.
          </p>
        </div>

        {/* Checklist onboarding */}
        <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-[#8C8880] mb-1">
            Langkahmu
          </p>
          <CheckRow done label="Daftar akun" />
          {giftDone === null ? (
            <CheckRow pending label="Cek status tes karunia…" />
          ) : giftDone ? (
            <CheckRow done label="Tes Karunia Rohani" />
          ) : (
            <GiftTestCTA onDone={() => setGiftDone(true)} />
          )}
          <CheckRow pending label="Persetujuan Komisi" last />
        </div>

        {/* Agenda terdekat */}
        <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#8C8880] flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-[#FF416C]" /> Agenda Terdekat
          </p>
          {(events || []).slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-2 border-b border-dashed border-[#D9D7D0]/50 last:border-0">
              <CalendarIcon date={e.date} color="#FF416C" />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{e.title}</p>
                {e.locationDetail && (
                  <p className="text-[10px] text-[#8C8880] truncate">{e.locationDetail}</p>
                )}
              </div>
            </div>
          ))}
          {(events || []).length === 0 && (
            <p className="text-[11px] text-[#8C8880]">Agenda akan diumumkan segera.</p>
          )}
        </div>

        <button
          onClick={() => {
            setActiveView('public');
            window.location.hash = '#/beyonders';
          }}
          className="w-full py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Kembali ke situs publik
        </button>
      </div>
    </div>
  );
};

const CheckRow: React.FC<{ done?: boolean; pending?: boolean; label: string; last?: boolean }> = ({
  done,
  pending,
  label,
  last,
}) => (
  <div className={`flex items-center gap-3 ${last ? '' : 'pb-3 border-b border-dashed border-[#D9D7D0]/40'}`}>
    {done ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
    ) : (
      <Circle className={`w-5 h-5 shrink-0 ${pending ? 'text-amber-400 animate-pulse' : 'text-gray-300'}`} />
    )}
    <span className={`text-sm font-semibold ${done ? 'text-[#1B1B1B]' : 'text-[#8C8880]'}`}>{label}</span>
  </div>
);

const GiftTestCTA: React.FC<{ onDone: () => void }> = ({ onDone }) => (
  <a
    href="#/join"
    onClick={(e) => {
      e.preventDefault();
      window.location.hash = '#/join';
      window.location.reload();
    }}
    className="block px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-[11px] font-black uppercase tracking-wider text-center"
  >
    Lengkapi Tes Karunia Sekarang
  </a>
);

const CalendarIcon: React.FC<{ date?: string | null; color: string }> = ({ date, color }) => {
  const d = date ? new Date(date) : null;
  return (
    <div className="w-10 h-10 rounded-xl border shrink-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ borderColor: `${color}44` }}>
      <span className="text-[7px] font-black uppercase leading-none mt-0.5"
        style={{ color }}>
        {d ? d.toLocaleDateString('id-ID', { month: 'short' }) : 'TBA'}
      </span>
      <span className="text-xs font-black leading-none">{d ? d.getDate() : '?'}</span>
    </div>
  );
};
