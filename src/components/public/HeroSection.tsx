import React from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { Calendar, BookOpen, Users, ArrowUpRight } from 'lucide-react';
import { MEDIA, IMG_PROPS } from '../../config/media';

export const HeroSection: React.FC = () => {
  const { setPublicTab } = useApp();
  const { t } = useLang();

  return (
    <section className="pt-[140px] sm:pt-[170px] lg:pt-[200px] px-4 sm:px-8 max-w-[1440px] mx-auto flex flex-col items-center text-center relative overflow-visible pb-[60px] sm:pb-[90px]">

      {/* Top Pill Chip */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-[#D9D7D0] shadow-sm mb-6 animate-fade-in">
        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] animate-pulse"></span>
        <span className="text-xs font-semibold tracking-wide text-[#1B1B1B]">
          {t.hero.chip}
        </span>
      </div>

      {/* Main Display Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-black text-[#1B1B1B] tracking-tight leading-[1.06] max-w-5xl mb-6 text-balance font-display">
        {t.hero.title}
      </h1>

      {/* Editorial Subtitle */}
      <p className="text-base sm:text-lg md:text-xl text-[#8C8880] max-w-2xl mb-8 leading-relaxed font-normal">
        {t.hero.subtitle}
      </p>

      {/* Action Buttons: 1 primer + 2 sekunder */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <button
          onClick={() => setPublicTab('groups')}
          className="px-6 py-3 rounded-full bg-[#181818] hover:bg-black text-white text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xl hover:shadow-2xl flex items-center gap-2"
        >
          <Users className="w-4 h-4 text-[#FF416C]" />
          <span>{t.hero.cta1}</span>
        </button>

        <button
          onClick={() => setPublicTab('bulletin')}
          className="px-5 py-3 rounded-full text-[#1B1B1B]/70 hover:text-[#1B1B1B] text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 underline-offset-4 hover:underline decoration-[#FF416C] decoration-2"
        >
          <BookOpen className="w-4 h-4" />
          <span>{t.hero.cta2}</span>
        </button>

        <button
          onClick={() => setPublicTab('events')}
          className="px-5 py-3 rounded-full text-[#1B1B1B]/70 hover:text-[#1B1B1B] text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 underline-offset-4 hover:underline decoration-[#FF416C] decoration-2"
        >
          <Calendar className="w-4 h-4" />
          <span>{t.hero.cta3}</span>
        </button>
      </div>

      {/* High-Impact Visual Banner + Next Event */}
      <div className="w-full max-w-[1320px] bg-[#F0EFEB] overflow-hidden shadow-2xl relative z-10 rounded-[32px] sm:rounded-[44px] h-[360px] sm:h-[500px] md:h-[620px] border border-[#D9D7D0]/40 group">
        <img
          alt="Young people worshiping together at GEHC Youth, Cikarang"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          src={MEDIA.heroBanner}
          {...IMG_PROPS}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"></div>

        {/* Floating Next-Event Banner inside Photo */}
        <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-left">
          <div className="max-w-xl text-white">
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-white mb-2 inline-block">
              {t.hero.bTag}
            </span>
            <h3 className="text-xl sm:text-3xl font-black tracking-tight text-white mb-1">
              {t.hero.bTitle}
            </h3>
            <p className="text-xs sm:text-sm text-white/80 line-clamp-2">
              {t.hero.bDesc}
            </p>
          </div>

          <button
            onClick={() => setPublicTab('events')}
            className="px-5 py-2.5 rounded-full bg-white/90 hover:bg-white text-black text-xs font-bold shrink-0 shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all"
          >
            <span>{t.hero.bCta}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
