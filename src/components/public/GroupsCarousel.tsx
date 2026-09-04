import React, { useRef } from 'react';
import { ArrowUpRight, Calendar, MapPin, Users } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { MiniFamilyTree } from './FamilyTree';
import { SectionHeader } from './ui/SectionHeader';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { useSteerableMarquee } from '../../hooks/useSteerableMarquee';
import { landingBeyondersHouses } from '../../lib/landing-groups';
import type { YouthGroup } from '../../types';

type GroupCardProps = {
  grp: YouthGroup;
  index: number;
  menteeCount: number;
  mentor: string;
  comentor: string;
  mentorAvatar?: string;
  comentorAvatar?: string;
  seeFamily: string;
  menteeLabel: string;
  onOpen: (id: string) => void;
  coverUrl?: string;
  priority?: boolean;
};

const GroupHouseCard: React.FC<GroupCardProps> = ({
  grp,
  index,
  menteeCount,
  mentor,
  comentor,
  mentorAvatar,
  comentorAvatar,
  seeFamily,
  menteeLabel,
  onOpen,
  coverUrl,
  priority = false,
}) => (
  <article
    data-card
    onClick={() => onOpen(grp.id)}
    className="group relative shrink-0 w-[280px] sm:w-[320px] snap-start cursor-pointer rounded-[28px] bg-white border border-[#D9D7D0]/60 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4"
  >
    {coverUrl ? (
      <div className="h-28 w-full overflow-hidden bg-[#F0EFEB]">
        <img
          src={coverUrl}
          alt={grp.name}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </div>
    ) : null}
    <div className={`px-5 ${coverUrl ? 'pt-1' : 'pt-5'} pb-5 flex flex-col gap-4 flex-1`}>
    <span
      className="absolute top-4 right-5 text-[42px] font-black leading-none font-display opacity-10 select-none"
      style={{ color: grp.color }}
    >
      {String(index + 1).padStart(2, '0')}
    </span>

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

    <MiniFamilyTree
      mentor={mentor}
      comentor={comentor || '—'}
      color={grp.color || '#FF416C'}
      mentorAvatar={mentorAvatar}
      comentorAvatar={comentorAvatar}
    />

    <div className="flex items-center gap-2 text-[11px] text-[#8C8880]">
      <Users className="w-3 h-3 shrink-0" style={{ color: grp.color }} />
      <span>
        {menteeCount} {menteeLabel}
      </span>
    </div>

    <div className="space-y-1.5 text-[11px] text-[#8C8880]">
      {grp.meetingSchedule && (
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 shrink-0" style={{ color: grp.color }} />
          <span className="truncate">{grp.meetingSchedule}</span>
        </div>
      )}
      {grp.meetingLocation && (
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 shrink-0 text-blue-500" />
          <span className="truncate">{grp.meetingLocation}</span>
        </div>
      )}
    </div>

    <div className="pt-3 mt-auto border-t border-[#D9D7D0]/40 flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">{seeFamily}</span>
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-transform group-hover:translate-x-0.5"
        style={{ backgroundColor: grp.color }}
      >
        <ArrowUpRight className="w-3.5 h-3.5" />
      </span>
    </div>
    </div>
  </article>
);

export const GroupsCarousel: React.FC = () => {
  const { groups, groupBatches, openGroupDetail } = useApp();
  const { t } = useLang();
  const slots = useMediaSlots();
  const reduce = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const currentBatchFor = (groupId: string) =>
    groupBatches.find((b) => b.group_id === groupId && b.isCurrent);

  const visibleGroups = landingBeyondersHouses(groups, groupBatches);

  const canLoop = !reduce && visibleGroups.length > 2;
  const rendered = canLoop ? [...visibleGroups, ...visibleGroups] : visibleGroups;

  useSteerableMarquee(viewportRef, trackRef, canLoop);

  return (
    <section className="py-14 sm:py-20 bg-[#F3F1EC] overflow-hidden">
      <SectionHeader
        eyebrow={t.groups.eyebrow}
        title={t.groups.title}
        subtitle={t.groups.sub}
      />

      <div ref={viewportRef} className="relative mt-2 overflow-hidden touch-pan-y">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 sm:w-20 bg-gradient-to-r from-[#F3F1EC] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 sm:w-20 bg-gradient-to-l from-[#F3F1EC] to-transparent" />

        <div
          ref={trackRef}
          className={
            canLoop
              ? 'marquee-houses-track gap-6 pb-4 pt-2 px-4 sm:px-8'
              : 'flex gap-6 overflow-x-auto pb-4 pt-2 px-4 sm:px-8 snap-x snap-mandatory scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          }
        >
          {rendered.map((grp, i) => {
            const batch = currentBatchFor(grp.id);
            const menteeCount = batch?.mentees?.length ?? Math.max(0, (grp.memberCount || 0) - 2);
            const sourceIndex = i % visibleGroups.length;
            return (
              <GroupHouseCard
                key={`${grp.id}-${i}`}
                grp={grp}
                index={sourceIndex}
                menteeCount={menteeCount}
                mentor={batch?.mentor || '—'}
                comentor={batch?.comentor || '—'}
                mentorAvatar={batch?.mentorAvatar}
                comentorAvatar={batch?.comentorAvatar}
                seeFamily={t.groupDetail.seeFamily}
                menteeLabel={t.groupDetail.menteeCount}
                onOpen={openGroupDetail}
                coverUrl={slots.kelompok[grp.name.toLowerCase()]}
                priority={sourceIndex < 4}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};
