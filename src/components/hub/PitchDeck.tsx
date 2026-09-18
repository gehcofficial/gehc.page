import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Play,
  Type,
} from 'lucide-react';
import { PITCH_SLIDES, type PitchSlide } from '../../data/pitchSlides';
import { GehcLogo } from '../brand/GehcLogo';

/** Palet highlight per poin (rotasi otomatis). */
const PALETTE = ['#FF416C', '#FF4B2B', '#F59E0B', '#22C55E', '#0EA5E9', '#8B5CF6', '#EC4899'];

type ScaleKey = 'normal' | 'besar' | 'tv';
const SCALE_VALUES: Record<ScaleKey, number> = { normal: 1, besar: 1.2, tv: 1.45 };
const SCALE_STORAGE = 'gehc-pitch-scale';

/** Jumlah langkah (content-by-content) untuk sebuah slide. */
function stepsFor(slide: PitchSlide): number {
  if (slide.kind === 'roadmap' && slide.roadmap?.length) return slide.roadmap.length;
  if (slide.kind === 'demo' && slide.demo?.steps?.length) return slide.demo.steps.length;
  if (slide.kind === 'qr' && slide.qr?.length) return slide.qr.length;
  if (slide.kind === 'flow' && slide.flow?.length) return slide.flow.length;
  if (slide.kind === 'weights' && slide.weights?.length) return slide.weights.length;
  if (slide.kind === 'checklist' && slide.checklist?.length) return slide.checklist.length;
  if (slide.kind === 'image') return slide.image ? 2 : 1; // judul → gambar
  if ((slide.kind === 'list' || slide.kind === 'section') && slide.bullets?.length) return slide.bullets.length;
  let n = 1; // judul
  if (slide.subtitle) n += 1;
  if (slide.kind === 'cover') n += 1; // badge
  return n;
}

function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length];
}

const bulletPx = 'text-[1.4em]';
const titlePx = 'text-[2.5em]';
const coverTitlePx = 'text-[3.4em]';

function Header({ slide, step }: { slide: PitchSlide; step: number }) {
  return (
    <div>
      {slide.eyebrow && (
        <motion.p
          initial={false}
          animate={{ opacity: step >= 0 ? 1 : 0 }}
          className="text-[0.85em] font-bold uppercase tracking-[0.32em] text-[#FF416C]"
        >
          {slide.eyebrow}
        </motion.p>
      )}
      <h2 className={`font-display ${titlePx} font-black mt-[0.35em] leading-[1.08]`}>{slide.title}</h2>
    </div>
  );
}

function SlideBody({ slide, step, reduce }: { slide: PitchSlide; step: number; reduce: boolean | null }) {
  const reveal = (i: number) => i <= step;
  const active = (i: number) => i === step;

  if (slide.kind === 'image' && slide.image) {
    return (
      <div>
        <Header slide={slide} step={step} />
        {slide.subtitle && <p className="text-[1.1em] text-white/60 mt-[0.45em]">{slide.subtitle}</p>}
        <motion.div
          initial={false}
          animate={{ opacity: reveal(1) ? 1 : 0, y: reveal(1) || reduce ? 0 : 16 }}
          transition={{ duration: 0.35 }}
          aria-hidden={!reveal(1)}
          className="mt-[1.2em] flex justify-center"
        >
          <figure className="max-w-[min(62em,92vw)]">
            <img src={slide.image.src} alt={slide.image.alt} className="w-full rounded-[1.2em] border border-white/15 shadow-2xl" />
            {slide.image.caption && (
              <figcaption className="text-[0.95em] text-white/60 mt-[0.7em] text-center">{slide.image.caption}</figcaption>
            )}
          </figure>
        </motion.div>
      </div>
    );
  }

  if (slide.kind === 'flow' && slide.flow?.length) {
    return (
      <div>
        <Header slide={slide} step={step} />
        {slide.subtitle && <p className="text-[1.1em] text-white/60 mt-[0.45em]">{slide.subtitle}</p>}
        <div className="mt-[1.4em] flex flex-wrap gap-[0.7em]">
          {slide.flow.map((f, i) => {
            const c = colorAt(i);
            const isActive = active(i);
            const shown = reveal(i);
            return (
              <motion.div
                key={f.title}
                initial={false}
                animate={{ opacity: shown ? (isActive ? 1 : 0.55) : 0, y: shown || reduce ? 0 : 12, scale: isActive ? 1.03 : 1 }}
                transition={{ duration: 0.3 }}
                aria-hidden={!shown}
                style={{ borderColor: isActive ? c : 'rgba(255,255,255,0.12)', boxShadow: isActive ? `0 0 0 2px ${c}` : undefined }}
                className="flex-1 min-w-[10em] rounded-2xl border bg-white/5 p-[0.95em]"
              >
                <div className="flex items-center gap-[0.6em]">
                  <span className="w-[1.9em] h-[1.9em] rounded-full flex items-center justify-center text-[0.95em] font-black" style={{ background: c }}>
                    {i + 1}
                  </span>
                  <p className="font-bold text-[1.1em] leading-tight">{f.title}</p>
                </div>
                {f.caption && <p className="text-[0.95em] text-white/60 mt-[0.5em] leading-snug">{f.caption}</p>}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.kind === 'weights' && slide.weights?.length) {
    return (
      <div>
        <Header slide={slide} step={step} />
        {slide.subtitle && <p className="text-[1.1em] text-white/60 mt-[0.45em]">{slide.subtitle}</p>}
        <div className="mt-[1.5em] space-y-[0.9em] max-w-[48em]">
          {slide.weights.map((w, i) => {
            const c = colorAt(i);
            const isActive = active(i);
            const shown = reveal(i);
            const pct = Math.round(w.value * 100);
            return (
              <motion.div
                key={w.label}
                initial={false}
                animate={{ opacity: shown ? (isActive ? 1 : 0.6) : 0, x: shown || reduce ? 0 : 16 }}
                transition={{ duration: 0.3 }}
                aria-hidden={!shown}
              >
                <div className="flex items-baseline justify-between gap-[0.6em]">
                  <p className="font-bold text-[1.15em]" style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.85)' }}>{w.label}</p>
                  <span className="font-black tabular-nums text-[1.1em]" style={{ color: c }}>{pct}%</span>
                </div>
                <div className="mt-[0.35em] h-[0.9em] rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ width: shown ? `${pct}%` : '0%' }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ background: c }}
                  />
                </div>
                {w.note && <p className="text-[0.95em] text-white/55 mt-[0.35em] leading-snug">{w.note}</p>}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.kind === 'checklist' && slide.checklist?.length) {
    return (
      <div>
        <Header slide={slide} step={step} />
        {slide.subtitle && <p className="text-[1.1em] text-white/60 mt-[0.45em]">{slide.subtitle}</p>}
        <div className="mt-[1.4em] grid grid-cols-1 sm:grid-cols-2 gap-[0.8em]">
          {slide.checklist.map((it, i) => {
            const c = colorAt(i);
            const isActive = active(i);
            const shown = reveal(i);
            return (
              <motion.div
                key={it.title}
                initial={false}
                animate={{ opacity: shown ? (isActive ? 1 : 0.6) : 0, y: shown || reduce ? 0 : 12 }}
                transition={{ duration: 0.3 }}
                aria-hidden={!shown}
                style={{ borderColor: isActive ? c : 'rgba(255,255,255,0.12)', boxShadow: isActive ? `0 0 0 2px ${c}` : undefined }}
                className="rounded-2xl border bg-white/5 p-[1em] flex items-start gap-[0.7em]"
              >
                <span className="w-[1.7em] h-[1.7em] rounded-full flex items-center justify-center shrink-0 mt-[0.1em]" style={{ background: c }}>
                  <Check className="w-[0.95em] h-[0.95em] text-white" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-[1.1em] leading-tight">{it.title}</p>
                  <p className="text-[0.95em] text-white/60 mt-[0.3em] leading-snug">{it.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.kind === 'cover' || slide.kind === 'closing') {
    const units: Array<'title' | 'subtitle' | 'badge'> = ['title'];
    if (slide.subtitle) units.push('subtitle');
    if (slide.kind === 'cover') units.push('badge');
    const idx = (u: string) => units.indexOf(u as 'title');

    return (
      <div className="text-center">
        {slide.eyebrow && (
          <motion.p initial={false} animate={{ opacity: reveal(0) ? 1 : 0 }} className="text-[0.9em] font-bold uppercase tracking-[0.32em] text-[#FF416C]">
            {slide.eyebrow}
          </motion.p>
        )}
        <motion.h1 initial={false} animate={{ opacity: 1 }} className={`font-display ${coverTitlePx} font-black mt-[0.25em] leading-[1.02]`}>
          {slide.title}
        </motion.h1>
        {slide.subtitle && (
          <motion.p
            initial={false}
            animate={{ opacity: reveal(idx('subtitle')) ? 1 : 0, y: reveal(idx('subtitle')) || reduce ? 0 : 12 }}
            transition={{ duration: 0.35 }}
            className="text-[1.35em] text-white/70 mt-[0.7em]"
          >
            {slide.subtitle}
          </motion.p>
        )}
        {slide.kind === 'cover' && (
          <motion.div
            initial={false}
            animate={{ opacity: reveal(idx('badge')) ? 1 : 0, y: reveal(idx('badge')) || reduce ? 0 : 12 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-[0.5em] mt-[1.2em] px-[1em] py-[0.5em] rounded-full bg-white/10 text-[0.9em] font-bold uppercase tracking-wider"
          >
            <Landmark className="w-[1em] h-[1em] text-[#FF416C]" />
            Rumah Digital Jemaat
          </motion.div>
        )}
      </div>
    );
  }

  if (slide.kind === 'demo' && slide.demo?.steps?.length) {
    const s = slide.demo.steps[Math.min(step, slide.demo.steps.length - 1)];
    return (
      <div>
        <Header slide={slide} step={step} />
        {slide.subtitle && <p className="text-[1.1em] text-white/60 mt-[0.45em]">{slide.subtitle}</p>}
        <div className="mt-[1.4em] flex flex-col sm:flex-row items-center gap-[1.8em]">
          <div className="shrink-0 rounded-[2.2em] border-[0.5em] border-white/15 bg-black overflow-hidden shadow-2xl" style={{ width: '15em', aspectRatio: '9 / 19.5' }}>
            <AnimatePresence mode="wait">
              <motion.video
                key={s.media}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                src={s.media}
                autoPlay
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const st = s.startAt ?? 0.4;
                  try { if (st > 0 && v.currentTime < st) v.currentTime = st; } catch { /* abaikan */ }
                }}
                onEnded={(e) => {
                  const v = e.currentTarget;
                  try { v.currentTime = s.startAt ?? 0.4; void v.play(); } catch { /* abaikan */ }
                }}
                className="w-full h-full object-cover"
              />
            </AnimatePresence>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-[0.6em] mb-[0.8em]">
              {slide.demo.steps.map((st, i) => {
                const c = colorAt(i);
                const on = i === step;
                return (
                  <span
                    key={st.title}
                    className="px-[0.8em] py-[0.35em] rounded-full text-[0.85em] font-bold"
                    style={{ background: on ? c : 'rgba(255,255,255,0.08)', color: on ? '#fff' : 'rgba(255,255,255,0.6)' }}
                  >
                    {i + 1}. {st.title}
                  </span>
                );
              })}
            </div>
            <p className="text-[1.4em] leading-snug text-white/90">{s.caption}</p>
          </div>
        </div>
      </div>
    );
  }

  if (slide.kind === 'qr' && slide.qr?.length) {
    return (
      <div>
        <Header slide={slide} step={step} />
        {slide.subtitle && <p className="text-[1.1em] text-white/60 mt-[0.45em]">{slide.subtitle}</p>}
        <div className="mt-[1.4em] grid grid-cols-1 sm:grid-cols-2 gap-[1.4em] max-w-[48em]">
          {slide.qr.map((q, i) => {
            const c = colorAt(i);
            const shown = reveal(i);
            const isActive = active(i);
            return (
              <motion.div
                key={q.url}
                initial={false}
                animate={{ opacity: shown ? (isActive ? 1 : 0.5) : 0, y: shown || reduce ? 0 : 12, scale: isActive ? 1.02 : 1 }}
                transition={{ duration: 0.3 }}
                aria-hidden={!shown}
                style={{ borderColor: isActive ? c : 'rgba(255,255,255,0.12)', boxShadow: isActive ? `0 0 0 2px ${c}` : undefined }}
                className="rounded-[1.4em] border bg-white/5 p-[1.1em] flex flex-col items-center gap-[0.7em]"
              >
                <div className="rounded-[1em] bg-white p-[0.7em]">
                  <img src={q.image} alt={`QR ${q.label}`} className="w-[9em] h-[9em]" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-[1.15em]">{q.label}</p>
                  <p className="text-[0.95em] text-white/60">{q.url}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.kind === 'roadmap' && slide.roadmap) {
    return (
      <div>
        <Header slide={slide} step={step} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[0.8em] mt-[1.6em]">
          {slide.roadmap.map((item, i) => {
            const c = colorAt(i);
            const isActive = active(i);
            const shown = reveal(i);
            return (
              <motion.div
                key={item.label}
                initial={false}
                animate={{ opacity: shown ? (isActive ? 1 : 0.5) : 0, y: shown || reduce ? 0 : 12, scale: isActive ? 1.02 : 1 }}
                transition={{ duration: 0.3 }}
                aria-hidden={!shown}
                style={{
                  borderColor: isActive ? c : 'rgba(255,255,255,0.12)',
                  boxShadow: isActive ? `0 0 0 2px ${c}, 0 10px 30px rgba(0,0,0,0.35)` : undefined,
                }}
                className="rounded-2xl border bg-white/5 p-[1.1em]"
              >
                <div className="flex items-center justify-between gap-[0.6em]">
                  <p className="font-bold text-[1.2em]">
                    <span className="inline-block w-[0.6em] h-[0.6em] rounded-full mr-[0.5em]" style={{ background: c }} />
                    {item.label}
                  </p>
                  {item.status === 'live' ? (
                    <span className="inline-flex items-center gap-[0.3em] text-[0.8em] font-bold uppercase tracking-wider text-emerald-400">
                      <Check className="w-[1em] h-[1em]" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-[0.3em] text-[0.8em] font-bold uppercase tracking-wider text-white/40">
                      <Clock className="w-[1em] h-[1em]" /> Segera
                    </span>
                  )}
                </div>
                {item.note && <p className="text-[0.95em] text-white/50 mt-[0.4em]">{item.note}</p>}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // list / section
  return (
    <div>
      <Header slide={slide} step={step} />
      {slide.bullets && (
        <ul className="mt-[1.6em] space-y-[0.7em] max-w-[46em]">
          {slide.bullets.map((b, i) => {
            const c = colorAt(i);
            const isActive = active(i);
            const shown = reveal(i);
            return (
              <motion.li
                key={b}
                initial={false}
                animate={{ opacity: shown ? (isActive ? 1 : 0.55) : 0, x: shown || reduce ? 0 : 16 }}
                transition={{ duration: 0.3 }}
                aria-hidden={!shown}
                className="flex items-start gap-[0.8em]"
              >
                <span
                  className="mt-[0.15em] w-[1.7em] h-[1.7em] rounded-full flex items-center justify-center shrink-0"
                  style={{ background: c, boxShadow: isActive ? `0 0 0 3px ${c}33` : undefined }}
                >
                  <Check className="w-[0.95em] h-[0.95em] text-white" />
                </span>
                <span
                  className={`${bulletPx} leading-snug`}
                  style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.9)', fontWeight: isActive ? 700 : 400 }}
                >
                  {b}
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const PitchDeck: React.FC<{
  /** Isi deck. Default: deck hub GEHC.page. */
  slides?: PitchSlide[];
  /** Kunci penyimpanan preferensi ukuran teks (beda deck = beda kunci). */
  storageKey?: string;
  /** Label kecil di kanan atas. */
  label?: string;
  /** Judul tab browser. */
  docTitle?: string;
  /** Hash tujuan saat keluar (Esc / tombol X). */
  exitHash?: string;
}> = ({
  slides = PITCH_SLIDES,
  storageKey = SCALE_STORAGE,
  label = 'GEHC.page · Presentasi',
  docTitle = 'GEHC.page — Presentasi',
  exitHash = '#/',
}) => {
  const reduce = useReducedMotion();
  const total = slides.length;
  const [pos, setPos] = useState({ i: 0, s: 0 });
  const [isFull, setIsFull] = useState(false);
  const [started, setStarted] = useState(false);
  const [scale, setScale] = useState<ScaleKey>(() => {
    try {
      const v = localStorage.getItem(storageKey) as ScaleKey | null;
      return v && v in SCALE_VALUES ? v : 'besar';
    } catch {
      return 'besar';
    }
  });

  const slide = slides[pos.i];
  const steps = stepsFor(slide);

  const stepsBefore = useMemo(
    () => slides.slice(0, pos.i).reduce((n, s) => n + stepsFor(s), 0),
    [pos.i, slides],
  );
  const totalSteps = useMemo(() => slides.reduce((n, s) => n + stepsFor(s), 0), [slides]);
  const globalStep = stepsBefore + pos.s + 1;

  const next = useCallback(() => {
    setPos((p) => {
      const st = stepsFor(slides[p.i]);
      if (p.s < st - 1) return { i: p.i, s: p.s + 1 };
      if (p.i < total - 1) return { i: p.i + 1, s: 0 };
      return p;
    });
  }, [total, slides]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p.s > 0) return { i: p.i, s: p.s - 1 };
      if (p.i > 0) return { i: p.i - 1, s: stepsFor(slides[p.i - 1]) - 1 };
      return p;
    });
  }, [slides]);

  const goSlide = useCallback((i: number) => setPos({ i, s: 0 }), []);

  const toggleFullscreen = useCallback(() => {
    const doc = document;
    if (!doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => {});
    else doc.exitFullscreen?.().catch(() => {});
  }, []);

  const exit = useCallback(() => { window.location.hash = exitHash; }, [exitHash]);

  const start = useCallback(() => {
    setStarted(true);
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const changeScale = useCallback((k: ScaleKey) => {
    setScale(k);
    try { localStorage.setItem(storageKey, k); } catch { /* abaikan */ }
  }, [storageKey]);

  useEffect(() => { document.title = docTitle; }, [docTitle]);

  useEffect(() => {
    const onFullscreen = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) { start(); return; }
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'Spacebar': case 'PageDown': case 'ArrowDown': case 'Enter':
          e.preventDefault(); next(); break;
        case 'ArrowLeft': case 'PageUp': case 'ArrowUp': case 'Backspace':
          e.preventDefault(); prev(); break;
        case 'Home': e.preventDefault(); setPos({ i: 0, s: 0 }); break;
        case 'End': e.preventDefault(); setPos({ i: total - 1, s: stepsFor(slides[total - 1]) - 1 }); break;
        case 'Escape': exit(); break;
        case 'f': case 'F': toggleFullscreen(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, total, exit, toggleFullscreen, started, start, slides]);

  const baseFont = `calc(clamp(0.95rem, 0.5rem + 0.8vw, 1.5rem) * ${SCALE_VALUES[scale]})`;

  return (
    <div className="min-h-screen bg-[#0E0E0E] text-white flex flex-col overflow-hidden" style={{ ['--ps' as string]: SCALE_VALUES[scale] }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <GehcLogo size={32} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex items-center gap-1 mr-2 rounded-full bg-white/5 border border-white/10 p-1">
            <span className="px-2 text-white/40" title="Ukuran teks"><Type className="w-3.5 h-3.5" /></span>
            {(['normal', 'besar', 'tv'] as ScaleKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => changeScale(k)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${scale === k ? 'bg-white text-[#0E0E0E]' : 'text-white/60 hover:text-white'}`}
              >
                {k}
              </button>
            ))}
          </div>
          <button type="button" onClick={toggleFullscreen} title="Fullscreen (F)" className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            {isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={exit} title="Keluar (Esc)" className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Body — klik di mana saja = maju satu konten */}
      <main
        className="flex-1 flex items-center justify-center relative px-3 sm:px-6 cursor-pointer select-none"
        onClick={() => { if (!started) start(); else next(); }}
        style={{ fontSize: baseFont }}
        role="button"
        tabIndex={0}
        aria-label="Lanjut"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: reduce ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -24 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[min(1600px,94vw)] mx-auto"
            aria-live="polite"
          >
            <SlideBody slide={slide} step={pos.s} reduce={reduce} />
          </motion.div>
        </AnimatePresence>

        {/* Start overlay */}
        {!started && (
          <div className="absolute inset-0 bg-[#0E0E0E]/80 backdrop-blur-sm flex items-center justify-center" style={{ fontSize: '1rem' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); start(); }}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-white text-lg font-black uppercase tracking-wider shadow-2xl"
            >
              <Play className="w-5 h-5" /> Mulai Presentasi
            </button>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      <footer className="px-4 sm:px-8 py-5 shrink-0">
        <div className="max-w-[min(1600px,94vw)] mx-auto">
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] transition-all duration-300" style={{ width: `${(globalStep / totalSteps) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={prev} disabled={pos.i === 0 && pos.s === 0} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <button type="button" onClick={next} disabled={pos.i === total - 1 && pos.s === steps - 1} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] text-xs font-bold disabled:opacity-30 transition-all">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === pos.i ? 'bg-[#FF416C] w-5' : 'w-2 bg-white/25 hover:bg-white/50'}`}
                />
              ))}
            </div>

            <span className="text-xs font-bold text-white/50 tabular-nums">
              {pos.i + 1} / {total} · poin {pos.s + 1}/{steps}
            </span>
          </div>
          <p className="hidden sm:block text-center text-[10px] text-white/30 mt-3">
            Klik / Spasi / ↓ / → maju poin · ↑ / ← mundur · F fullscreen · Esc keluar
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PitchDeck;
