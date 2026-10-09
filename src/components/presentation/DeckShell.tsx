/**
 * DeckShell — kerangka presentasi (navigasi slide, fullscreen, keyboard).
 * Dipakai halaman materi Didaskalia; konten slide diserahkan via renderSlide.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';

export type DeckShellProps = {
  slides: { id: string }[];
  docTitle: string;
  eyebrow?: string;
  exitHash: string;
  headerRight?: React.ReactNode;
  renderSlide: (index: number) => React.ReactNode;
};

export const DeckShell: React.FC<DeckShellProps> = ({ slides, docTitle, eyebrow, exitHash, headerRight, renderSlide }) => {
  const total = slides.length;
  const [i, setI] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [started, setStarted] = useState(false);

  const next = useCallback(() => setI((p) => Math.min(p + 1, Math.max(total - 1, 0))), [total]);
  const prev = useCallback(() => setI((p) => Math.max(p - 1, 0)), []);
  // Kembali ke posisi portal terakhir (info event / tab terakhir dibuka), fallback exitHash.
  const exit = useCallback(() => {
    try {
      const at = Number(window.localStorage.getItem('gehc_last_portal_at') || 0);
      const last = window.localStorage.getItem('gehc_last_portal');
      if (last && /^#\//.test(last) && !last.startsWith('#/materi') && !last.startsWith('#/paparan') && Date.now() - at < 24 * 3600 * 1000) {
        window.location.hash = last;
        return;
      }
    } catch {
      /* abaikan */
    }
    window.location.hash = exitHash;
  }, [exitHash]);

  const toggleFullscreen = useCallback(() => {
    const doc = document;
    if (!doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => {});
    else doc.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => { document.title = docTitle; }, [docTitle]);

  useEffect(() => {
    const onFs = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'Spacebar': case 'PageDown': case 'ArrowDown': case 'Enter':
          e.preventDefault(); setStarted(true); next(); break;
        case 'ArrowLeft': case 'PageUp': case 'ArrowUp': case 'Backspace':
          e.preventDefault(); setStarted(true); prev(); break;
        case 'Home': e.preventDefault(); setI(0); break;
        case 'End': e.preventDefault(); setI(Math.max(total - 1, 0)); break;
        case 'Escape': exit(); break;
        case 'f': case 'F': toggleFullscreen(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, total, exit, toggleFullscreen]);

  const progress = useMemo(() => (total <= 1 ? 100 : Math.round(((i + 1) / total) * 100)), [i, total]);

  // Swipe horizontal (mobile): geser kiri = lanjut, geser kanan = kembali.
  // Ambang 60px & dominan horizontal agar scroll vertikal tidak ketrigger.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setStarted(true);
      if (dx < 0) setI((p) => Math.min(p + 1, Math.max(total - 1, 0)));
      else setI((p) => Math.max(p - 1, 0));
    }
  }, [total]);

  return (
    <div className="min-h-[100dvh] bg-[#0B1220] text-white flex flex-col print:bg-white print:text-black">
      <header className="sticky top-0 z-40 bg-[#0B1220]/95 backdrop-blur border-b border-white/10 print:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={exit}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
            title="Keluar (Esc)"
          >
            <X className="w-3.5 h-3.5" /> Keluar
          </button>
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-[10px] font-black uppercase tracking-wider text-sky-300 truncate">{eyebrow}</p>}
            <p className="text-sm font-bold truncate">{docTitle}</p>
          </div>
          {headerRight}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
            title="Layar penuh (F)"
          >
            {isFull ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFull ? 'Keluar layar' : 'Layar penuh'}</span>
          </button>
        </div>

        <nav aria-label="Navigasi slide" className="flex items-center justify-between gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={prev}
            disabled={i === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 px-4 py-2 text-xs font-bold transition"
          >
            <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Sebelumnya</span><span className="sm:hidden">Balik</span>
          </button>
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setStarted(true); setI(idx); }}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all shrink-0 ${idx === i ? 'w-6 bg-sky-400' : 'w-1.5 bg-white/25 hover:bg-white/50'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-white/60 tabular-nums">{i + 1} / {total}</span>
            <button
              type="button"
              onClick={next}
              disabled={i >= total - 1}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-30 px-4 py-2 text-xs font-black text-white transition"
            >
              {started ? 'Lanjut' : 'Mulai'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </nav>

        <div className="h-1 bg-white/10 print:hidden">
          <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-full max-w-6xl min-w-0 m-auto break-words">{total ? renderSlide(i) : null}</div>
      </main>
    </div>
  );
};

export default DeckShell;
