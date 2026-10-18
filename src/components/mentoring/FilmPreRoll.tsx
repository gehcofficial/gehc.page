import React, { useEffect, useState } from 'react';
import {
  Clapperboard,
  DoorOpen,
  Film,
  Megaphone,
  MoonStar,
  Popcorn,
  Smartphone,
  Sparkles,
  Stamp,
  Ticket,
  Volume2,
} from 'lucide-react';
import { buildFilmPreRoll, type PreRollIcon, type PreRollSlide } from '../../lib/film-preroll';

const ICONS: Record<PreRollIcon, React.ComponentType<{ className?: string }>> = {
  clapperboard: Clapperboard,
  stamp: Stamp,
  film: Film,
  volume: Volume2,
  smartphone: Smartphone,
  popcorn: Popcorn,
  sparkles: Sparkles,
  moon: MoonStar,
  door: DoorOpen,
  ticket: Ticket,
  megaphone: Megaphone,
};

/** Jeda ganti slide (detik) — cukup lama untuk dibaca dari baris belakang. */
const ROTATE_MS = 7000;

/**
 * Slideshow pengumuman ala pre-show bioskop untuk kartu "Bersiap menonton"
 * (BEDAH_FILM): tiap slide muncul dengan animasi + ikon besar, berganti
 * otomatis. Judul film tetap terlihat di strip atas. Deck dari
 * `buildFilmPreRoll` (default bawaan + pengumuman tambahan operator).
 */
const FilmPreRoll: React.FC<{
  title: string;
  durationMin: number;
  customLines?: string[];
}> = ({ title, durationMin, customLines }) => {
  const slides = buildFilmPreRoll({ title, durationMin, customLines });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const slide: PreRollSlide | undefined = slides[Math.min(index, slides.length - 1)];
  if (!slide) return null;
  const Icon = ICONS[slide.icon];

  return (
    <section className="rounded-[28px] bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-8 sm:p-12 flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-white/50">
        <span className="text-brand shrink-0">Bersiap menonton</span>
        <span className="truncate text-right" title={title}>
          {title}
          {durationMin > 0 && <span className="text-white/40"> · ±{durationMin}&#8242;</span>}
        </span>
      </div>

      <div
        key={slide.id}
        className={`flex-1 flex flex-col items-center justify-center text-center gap-5 sm:gap-7 py-8 ${
          slide.variant === 'stamp' ? 'film-preroll-stamp' : 'film-preroll-enter'
        }`}
      >
        <span className="rounded-full bg-white/10 border border-white/15 p-5 sm:p-7">
          <Icon className="w-12 h-12 sm:w-16 sm:h-16 text-brand" />
        </span>
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.4em] text-brand">{slide.kicker}</p>
        <p className="font-display text-4xl sm:text-6xl xl:text-7xl font-black leading-tight text-balance max-w-5xl">
          {slide.headline}
        </p>
        {slide.sub && <p className="text-base sm:text-2xl text-white/60 max-w-3xl">{slide.sub}</p>}
      </div>

      <div className="flex justify-center gap-1.5" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.id} className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-6 bg-brand' : 'w-1.5 bg-white/20'}`} />
        ))}
      </div>
    </section>
  );
};

export default FilmPreRoll;
