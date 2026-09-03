import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Props = {
  onCompleteProfile: () => void;
};

export const ProfileIncompleteBanner: React.FC<Props> = ({ onCompleteProfile }) => {
  const { authUser } = useApp();
  const [incomplete, setIncomplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!authUser?.id) return;
    if (authUser.onboardingStatus === 'WAITING_POOL') {
      setIncomplete(false);
      return;
    }
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setIncomplete(Boolean(d.profileIncomplete));
      })
      .catch(() => {
        if (!cancelled) setIncomplete(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, authUser?.onboardingStatus, authUser?.giftsTop5]);

  if (!incomplete || dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <UserRound className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1B1B1B]">Lengkapi data diri</p>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Profil belum lengkap. Akses portal tetap terbuka — lengkapi data diri Anda.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
  );
};
