import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, MessageCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BakuTauWelcomeCard } from './BakuTauWelcomeCard';
import { LinkGoogleCard } from './LinkGoogleCard';

type Props = {
  onCompleteProfile: () => void;
  onStartGiftTest?: () => void;
};

export const OnboardingBanner: React.FC<Props> = ({ onCompleteProfile, onStartGiftTest }) => {
  const { authUser } = useApp();
  const [giftDone, setGiftDone] = useState<boolean | null>(null);
  const [profileDone, setProfileDone] = useState<boolean | null>(null);
  const [birthDone, setBirthDone] = useState<boolean | null>(null);
  const [bakuTau, setBakuTau] = useState<{
    registered: boolean;
    whatsappGroupUrl?: string | null;
    eventDate?: string;
    venueName?: string;
    locationDetail?: string;
    mapUrl?: string | null;
    mapEmbedQuery?: string;
  } | null>(null);

  const isWaitingPool = authUser?.onboardingStatus === 'WAITING_POOL';
  const isPendingAccount = authUser?.accountStatus === 'PENDING' && !isWaitingPool;

  const refresh = () => {
    fetch('/api/me/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setGiftDone(Boolean(d.segments?.gifts) || (Array.isArray(d.user?.giftsTop5) && d.user.giftsTop5.length > 0));
        setProfileDone(Boolean(d.segments?.contact));
        setBirthDone(Boolean(d.segments?.birthDate) || Boolean(d.user?.birthDate));
      })
      .catch(() => {});
    fetch('/api/me/baku-tau-registration', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBakuTau(d))
      .catch(() => setBakuTau(null));
  };

  useEffect(() => {
    refresh();
    const onApplied = () => refresh();
    window.addEventListener('gehc:event-applied', onApplied);
    return () => window.removeEventListener('gehc:event-applied', onApplied);
  }, [authUser?.id]);

  if (!isWaitingPool && !isPendingAccount) return null;

  const steps = isWaitingPool
    ? [
        { label: 'Daftar akun', done: true },
        { label: 'Tanggal lahir', done: birthDone ?? false },
        { label: 'Lengkapi profil', done: profileDone ?? false },
        { label: 'Tes Karunia', done: giftDone ?? false },
        { label: 'Role dari admin', done: false },
      ]
    : [
        { label: 'Daftar akun', done: true },
        { label: 'Persetujuan Komisi', done: false },
      ];

  const profileComplete = isWaitingPool && profileDone && giftDone && birthDone;
  const showWaReminder = bakuTau?.registered && bakuTau?.whatsappGroupUrl;

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-[24px] bg-gradient-to-br from-[#181818] to-[#262626] p-5 sm:p-6 text-white border border-[#D9D7D0]/20">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-2">
          <Clock className="w-3 h-3" />
          {isWaitingPool ? 'Onboarding — akses terbatas' : 'Menunggu persetujuan akun'}
        </span>
        <p className="text-sm font-bold leading-snug">
          Halo{authUser?.name ? `, ${authUser.name.split(' ')[0]}` : ''}! Lengkapi langkah di bawah untuk akses penuh portal.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {steps.map((s) => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/70'
              }`}
            >
              {s.done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {s.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {!profileComplete && (
            <button
              type="button"
              onClick={onCompleteProfile}
              className="px-4 py-2 rounded-full bg-white text-[#181818] text-[10px] font-black uppercase tracking-wider"
            >
              Lengkapi profil
            </button>
          )}
          {isWaitingPool && !giftDone && giftDone !== null && onStartGiftTest && (
            <button
              type="button"
              onClick={onStartGiftTest}
              className="px-4 py-2 rounded-full bg-[#FF416C] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Tes Karunia
            </button>
          )}
          {showWaReminder && (
            <a
              href={bakuTau!.whatsappGroupUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Gabung Grup WA
            </a>
          )}
        </div>
        {bakuTau?.registered && !bakuTau?.whatsappGroupUrl && (
          <p className="text-[10px] text-amber-200/80 mt-3">
            Jangan lupa gabung grup WhatsApp peserta BAKU TAU — link akan muncul di tab Info Event setelah panitia membagikannya.
          </p>
        )}
      </div>

      {bakuTau?.registered && (
        <BakuTauWelcomeCard
          whatsappGroupUrl={bakuTau.whatsappGroupUrl}
          eventDate={bakuTau.eventDate}
          venueName={bakuTau.venueName}
          locationDetail={bakuTau.locationDetail}
          mapUrl={bakuTau.mapUrl}
          mapEmbedQuery={bakuTau.mapEmbedQuery}
          compact
          onCompleteProfile={onCompleteProfile}
        />
      )}

      {isWaitingPool && <LinkGoogleCard compact />}
    </div>
  );
};
