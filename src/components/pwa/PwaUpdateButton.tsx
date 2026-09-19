import React, { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { applyPwaUpdate, checkPwaUpdate, refreshPwaClient } from '../../lib/pwa-install';

type Phase = 'idle' | 'checking' | 'uptodate' | 'failed' | 'available';

/**
 * Tombol “Cek pembaruan” manual — jalur pemulihan untuk user yang kliennya
 * terjebak di versi lama (SW/cache basi). Dipakai di Footer landing &
 * Pengaturan PWA portal.
 */
export const PwaUpdateButton: React.FC<{ dark?: boolean; className?: string }> = ({ dark = false, className = '' }) => {
  const { t } = useLang();
  const copy = t.pwa;
  const [phase, setPhase] = useState<Phase>('idle');

  const run = async () => {
    setPhase('checking');
    await checkPwaUpdate();
    // Beri jeda singkat agar SW baru sempat terdeteksi sebelum menyimpulkan.
    window.setTimeout(() => setPhase((p) => (p === 'checking' ? 'uptodate' : p)), 1500);
    window.setTimeout(() => setPhase((p) => (p === 'uptodate' ? 'idle' : p)), 5000);
  };

  const label =
    phase === 'checking' ? copy.checking
      : phase === 'uptodate' ? copy.upToDate
        : phase === 'failed' ? copy.updateFailed
          : copy.checkUpdate;

  const base = dark
    ? 'border border-white/20 text-white/75 hover:text-white hover:bg-white/10'
    : 'border border-[#D9D7D0] text-[#8C8880] hover:text-[#1B1B1B] hover:bg-[#F0EFEB]';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => { void run(); }}
        disabled={phase === 'checking'}
        className={`px-3.5 py-2 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 ${base}`}
      >
        {phase === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : phase === 'uptodate' ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <RefreshCw className="w-3.5 h-3.5" />}
        {label}
      </button>
      <button
        type="button"
        onClick={() => { void refreshPwaClient(); }}
        className={`px-3.5 py-2 rounded-full text-[11px] font-bold transition-colors ${base}`}
        title="Bersihkan cache lokal lalu muat ulang (untuk kasus macet)"
      >
        {copy.refreshApp}
      </button>
    </div>
  );
};
