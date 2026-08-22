import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Calendar, BookOpen, Users, ArrowUpRight } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { setPublicTab, setActiveView, currentTenant } = useApp();

  return (
    <section className="pt-[140px] sm:pt-[170px] lg:pt-[200px] px-4 sm:px-8 max-w-[1440px] mx-auto flex flex-col items-center text-center relative overflow-visible pb-[60px] sm:pb-[90px]">
      
      {/* Top Pill Chip */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-[#D9D7D0] shadow-sm mb-6 animate-fade-in">
        <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#FF416C] to-[#FF4B2B] animate-pulse"></span>
        <span className="text-xs font-semibold tracking-wide text-[#1B1B1B]">
          {currentTenant.name} • GMIM Eben Haezer Cikarang
        </span>
      </div>

      {/* Main Display Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-black text-[#1B1B1B] tracking-tight leading-[1.06] max-w-5xl mb-6 text-balance font-display">
        Bring every youth into focus
      </h1>

      {/* Editorial Subtitle */}
      <p className="text-base sm:text-lg md:text-xl text-[#8C8880] max-w-2xl mb-8 leading-relaxed font-normal">
        Membangun ekosistem pemuda yang bertumbuh dalam firman, saling menguatkan dalam 10 persekutuan sel, dan berkarya nyata di tengah dinamika Cikarang.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3.5 mb-12">
        <button
          onClick={() => setPublicTab('weekly-info')}
          className="px-6 py-3 rounded-full bg-[#181818] hover:bg-black text-white text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xl hover:shadow-2xl flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4 text-[#FF416C]" />
          <span>Baca Warta Pemuda</span>
        </button>

        <button
          onClick={() => setPublicTab('activity')}
          className="px-6 py-3 rounded-full bg-white/80 hover:bg-white text-[#1B1B1B] text-xs sm:text-sm font-bold tracking-wide transition-all border border-[#D9D7D0] shadow-sm hover:shadow flex items-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          <span>Agenda & Kegiatan</span>
        </button>

        <button
          onClick={() => setPublicTab('groups')}
          className="px-6 py-3 rounded-full bg-white/80 hover:bg-white text-[#1B1B1B] text-xs sm:text-sm font-bold tracking-wide transition-all border border-[#D9D7D0] shadow-sm hover:shadow flex items-center gap-2"
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>10 Small Groups</span>
        </button>
      </div>

      {/* High-Impact Visual Banner Container */}
      <div className="w-full max-w-[1320px] bg-[#F0EFEB] overflow-hidden shadow-2xl relative z-10 rounded-[32px] sm:rounded-[44px] h-[360px] sm:h-[500px] md:h-[620px] border border-[#D9D7D0]/40 group">
        <img
          alt="GMIM Eben Haezer Cikarang Youth Praise and Fellowship"
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-700"
          src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2000&auto=format&fit=crop"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"></div>
        
        {/* Floating Highlight Banner inside Photo */}
        <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-left">
          <div className="max-w-xl text-white">
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-white mb-2 inline-block">
              Ibadah Kreatif & Persekutuan Pemuda
            </span>
            <h3 className="text-xl sm:text-3xl font-black tracking-tight text-white mb-1">
              "Faith in the Fast Lane: Light in the Valley"
            </h3>
            <p className="text-xs sm:text-sm text-white/80 line-clamp-2">
              Setiap Sabtu Pkl 18:30 WIB di Main Sanctuary GMIM Eben Haezer Cikarang. Terbuka bagi seluruh pemuda dan pekerja muda.
            </p>
          </div>

          <button
            onClick={() => setActiveView('portal')}
            className="px-5 py-2.5 rounded-full bg-white/90 hover:bg-white text-black text-xs font-bold shrink-0 shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all"
          >
            <span>Masuk Portal Pelayanan</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
