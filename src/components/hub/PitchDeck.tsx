import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  Check,
  Clock,
  Landmark,
} from 'lucide-react';
import { PITCH_SLIDES, type PitchSlide } from '../../data/pitchSlides';
import { GehcLogo } from '../brand/GehcLogo';

const slideCls = 'w-full max-w-[1040px] mx-auto px-6 sm:px-10';

function SlideBody({ slide, reduce }: { slide: PitchSlide; reduce: boolean | null }) {
  const stagger = (i: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduce ? 0 : 0.08 * (i + 1), duration: 0.4 },
  });

  if (slide.kind === 'cover' || slide.kind === 'closing') {
    return (
      <div className="text-center">
        {slide.eyebrow && (
          <motion.p
            {...stagger(0)}
            className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#FF416C]"
          >
            {slide.eyebrow}
          </motion.p>
        )}
        <motion.h1
          {...stagger(1)}
          className="font-display text-5xl sm:text-7xl font-black mt-5 leading-[1.02]"
        >
          {slide.title}
        </motion.h1>
        {slide.subtitle && (
          <motion.p {...stagger(2)} className="text-sm sm:text-lg text-white/60 mt-6">
            {slide.subtitle}
          </motion.p>
        )}
        {slide.kind === 'cover' && (
          <motion.div
            {...stagger(3)}
            className="inline-flex items-center gap-2 mt-10 px-4 py-2 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider"
          >
            <Landmark className="w-3.5 h-3.5 text-[#FF416C]" />
            Rumah Digital Jemaat
          </motion.div>
        )}
      </div>
    );
  }

  if (slide.kind === 'roadmap' && slide.roadmap) {
    return (
      <div>
        <Header slide={slide} stagger={stagger} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-10">
          {slide.roadmap.map((item, i) => (
            <motion.div
              key={item.label}
              {...stagger(i)}
              className={`rounded-2xl border p-5 ${
                item.status === 'live'
                  ? 'border-[#FF416C]/40 bg-gradient-to-br from-[#FF416C]/15 to-[#FF4B2B]/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-base">{item.label}</p>
                {item.status === 'live' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    <Clock className="w-3.5 h-3.5" /> Segera
                  </span>
                )}
              </div>
              {item.note && <p className="text-xs text-white/50 mt-2">{item.note}</p>}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header slide={slide} stagger={stagger} />
      {slide.bullets && (
        <ul className="mt-10 space-y-4 max-w-3xl">
          {slide.bullets.map((b, i) => (
            <motion.li key={b} {...stagger(i)} className="flex items-start gap-3">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-[#FF416C] to-[#FF4B2B] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="text-base sm:text-lg text-white/85 leading-relaxed">{b}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header({
  slide,
  stagger,
}: {
  slide: PitchSlide;
  stagger: (i: number) => Record<string, unknown>;
}) {
  return (
    <div>
      {slide.eyebrow && (
        <motion.p
          {...stagger(0)}
          className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#FF416C]"
        >
          {slide.eyebrow}
        </motion.p>
      )}
      <motion.h2
        {...stagger(1)}
        className="font-display text-3xl sm:text-5xl font-black mt-4 leading-tight"
      >
        {slide.title}
      </motion.h2>
    </div>
  );
}

const PitchDeck: React.FC = () => {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const total = PITCH_SLIDES.length;
  const slide = PITCH_SLIDES[index];

  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const toggleFullscreen = useCallback(() => {
    const doc = document;
    if (!doc.fullscreenElement) {
      doc.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      doc.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const exit = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  useEffect(() => {
    document.title = 'GEHC.page — Presentasi';
  }, []);

  useEffect(() => {
    const onFullscreen = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Spacebar':
        case 'PageDown':
        case 'ArrowDown':
        case 'Enter':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
        case 'ArrowUp':
        case 'Backspace':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          setIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setIndex(total - 1);
          break;
        case 'Escape':
          exit();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, total, exit, toggleFullscreen]);

  return (
    <div className="min-h-screen bg-[#0E0E0E] text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-3">
          <GehcLogo size={32} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
            GEHC.page · Presentasi
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            {isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={exit}
            title="Keluar (Esc)"
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex items-center justify-center relative px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: reduce ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -24 }}
            transition={{ duration: 0.35 }}
            className={slideCls}
            aria-live="polite"
          >
            <SlideBody slide={slide} reduce={reduce} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom bar */}
      <footer className="px-4 sm:px-8 py-5">
        <div className="max-w-[1040px] mx-auto">
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                disabled={index === 0}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <button
                type="button"
                onClick={next}
                disabled={index === total - 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-xs font-bold disabled:opacity-30 transition-all"
              >
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              {PITCH_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === index ? 'bg-[#FF416C] w-5' : 'bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>

            <span className="text-xs font-bold text-white/50 tabular-nums">
              {index + 1} / {total}
            </span>
          </div>
          <p className="hidden sm:block text-center text-[10px] text-white/30 mt-3">
            Spasi / ↓ / → maju · ↑ / ← mundur · F fullscreen · Esc keluar
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PitchDeck;
