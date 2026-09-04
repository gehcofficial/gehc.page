import React, { useMemo } from 'react';
import { Crown, Landmark, Network, Users2, Loader2, Sparkles } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { SectionHeader, Reveal } from './ui/SectionHeader';
import { PANTATUGAS } from '../../lib/pantatugas';
import { OrgTreeSection } from './StrukturSection';
import { useMediaSlots } from '../../hooks/useMediaSlots';
import { usePublicOrgTree, type PublicOrgMember } from '../../hooks/usePublicOrgTree';
import { slugifyPerson } from '../../config/media';
import { displayAvatar } from '../../lib/avatar';
import { trLabel } from '../../i18n';

type Member = PublicOrgMember & { bio?: string | null };

const byDiv = (list: Member[], division: string) =>
  list.filter((m) => (m.division || '').toUpperCase() === division);

/**
 * Tab "Pengurus": pohon hirarki dari org tree + kartu foto per tim.
 * Akun @gehc.demo tidak pernah dipublikasikan (disaring di API).
 */
export const KomisiSection: React.FC = () => {
  const { t } = useLang();
  const { data, isLoading } = usePublicOrgTree();

  const sorted = useMemo(
    () => [...(data?.members || [])].sort((a, b) => a.order - b.order),
    [data]
  );

  if (isLoading) {
    return (
      <section id="our-people" className="py-24 flex items-center justify-center gap-2 text-xs text-[#8C8880] scroll-mt-28">
        <Loader2 className="w-4 h-4 animate-spin" /> {t.leadersPage.loading}
      </section>
    );
  }

  const bpmjTeam = byDiv(sorted, 'BPMJ').filter((m) => !m.isOpenRole);
  const coreTeam = byDiv(sorted, 'KOMISI').filter((m) => !m.isOpenRole);
  const workingTeam = byDiv(sorted, 'TIMKERJA').filter((m) => !m.isOpenRole);
  const pillarGroups = PANTATUGAS.map((pillar, i) => {
    const all = sorted.filter((m) => (m.division || '').toUpperCase() === pillar.name);
    return {
      pillar,
      displayLabel: t.serve.items[i]?.label ?? pillar.label,
      filled: all.filter((m) => !m.isOpenRole),
      open: all.filter((m) => m.isOpenRole),
    };
  });

  return (
    <section id="our-people" className="py-12 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto scroll-mt-28">
      <SectionHeader
        eyebrow={t.leadersPage.eyebrow}
        title={t.leadersPage.title}
        subtitle=""
        align="center"
      />

      <div className="mt-14 space-y-14">
        <Reveal>
          <OrgTreeSection />
        </Reveal>

        {bpmjTeam.length > 0 && (
          <PhotoTeam
            icon={<Crown className="w-4 h-4 text-[#FF416C]" />}
            title={t.leadersPage.bpmjLabel}
            members={bpmjTeam}
            badge={t.leadersPage.bpmjLabel}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          />
        )}

        {coreTeam.length > 0 && (
          <PhotoTeam
            icon={<Landmark className="w-4 h-4 text-[#FF416C]" />}
            title={t.leadersPage.coreLabel}
            members={coreTeam}
            badge={t.leadersPage.coreLabel}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          />
        )}

        {workingTeam.length > 0 && (
          <PhotoTeam
            icon={<Network className="w-4 h-4 text-[#FF416C]" />}
            title={t.leadersPage.supportLabel}
            members={workingTeam}
            badge={t.leadersPage.supportLabel}
            cols="grid-cols-1 sm:grid-cols-3"
          />
        )}

        <div>
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/60">
            <Users2 className="w-4 h-4 text-[#FF416C]" />
            <h3 className="text-lg sm:text-xl font-bold">{t.leadersPage.pillarsLabel}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pillarGroups.map(({ pillar, displayLabel, filled, open }, i) => (
              <Reveal key={pillar.name} delay={i * 0.05}>
                <div
                  className="h-full bg-white rounded-[28px] p-6 border-t-4 hover:shadow-xl transition-shadow duration-300"
                  style={{ borderColor: pillar.color }}
                >
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <h4
                      className="text-sm font-black uppercase tracking-wide"
                      style={{ color: pillar.color }}
                    >
                      {displayLabel}
                    </h4>
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
                      style={{ backgroundColor: pillar.color }}
                    >
                      {filled.length + open.length}
                    </span>
                  </div>

                  {filled.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/40 mb-2"
                    >
                      <PersonThumb member={m} />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold truncate">{m.name}</span>
                        <span className="block text-[10px] text-[#8C8880] truncate">
                          {[m.subdivision, m.position]
                            .filter(Boolean)
                            .map((s) => trLabel(t.orgTree.labels, s as string))
                            .join(' · ')}
                        </span>
                      </div>
                    </div>
                  ))}

                  {open.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {open.map((m) => (
                        <span
                          key={m.id}
                          title={
                            [m.subdivision, m.position]
                              .filter(Boolean)
                              .map((s) => trLabel(t.orgTree.labels, s as string))
                              .join(' · ') || trLabel(t.orgTree.labels, m.name)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F1EC] border border-dashed border-[#8C8880]/40 text-[9px] font-bold uppercase tracking-wider text-[#8C8880]"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {trLabel(t.orgTree.labels, m.subdivision || m.position || m.name)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const PhotoTeam: React.FC<{
  icon: React.ReactNode;
  title: string;
  members: Member[];
  badge: string;
  cols: string;
}> = ({ icon, title, members, badge, cols }) => (
  <div>
    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/60">
      {icon}
      <h3 className="text-lg sm:text-xl font-bold">{title}</h3>
    </div>
    <div className={`grid ${cols} gap-5`}>
      {members.map((member, i) => (
        <Reveal key={member.id} delay={i * 0.06}>
          <PersonCard member={member} badge={badge} />
        </Reveal>
      ))}
    </div>
  </div>
);

const PersonThumb: React.FC<{ member: Member }> = ({ member }) => {
  const slots = useMediaSlots();
  return (
    <img
      src={displayAvatar(member.name, member.photoUrl || slots.pengurus[slugifyPerson(member.name)])}
      alt={member.name}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className="w-9 h-9 rounded-full object-cover border border-[#D9D7D0]"
    />
  );
};

const PersonCard: React.FC<{ member: Member; badge: string }> = ({ member, badge }) => {
  const { t } = useLang();
  const slots = useMediaSlots();
  return (
    <div className="group h-full bg-white rounded-[32px] overflow-hidden border border-[#D9D7D0]/40 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="h-44 w-full relative overflow-hidden bg-[#F0EFEB]">
        <img
          src={displayAvatar(member.name, member.photoUrl || slots.pengurus[slugifyPerson(member.name)])}
          alt={member.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur text-[9px] font-black uppercase tracking-wider text-[#1B1B1B]">
          {badge}
        </span>
      </div>
      <div className="p-5">
        <h4 className="text-base font-bold leading-snug">{member.name}</h4>
        {member.position && (
          <p className="text-xs font-semibold text-[#FF416C] mt-1">
            {trLabel(t.orgTree.labels, member.position)}
          </p>
        )}
        {member.bio && (
          <p className="text-[11px] text-[#8C8880] mt-2 line-clamp-3 leading-relaxed">{member.bio}</p>
        )}
      </div>
    </div>
  );
};
