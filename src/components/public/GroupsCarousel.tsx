import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight, Calendar, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { MiniFamilyTree } from './FamilyTree';
import { SectionHeader } from './ui/SectionHeader';

export const GroupsCarousel: React.FC = () => {
  const { groups, groupBatches, openGroupDetail } = useApp();
  const { t } = useLang();
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = card ? card.offsetWidth + 24 : 320;
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
  };

  const currentBatchFor = (groupId: string) =>
    groupBatches.find((b) => b.group_id === groupId && b.isCurrent);

  // Regeneration naming: only show parent groups (no parentGroupId) on landing
  // Child groups (regenerasi) are shown in detail page via HeritageSection
  const visibleGroups = groups
    .filter((g) => !g.parentGroupId && currentBatchFor(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="py-14 sm:py-20 bg-[#F3F1EC] border-y border-[#D9D7D0]/50 overflow-hidden">
      <SectionHeader
        eyebrow={t.groups.eyebrow}
        title={t.groups.title}
        subtitle={t.groups.sub}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollByCard(-1)}
              aria-label="Scroll left"
              className="w-10 h-10 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] hover:bg-black hover:text-white transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollByCard(1)}
              aria-label="Scroll right"
              className="w-10 h-10 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center text-[#1B1B1B] hover:bg-black hover:text-white transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Carousel Track */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        <div
          ref={trackRef}
          className="flex gap-6 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleGroups.map((grp, i) => {
            const batch = currentBatchFor(grp.id)!;
            return (
              <article
                key={grp.id}
                data-card
                onClick={() => openGroupDetail(grp.id)}
                className={`group relative shrink-0 w-[300px] sm:w-[340px] snap-start cursor-pointer rounded-[28px] bg-white border border-[#D9D7D0]/60 p-5 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col gap-4`}
              >
                {/* Nomor urut dekoratif */}
                <span className="absolute top-4 right-5 text-[42px] font-black leading-none font-display opacity-10 select-none" style={{ color: grp.color }}>
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Identitas grup */}
                <div className="flex items-center gap-3 pr-8">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md font-black text-sm shrink-0"
                    style={{ backgroundColor: grp.color }}
                  >
                    {grp.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black tracking-tight text-[#1B1B1B] truncate">{grp.name}</h3>
                    <p className="text-[11px] text-[#8C8880] truncate">{grp.meaning}</p>
                  </div>
                </div>

                {/* Mini Family Tree (Mentor & Comentor saja) */}
                <MiniFamilyTree mentor={batch.mentor} comentor={batch.comentor} color={grp.color} />

                {/* Meta */}
                <div className="space-y-1.5 text-[11px] text-[#8C8880]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 shrink-0" style={{ color: grp.color }} />
                    <span className="truncate">{grp.meetingSchedule}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 shrink-0 text-blue-500" />
                    <span className="truncate">{grp.meetingLocation}</span>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-3 mt-auto border-t border-[#D9D7D0]/40 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
                    {grp.memberCount} {t.groups.membersSuffix} • Detail
                  </span>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-transform group-hover:translate-x-0.5"
                    style={{ backgroundColor: grp.color }}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
