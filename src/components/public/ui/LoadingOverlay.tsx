import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, ArrowLeft } from 'lucide-react';
import { GehcLogo } from '../../brand/GehcLogo';
import { useLang } from '../../../context/LangContext';
import { useLoadingLock } from '../../../hooks/useLoadingLock';
import {
  LOADING_APPEAR_DELAY_MS,
  LOADING_FUN_DELAY_MS,
  LOADING_MESSAGE_ROTATE_MS,
  nextMessageIndex,
} from '../../../lib/loading-copy';

export type LoadingKind = 'sessions' | 'google' | 'content' | 'events' | 'schedule' | 'generic';

type Props = {
  /** fullscreen = pindah route/auth; section = daftar konten di tempat. */
  variant?: 'fullscreen' | 'section';
  kind?: LoadingKind;
  /** Judul pembuka (opsional — default pesan per kind). */
  title?: string;
  /** Batas tunggu sebelum otomatis menawarkan retry (ms). Default 20000. */
  timeoutMs?: number;
  /** Dipanggil saat timeout tercapai (biasanya abort + tandai gagal). */
  onTimeout?: () => void;
  /** Tombol "Coba lagi" — bila ada, overlay menampilkan aksi retry. */
  onRetry?: () => void;
  /** Tombol "Kembali" (opsional). */
  onBack?: () => void;
  /** Latar gelap untuk kartu/auth gelap. */
  dark?: boolean;
  className?: string;
};

const MESSAGE_ROTATE_MS = LOADING_MESSAGE_ROTATE_MS;

/**
 * Standar loading global GEHC.page:
 * - muncul setelah 300ms (anti-flash),
 * - mengunci scroll/swipe/klik di areanya,
 * - pesan playful bergilir setelah 3 detik (anti-bosan),
 * - timeout + retry agar tak ada spinner abadi.
 */
export const LoadingOverlay: React.FC<Props> = ({
  variant = 'section',
  kind = 'generic',
  title,
  timeoutMs = 20000,
  onTimeout,
  onRetry,
  onBack,
  dark = false,
  className = '',
}) => {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const [fun, setFun] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [cycle, setCycle] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLoadingLock(visible);

  // Anti-flash + mode menyenangkan + timeout.
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), LOADING_APPEAR_DELAY_MS);
    const t2 = setTimeout(() => setFun(true), LOADING_FUN_DELAY_MS);
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeoutMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, cycle]);

  // Putar pesan playful.
  const messages = t.loading.generic;
  useEffect(() => {
    if (!fun || timedOut) return;
    const iv = setInterval(() => setMsgIdx((i) => nextMessageIndex(i, messages.length)), MESSAGE_ROTATE_MS);
    return () => clearInterval(iv);
  }, [fun, timedOut, messages.length]);

  // Fokus ke overlay saat tampil (aksesibilitas); Escape diabaikan (anti-batal tak sengaja).
  useEffect(() => {
    if (visible && !timedOut) boxRef.current?.focus({ preventScroll: true });
  }, [visible, timedOut]);

  if (!visible) return null;

  const headline = title || (kind === 'generic' ? t.loading.title : t.loading[kind]);
  const shell =
    variant === 'fullscreen'
      ? 'fixed inset-0 z-[90] bg-[#FAF9F5] flex items-center justify-center p-6'
      : `absolute inset-0 z-30 flex items-center justify-center p-6 rounded-[inherit] ${
          dark ? 'bg-[#111111]/90 text-white' : 'bg-[#FAF9F5]/85'
        } backdrop-blur-sm ${className}`;
  const headlineCls = dark ? 'text-white' : 'text-[#1B1B1B]';
  const subCls = dark ? 'text-white/60' : 'text-[#8C8880]';

  return (
    <div className={shell} role="status" aria-busy="true" aria-live="polite" aria-label={headline}>
      <div
        ref={boxRef}
        tabIndex={-1}
        className="flex flex-col items-center text-center max-w-xs outline-none"
      >
        <span className="relative inline-flex">
          <GehcLogo size={64} className="shadow-xl animate-pulse" />
          {!timedOut && (
            <Loader2 className="absolute -bottom-1 -right-1 w-5 h-5 animate-spin text-brand bg-white rounded-full" />
          )}
        </span>
        {!timedOut ? (
          <>
            <p className={`mt-4 text-sm font-black ${headlineCls}`}>{headline}</p>
            <p className={`mt-1 text-xs ${subCls} min-h-[1.25rem]`} aria-live="polite">
              {fun ? messages[msgIdx] : ' '}
            </p>
            <span className="mt-3 block w-40 h-1.5 rounded-full bg-[#E8E6E0] overflow-hidden" aria-hidden="true">
              <span className="block h-full w-1/2 rounded-full bg-gradient-to-r from-brand to-brand-end animate-loading-bar" />
            </span>
          </>
        ) : (
          <>
            <p className={`mt-4 text-sm font-black ${headlineCls}`}>{t.loading.timedOutTitle}</p>
            <p className={`mt-1 text-xs ${subCls} leading-relaxed`}>{t.loading.timedOutDesc}</p>
            <div className="mt-4 flex items-center gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={() => { setTimedOut(false); setCycle((c) => c + 1); onRetry(); }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold ${
                    dark ? 'bg-white text-[#111111] hover:bg-white/90' : 'bg-[#181818] text-white hover:bg-black'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {t.loading.retry}
                </button>
              )}
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border ${
                    dark
                      ? 'bg-transparent border-white/20 text-white hover:bg-white/10'
                      : 'bg-white border-[#D9D7D0] text-[#1B1B1B] hover:bg-[#F0EFEB]'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> {t.loading.back}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
