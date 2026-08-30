import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, LogOut, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MyProfilePanel } from './MyProfilePanel';

/**
 * Portal TERBATAS untuk akun berstatus WAITING_POOL:
 * profil diri + gift test. Akses terbatas sampai lengkapi profil
 * dan menunggu role assignment dari admin.
 */
export const RestrictedPortal: React.FC = () => {
  const { authUser, setActiveView } = useApp();
  const [giftDone, setGiftDone] = useState<boolean | null>(null);
  const [profileDone, setProfileDone] = useState<boolean | null>(null);
  const [openGifts, setOpenGifts] = useState(false);

  const refreshStatus = () => {
    fetch('/api/me/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setGiftDone(Boolean(d.segments?.gifts) || (Array.isArray(d.user?.giftsTop5) && d.user.giftsTop5.length > 0));
        setProfileDone(Boolean(d.segments?.contact));
      })
      .catch(() => {
        setGiftDone(null);
        setProfileDone(null);
      });
  };

  useEffect(() => { refreshStatus(); }, []);

  const steps = [
    { key: 'register', label: 'Daftar akun', done: true },
    { key: 'profile', label: 'Lengkapi profil', done: profileDone ?? false, pending: profileDone === null },
    { key: 'gift', label: 'Tes Karunia Rohani', done: giftDone ?? false, pending: giftDone === null },
    { key: 'role', label: 'Role assignment oleh admin', done: false, pending: true },
  ];

  const allDone = steps.every((s) => s.done);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-5">
        <div className="rounded-[32px] bg-gradient-to-br from-[#181818] to-[#262626] p-7 text-white">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-3">
            <Clock className="w-3 h-3" /> Menunggu Penugasan
          </span>
          <h1 className="text-xl font-black leading-snug">
            Halo{authUser?.name ? `, ${authUser.name}` : ''}! 👋
          </h1>
          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            Selamat datang di GEHC Youth Portal! Kamu sudah terdaftar.
            Lengkapi profil dan tes karunia rohani, lalu admin akan menetapkan role kamu.
          </p>
        </div>

        <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-[#8C8880] mb-1">
            Status Onboarding
          </p>
          {steps.map((s) => (
            <div key={s.key} className={`flex items-center gap-3 ${s.key === 'role' ? '' : 'pb-3 border-b border-dashed border-[#D9D7D0]/40'}`}>
              {s.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className={`w-5 h-5 shrink-0 ${s.pending ? 'text-amber-400 animate-pulse' : 'text-gray-300'}`} />
              )}
              <span className={`text-sm font-semibold ${s.done ? 'text-[#1B1B1B]' : 'text-[#8C8880]'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {!giftDone && giftDone !== null && (
          <button
            type="button"
            onClick={() => setOpenGifts(true)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Mulai Tes Karunia Rohani
          </button>
        )}

        {allDone && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-emerald-700">Profil dan tes karunia sudah lengkap!</p>
            <p className="text-[10px] text-emerald-600 mt-1">Admin akan segera menetapkan role kamu.</p>
          </div>
        )}

        <MyProfilePanel
          defaultOpenSection={openGifts ? 'gifts' : undefined}
          onGiftSaved={() => {
            setOpenGifts(false);
            refreshStatus();
          }}
        />

        <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6">
          <p className="text-xs font-black uppercase tracking-widest text-[#8C8880] flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-[#FF416C]" /> Apa Selanjutnya?
          </p>
          <div className="space-y-2 text-xs text-[#8C8880] leading-relaxed">
            <p>1. Lengkapi profil dan tes karunia rohani di atas.</p>
            <p>2. Admin Komisi akan meninjau dan menetapkan role kamu.</p>
            <p>3. Setelah role ditetapkan, kamu akan mendapat akses penuh ke portal.</p>
          </div>
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
