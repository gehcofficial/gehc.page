import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, Network, Users2, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { SectionHeader, Reveal } from './ui/SectionHeader';
import { PANTATUGAS, pillarByName } from '../../lib/pantatugas';
import { OrgTreeSection } from './StrukturSection';

interface Member {
  id: string;
  name: string;
  position?: string;
  division?: string | null;
  subdivision?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  order: number;
  isOpenRole?: boolean;
}

const byDiv = (list: Member[], division: string) =>
  list.filter((m) => (m.division || '').toUpperCase() === division);
const initialsAvatar = (name: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || '?')}&backgroundColor=1b1b1b`;

/**
 * Tab "Pengurus": pohon hirarki (struktur nyata) + kartu orang.
 * Kartu orang hanya tampil bila nama/kontak ASLI sudah diisi —
 * akun placeholder (@gehc.demo) tidak pernah dipublikasikan.
 */
export const KomisiSection: React.FC = () => {
  const { strukturMembers } = useApp();
  const { t } = useLang();
  const [members, setMembers] = useState<Member[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/db/struktur')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => !cancelled && setMembers(d.members))
      .catch(() => !cancelled && setMembers(strukturMembers));
    return () => {
      cancelled = true;
    };
  }, [strukturMembers]);

  const sorted = useMemo(
    () => [...(members || [])].sort((a, b) => a.order - b.order),
    [members]
  );

  if (!members) {
    return (
      <section className="py-24 flex items-center justify-center gap-2 text-xs text-[#8C8880]">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
      </section>
    );
  }

  // Placeholder lama ditandai email @gehc.demo — tidak pernah tampil publik.
  const isPlaceholder = (m: Member) => Boolean(m.email && m.email.endsWith('@gehc.demo'));
  const notOpen = (m: Member) => !m.isOpenRole;
  const hasRealPeople = sorted.some((m) => !isPlaceholder(m));

  const coreTeam = byDiv(sorted, 'KOMISI').filter((m) => !m.isOpenRole && !isPlaceholder(m));
  const workingTeam = byDiv(sorted, 'TIMKERJA').filter(
    (m) => !m.isOpenRole && !isPlaceholder(m)
  );
  const pillarGroups = PANTATUGAS.map((pillar) => {
    const all = sorted.filter((m) => (m.division || '').toUpperCase() === pillar.name);
    return {
      pillar,
      filled: all.filter(notOpen),
      open: all.filter((m) => m.isOpenRole),
    };
  }).filter((g) => g.filled.length > 0 || g.open.length > 0);

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      <SectionHeader
        eyebrow={t.leadersPage.eyebrow}
        title={t.leadersPage.title}
        subtitle=""
        align="center"
      />

      <div className="mt-14 space-y-14">
        {/* Bagian 1: pohon hirarki — struktur selalu informatif */}
        <Reveal>
          <OrgTreeSection />
        </Reveal>

        {/* Bagian 2: kartu pengurus — hanya saat nama asli tersedia */}
        {!hasRealPeople ? (
          <Reveal>
            <div className="rounded-[32px] bg-gradient-to-br from-[#181818] to-[#262626] p-10 text-center">
              <Sparkles className="w-6 h-6 text-[#FF416C] mx-auto mb-3" />
              <h3 className="text-xl font-black text-white">{t.leadersPage.announceTitle}</h3>
              <p className="text-xs text-white/60 mt-2 max-w-md mx-auto leading-relaxed">
                {t.leadersPage.announceBody}
              </p>
            </div>
          </Reveal>
        ) : (
          <>
            {/* Komisi inti */}
            <div>
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/60">
                <Landmark className="w-4 h-4 text-[#FF416C]" />
                <h3 className="text-lg sm:text-xl font-bold">{t.leadersPage.coreLabel}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {coreTeam.map((member, i) => (
                  <Reveal key={member.id} delay={i * 0.06}>
                    <PersonCard member={member} badge={t.leadersPage.coreLabel} />
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Tim Kerja */}
            {workingTeam.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/60">
                  <Network className="w-4 h-4 text-[#FF416C]" />
                  <h3 className="text-lg sm:text-xl font-bold">{t.leadersPage.supportLabel}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {workingTeam.map((member, i) => (
                    <Reveal key={member.id} delay={i * 0.06}>
                      <PersonCard member={member} badge={t.leadersPage.supportLabel} />
                    </Reveal>
                  ))}
                </div>
              </div>
            )}

            {/* Lima fungsi */}
            {pillarGroups.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/60">
                  <Users2 className="w-4 h-4 text-[#FF416C]" />
                  <h3 className="text-lg sm:text-xl font-bold">{t.leadersPage.pillarsLabel}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {pillarGroups.map(({ pillar, filled, open }, i) => (
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
                            {pillar.label}
                          </h4>
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
                            style={{ backgroundColor: pillar.color }}
                          >
                            {filled.length + open.length}
                          </span>
                        </div>

                        {/* Orang yang sudah ada nama */}
                        {filled.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/40 mb-2"
                          >
                            <img
                              src={m.photoUrl || initialsAvatar(m.name)}
                              alt={m.name}
                              loading="lazy"
                              decoding="async"
                              className="w-9 h-9 rounded-full object-cover border border-[#D9D7D0]"
                            />
                            <div className="min-w-0">
                              <span className="block text-xs font-bold truncate">{m.name}</span>
                              <span className="block text-[10px] text-[#8C8880] truncate">
                                {[m.subdivision, m.position].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Posisi terbuka — struktur tampil, tanpa nama palsu */}
                        {open.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {open.map((m) => (
                              <span
                                key={m.id}
                                title={[m.subdivision, m.position].filter(Boolean).join(' · ') || m.name}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F1EC] border border-dashed border-[#8C8880]/40 text-[9px] font-bold uppercase tracking-wider text-[#8C8880]"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                {m.subdivision || m.position || m.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

/** Kartu profil tanpa kontak publik — privasi anggota dijaga. */
const PersonCard: React.FC<{ member: Member; badge: string }> = ({ member, badge }) => {
  const initialsAvatar = (n: string) =>
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;
  return (
    <div className="group h-full bg-white rounded-[32px] overflow-hidden border border-[#D9D7D0]/40 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="h-44 w-full relative overflow-hidden bg-[#F0EFEB]">
        <img
          src={member.photoUrl || initialsAvatar(member.name)}
          alt={member.name}
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
        {member.position && <p className="text-xs font-semibold text-[#FF416C] mt-1">{member.position}</p>}
        {member.bio && (
          <p className="text-[11px] text-[#8C8880] mt-2 line-clamp-3 leading-relaxed">{member.bio}</p>
        )}
      </div>
    </div>
  );
};
