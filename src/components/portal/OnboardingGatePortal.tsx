import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, LogOut, Sparkles, Cake } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MyProfilePanel } from './MyProfilePanel';

type GateMode = 'WAITING_POOL' | 'PENDING';

/**
 * Portal terbatas untuk newcomer: WAITING_POOL (profil + karunia) atau PENDING (menunggu approval akun).
 */
export const OnboardingGatePortal: React.FC<{ mode: GateMode }> = ({ mode }) => {
  const { authUser, setActiveView } = useApp();
  const [giftDone, setGiftDone] = useState<boolean | null>(null);
  const [profileDone, setProfileDone] = useState<boolean | null>(null);
  const [birthDone, setBirthDone] = useState<boolean | null>(null);
  const [openGifts, setOpenGifts] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; title: string; date?: string | null; locationDetail?: string | null }>>([]);

  const refreshStatus = () => {
    fetch('/api/me/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setGiftDone(Boolean(d.segments?.gifts) || (Array.isArray(d.user?.giftsTop5) && d.user.giftsTop5.length > 0));
        setProfileDone(Boolean(d.segments?.contact));
        setBirthDone(Boolean(d.segments?.birthDate) || Boolean(d.user?.birthDate));
      })
      .catch(() => {
        setGiftDone(null);
        setProfileDone(null);
        setBirthDone(null);
      });
  };

  useEffect(() => {
    refreshStatus();
    if (mode === 'PENDING') {
      fetch('/api/events/upcoming')
        .then((r) => r.json())
        .then((d) => setEvents(d.events || []))
        .catch(() => setEvents([]));
    }
  }, [mode]);

  const isWaitingPool = mode === 'WAITING_POOL';

  const steps = isWaitingPool
    ? [
        { key: 'register', label: 'Daftar akun', done: true },
        { key: 'birth', label: 'Tanggal lahir', done: birthDone ?? false, pending: birthDone === null },
        { key: 'profile', label: 'Lengkapi profil', done: profileDone ?? false, pending: profileDone === null },
        { key: 'gift', label: 'Tes Karunia Rohani', done: giftDone ?? false, pending: giftDone === null },
        { key: 'role', label: 'Role assignment oleh admin', done: false, pending: true },
      ]
    : [
        { key: 'register', label: 'Daftar akun', done: true },
        { key: 'approval', label: 'Persetujuan Komisi', done: false, pending: true },
      ];

  const profileComplete = isWaitingPool && (profileDone && giftDone && birthDone);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-5">
        <div className="rounded-[32px] bg-gradient-to-br from-[#181818] to-[#262626] p-7 text-white">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-3">
            <Clock className="w-3 h-3" />
            {isWaitingPool ? 'Menunggu Penugasan' : 'Menunggu Persetujuan Komisi'}
          </span>
          <h1 className="text-xl font-black leading-snug">
            Halo{authUser?.name ? `, ${authUser.name}` : ''}! 👋
          </h1>
          <p className="text-xs text-white/60 mt-2 leading-relaxed">
            {isWaitingPool
              ? 'Lengkapi tanggal lahir, profil, dan tes karunia. Admin akan menetapkan role kamu setelah semua lengkap.'
              : 'Pendaftaranmu sudah masuk. Panitia akan menyetujuinya segera — sambil menunggu, lihat agenda terdekat.'}
          </p>
        </div>

        <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-[#8C8880] mb-1">Status Onboarding</p>
          {steps.map((s, i) => (
            <div key={s.key} className={`flex items-center gap-3 ${i < steps.length - 1 ? 'pb-3 border-b border-dashed border-[#D9D7D0]/40' : ''}`}>
              {s.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className={`w-5 h-5 shrink-0 ${s.pending ? 'text-amber-400 animate-pulse' : 'text-gray-300'}`} />
              )}
              <span className={`text-sm font-semibold ${s.done ? 'text-[#1B1B1B]' : 'text-[#8C8880]'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {isWaitingPool && !giftDone && giftDone !== null && (
          <button
            type="button"
            onClick={() => setOpenGifts(true)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Mulai Tes Karunia Rohani
          </button>
        )}

        {profileComplete && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-emerald-700">Profil lengkap!</p>
            <p className="text-[10px] text-emerald-600 mt-1">Admin akan segera menetapkan role kamu.</p>
          </div>
        )}

        {isWaitingPool && (
          <MyProfilePanel
            defaultOpenSection={openGifts ? 'gifts' : !birthDone ? 'contact' : undefined}
            onGiftSaved={() => {
              setOpenGifts(false);
              refreshStatus();
            }}
          />
        )}

        {mode === 'PENDING' && events.length > 0 && (
          <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-[#8C8880] flex items-center gap-2 mb-3">
              <Cake className="w-3.5 h-3.5 text-[#FF416C]" /> Agenda Terdekat
            </p>
            {events.slice(0, 3).map((e) => (
              <div key={e.id} className="py-2 border-b border-dashed border-[#D9D7D0]/50 last:border-0">
                <p className="text-xs font-bold">{e.title}</p>
                {e.locationDetail && <p className="text-[10px] text-[#8C8880]">{e.locationDetail}</p>}
              </div>
            ))}
          </div>
        )}

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
