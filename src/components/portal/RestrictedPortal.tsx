import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, LogOut, Gift, User, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Portal TERBATAS untuk akun berstatus WAITING_POOL:
 * profil diri + gift test. Akses terbatas sampai lengkapi profil
 * dan menunggu role assignment dari admin.
 */
export const RestrictedPortal: React.FC = () => {
  const { authUser, setActiveView } = useApp();
  const [giftDone, setGiftDone] = useState<boolean | null>(null);
  const [profileDone, setProfileDone] = useState<boolean | null>(null);

  useEffect(() => {
    // Cek status tes karunia dari /api/auth/me
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const g = d.user?.giftsTop5;
        setGiftDone(Array.isArray(g) && g.length > 0);
        // Cek profil lengkap
        const u = d.user;
        setProfileDone(!!(u?.phone && u?.gender && u?.origin));
      })
      .catch(() => {
        setGiftDone(null);
        setProfileDone(null);
      });
  }, []);

  const steps = [
    { key: 'register', label: 'Daftar akun', done: true },
    { key: 'profile', label: 'Lengkapi profil', done: profileDone ?? false, pending: profileDone === null },
    { key: 'gift', label: 'Tes Karunia Rohani', done: giftDone ?? false, pending: giftDone === null },
    { key: 'role', label: 'Role assignment oleh admin', done: false, pending: true },
  ];

  const allDone = steps.every((s) => s.done);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        {/* Header */}
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

        {/* Onboarding Progress */}
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

        {/* Action Buttons */}
        <div className="space-y-3">
          {!profileDone && (
            <a
              href="#/join"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = '#/join';
                window.location.reload();
              }}
              className="block w-full py-3 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" /> Lengkapi Profil Sekarang
              <ArrowRight className="w-4 h-4" />
            </a>
          )}

          {profileDone && !giftDone && (
            <a
              href="#/join"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = '#/join';
                window.location.reload();
              }}
              className="block w-full py-3 rounded-xl bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" /> Lengkapi Tes Karunia Sekarang
              <ArrowRight className="w-4 h-4" />
            </a>
          )}

          {allDone && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-emerald-700">Profil dan tes karunia sudah lengkap!</p>
              <p className="text-[10px] text-emerald-600 mt-1">Admin akan segera menetapkan role kamu.</p>
            </div>
          )}
        </div>

        {/* Info Box */}
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
