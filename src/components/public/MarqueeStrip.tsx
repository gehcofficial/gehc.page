import React from 'react';
import { useApp } from '../../context/AppContext';

export const MarqueeStrip: React.FC = () => {
  const { groups, setPublicTab } = useApp();

  return (
    <section className="py-10 border-y border-[#D9D7D0]/50 bg-[#FAF9F5] overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 mb-4 text-center">
        <p className="text-[11px] font-bold text-[#8C8880] uppercase tracking-widest">
          B E Y O N D E R S
        </p>
      </div>

      <div className="relative w-full overflow-hidden">
        <div className="flex animate-marquee gap-8 items-center cursor-pointer">
          {/* Double list for smooth loop */}
          {[...groups, ...groups].map((grp, idx) => (
            <div
              key={`${grp.id}-${idx}`}
              onClick={() => setPublicTab('groups')}
              className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/70 hover:bg-white border border-[#D9D7D0]/60 shadow-sm shrink-0 transition-all hover:scale-105"
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: grp.color }}
              ></div>
              <span className="text-sm font-black tracking-tight text-[#1B1B1B]">
                {grp.name}
              </span>
              <span className="text-xs text-[#8C8880] hidden sm:inline truncate max-w-[160px]">
                {(grp.meaning || '').split('&')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
