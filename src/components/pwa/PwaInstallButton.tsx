import React, { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import {
  canInstallPwa,
  detectPwaInstallKind,
  isStandaloneDisplay,
  onPwaInstallable,
  promptPwaInstall,
} from '../../lib/pwa-install';

const DISMISS_KEY = 'gehc_pwa_install_dismissed';

/**
 * Tombol install PWA untuk landing page. Di Chromium memakai dialog install
 * native; di iOS/Safari (tanpa beforeinstallprompt) menampilkan instruksi
 * “Tambah ke Layar Utama”. Disembunyikan bila sudah standalone.
 */
export const PwaInstallButton: React.FC<{ variant?: 'navbar' | 'footer' }> = ({ variant = 'navbar' }) => {
  const { t } = useLang();
  const copy = t.pwa;
  const [installed, setInstalled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInstalled(isStandaloneDisplay());
      setAvailable(canInstallPwa());
    };
    sync();
    const off = onPwaInstallable(sync);
    window.addEventListener('appinstalled', sync);
    const timer = window.setInterval(sync, 5000);
    return () => {
      off();
      window.removeEventListener('appinstalled', sync);
      window.clearInterval(timer);
    };
  }, []);

  const kind = detectPwaInstallKind();
  // iOS/Safari tidak pernah memicu beforeinstallprompt → tampilkan instruksi.
  const needsManualHelp = kind === 'ios' || kind === 'macos-safari';

  if (installed || (!available && !needsManualHelp)) return null;

  const onInstall = async () => {
    if (needsManualHelp) {
      setShowHelp(true);
      return;
    }
    const outcome = await promptPwaInstall();
    if (outcome === 'unavailable') setShowHelp(true);
  };

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
    setShowHelp(false);
  };

  const base = variant === 'footer'
    ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
    : 'bg-white text-[#181818]';

  return (
    <>
      <button
        type="button"
        onClick={() => { void onInstall(); }}
        title={copy.installHint}
        className={`${base} rounded-full text-[11px] font-black transition-colors flex items-center gap-1.5 px-3 h-[34px]`}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{copy.install}</span>
        <span className="sm:hidden">App</span>
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#FAF9F5] rounded-3xl w-full max-w-sm p-6 border border-[#D9D7D0] shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-[#1B1B1B] flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#F6AE4A]" />
                {copy.iosTitle}
              </h3>
              <button
                type="button"
                onClick={dismiss}
                className="p-1 rounded-lg text-[#8C8880] hover:bg-[#F0EFEB]"
                aria-label={copy.updateLater}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#8C8880] leading-relaxed mt-3">{copy.installDesc}</p>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white border border-[#D9D7D0]/60 p-3">
              <Share className="w-4 h-4 text-[#F6AE4A] shrink-0 mt-0.5" />
              <p className="text-xs text-[#1B1B1B] leading-relaxed">{copy.iosSteps}</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="mt-5 w-full py-3 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold"
            >
              {copy.updateLater}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
