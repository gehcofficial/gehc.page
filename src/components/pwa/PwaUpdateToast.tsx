import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { applyPwaUpdate, onPwaUpdateAvailable } from '../../lib/pwa-install';

const IDLE_AUTORELOAD_MS = 15000;

function isEditableFocused(): boolean {
  const el = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Toast “Versi baru tersedia”. Muncul saat service worker baru selesai install
 * (event dari public/pwa-register.js). Auto-reload hanya bila aplikasi idle:
 * tidak ada input aktif dan tidak ada interaksi dalam 15 detik terakhir.
 */
export const PwaUpdateToast: React.FC = () => {
  const { t } = useLang();
  const copy = t.pwa;
  const [visible, setVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const lastInteraction = useRef(Date.now());

  useEffect(() => onPwaUpdateAvailable(() => setVisible(true)), []);

  useEffect(() => {
    if (!visible) return;
    const touch = () => { lastInteraction.current = Date.now(); };
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || applying) return;
    const timer = window.setInterval(() => {
      const idleLongEnough = Date.now() - lastInteraction.current >= IDLE_AUTORELOAD_MS;
      if (idleLongEnough && !isEditableFocused() && document.visibilityState === 'visible') {
        void applyPwaUpdate();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [visible, applying]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-md">
      <div className="bg-[#151515]/97 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F6AE4A]/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-[#F6AE4A]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{copy.updateAvailable}</p>
          <p className="text-[11px] text-white/60 mt-0.5">{copy.updateDesc}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={applying}
              onClick={() => { setApplying(true); void applyPwaUpdate(); }}
              className="px-3.5 py-2 rounded-full bg-[#F6AE4A] text-[#1B1B1B] text-[11px] font-black flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${applying ? 'animate-spin' : ''}`} />
              {applying ? copy.refreshing : copy.updateReload}
            </button>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="px-3 py-2 rounded-full text-[11px] font-bold text-white/60 hover:text-white"
            >
              {copy.updateLater}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={copy.updateLater}
          className="p-1 rounded-lg text-white/50 hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
