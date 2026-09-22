import React, { useEffect, useState } from 'react';
import { UserRound, CheckCircle2, Circle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OnboardingBanner } from './OnboardingBanner';

type Props = {
  onCompleteProfile: () => void;
  onStartGiftTest?: () => void;
  hideEventCard?: boolean;
};

/**
 * Satu pintu untuk semua prompt kelengkapan (P2-2): onboarding/waiting-pool
 * memakai OnboardingBanner; pengguna aktif yang profilnya belum lengkap melihat
 * checklist item yang kurang (bukan pesan generik).
 */
export const ProfileChecklistBanner: React.FC<Props> = ({ onCompleteProfile, onStartGiftTest, hideEventCard = false }) => {
  const { authUser } = useApp();
  const isOnboarding = authUser?.onboardingStatus === 'WAITING_POOL' || authUser?.accountStatus === 'PENDING';
  const [items, setItems] = useState<Array<{ label: string; done: boolean }> | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!authUser?.id || isOnboarding) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/me/profile', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/auth/me', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([p, me]) => {
      if (cancelled) return;
      const birthDone = Boolean(p?.segments?.birthDate) || Boolean(p?.user?.birthDate);
      const contactDone = Boolean(p?.segments?.contact);
      const giftDone = Boolean(p?.segments?.gifts) || (Array.isArray(p?.user?.giftsTop5) && p.user.giftsTop5.length > 0);
      const incomplete = Boolean(me?.profileIncomplete) || !birthDone || !contactDone || !giftDone;
      setItems(incomplete ? [
        { label: 'Tanggal lahir', done: birthDone },
        { label: 'Data diri & kontak', done: contactDone },
        { label: 'Tes karunia', done: giftDone },
      ] : []);
    });
    return () => { cancelled = true; };
  }, [authUser?.id, isOnboarding]);

  if (isOnboarding) {
    return <OnboardingBanner onCompleteProfile={onCompleteProfile} onStartGiftTest={onStartGiftTest} hideEventCard={hideEventCard} />;
  }

  if (!items || items.length === 0 || dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <UserRound className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1B1B1B]">Lengkapi data diri</p>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Akses portal tetap terbuka — lengkapi langkah berikut.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {items.map((it) => (
              <span
                key={it.label}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  it.done ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-amber-200 text-amber-800'
                }`}
              >
                {it.done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                {it.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onCompleteProfile}
              className="px-3 py-1.5 rounded-full bg-[#181818] text-white text-[10px] font-black uppercase tracking-wider"
            >
              Lengkapi profil
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 rounded-full text-[10px] font-bold text-[#8C8880] hover:bg-amber-100"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
