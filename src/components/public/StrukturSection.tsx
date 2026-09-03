import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { trLabel } from '../../i18n';
import {
  ChevronDown,
  ChevronRight,
  Crown,
  Flame,
  Loader2,
} from 'lucide-react';
import { PANTATUGAS, DIVISION_HEAD_POSITION, subDivisions } from '../../lib/pantatugas';

// Daftar nama divisi structural
const structuralNames = ['BPMJ', 'KOMISI', 'LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];

// Warna per divisi struktur (BPMJ, Komisi, dll)
const STRUCTURAL_COLORS = {
  BPMJ: '#ED8936',
  KOMISI: '#FF416C',
  LITURGIA: '#7C3AED',
  DIDASKALIA: '#0EA5E9',
  KOINONIA: '#059669',
  DIAKONIA: '#EA580C',
  MARTURIA: '#DC2626',
  BENZARPR: '#F6AE4A',
}

// Jumlah sub-divisi per pillar (HoD ditampilkan terpisah)
const divisionCounts: Record<string, number> = Object.fromEntries(
  PANTATUGAS.map((p) => [p.name, subDivisions(p.name).length])
);

interface Member {
  id: string;
  name: string;
  position?: string;
  division?: string;
  subdivision?: string | null;
  photoUrl?: string;
  email?: string;
  order: number;
  isOpenRole?: boolean;
}

const initialsAvatar = (name: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || '?')}&backgroundColor=1b1b1b`;

interface PillarDef {
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const PillarCard: React.FC<{ pillar: PillarDef; members: Member[]; isStructural?: boolean }> = ({ pillar, members, isStructural = false }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const Icon = isStructural ? (structuralNames.includes(pillar.name) ? Crown : Flame) : pillar.icon;
  const tr = (value?: string | null) => trLabel(t.orgTree.labels, value);
  const serveIdx = PANTATUGAS.findIndex((p) => p.name === pillar.name);
  const tagline = t.serve.items[serveIdx]?.tagline ?? pillar.tagline;
  const displayName = t.serve.items[serveIdx]?.label ?? pillar.name;
  const subCount = divisionCounts[pillar.name] ?? 0;
  const officerWord = subCount === 1 ? t.orgTree.officer : t.orgTree.officers;
  const hasHod = pillar.name !== 'BENZARPR';

  const headMembers = useMemo(
    () => members.filter((m) => m.position === DIVISION_HEAD_POSITION),
    [members]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of members) {
      if (m.position === DIVISION_HEAD_POSITION) continue;
      const key = m.subdivision?.trim() || t.orgTree.membersFallback;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [members, t.orgTree.membersFallback]);

  return (
    <div className="rounded-3xl border border-[#D9D7D0]/60 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#FAF9F5] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${STRUCTURAL_COLORS[pillar.name] || pillar.color}1A`, color: STRUCTURAL_COLORS[pillar.name] || pillar.color }}>
          {isStructural && structuralNames.includes(pillar.name) ? (
            <Crown className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-wide" style={{ color: STRUCTURAL_COLORS[pillar.name] || pillar.color }}>
            {displayName}
          </p>
          {isStructural && (
            <p className="text-[10px] text-[#8C8880] truncate">{tagline}</p>
          )}
          <p className="text-[10px] text-[#8C8880] uppercase tracking-widest">
            {hasHod ? `${t.orgTree.headDivisionLabel} · ` : ''}{subCount} {officerWord}
          </p>
        </div>
        <span className="text-[10px] font-bold text-[#8C8880] bg-[#F3F1EC] rounded-full px-2 py-0.5 shrink-0">
          {members.length}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#8C8880] shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#8C8880] shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-dashed border-[#D9D7D0]/70 px-4 py-3 space-y-3 bg-[#FAF9F5]/60">
          {hasHod && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] mb-1.5">
                {t.orgTree.headDivisionLabel}
              </p>
              {headMembers.length === 0 && (
                <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3F1EC] border border-dashed border-[#8C8880]/40 text-[#8C8880]">
                  {t.orgTree.headRecruiting} — {t.orgTree.openSuffix}
                </span>
              )}
              {headMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <img
                    src={m.photoUrl || initialsAvatar(m.name)}
                    alt={m.name}
                    className={`w-7 h-7 rounded-full object-cover bg-white ${
                      m.isOpenRole
                        ? 'border border-dashed border-[#8C8880]/50'
                        : 'border border-[#D9D7D0]'
                    }`}
                  />
                  <div className="min-w-0">
                    {m.isOpenRole ? (
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3F1EC] border border-dashed border-[#8C8880]/40 text-[#8C8880]">
                        {tr(m.name) || m.name} — {t.orgTree.openSuffix}
                      </span>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-[#1B1B1B] truncate">{m.name}</p>
                        <p className="text-[10px] text-[#8C8880] truncate">{tr(m.position)}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {groups.length === 0 && headMembers.length === 0 && (
            <p className="text-xs text-[#8C8880] italic">{t.orgTree.emptyPillar}</p>
          )}
          {groups.map(([sub, list]) => (
            <div key={sub}>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] mb-1.5">
                {tr(sub) || t.orgTree.membersFallback}
              </p>
              <div className="space-y-1.5">
                {list.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <img
                      src={m.photoUrl || initialsAvatar(m.name)}
                      alt={m.name}
                      className={`w-7 h-7 rounded-full object-cover bg-white ${
                        m.isOpenRole
                          ? 'border border-dashed border-[#8C8880]/50'
                          : 'border border-[#D9D7D0]'
                      }`}
                    />
                    <div className="min-w-0">
                      {m.isOpenRole ? (
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3F1EC] border border-dashed border-[#8C8880]/40 text-[#8C8880]">
                          {tr(m.name) || m.name} — {t.orgTree.openSuffix}
                        </span>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-[#1B1B1B] truncate">{m.name}</p>
                          {m.position && m.position !== sub && (
                            <p className="text-[10px] text-[#8C8880] truncate">{tr(m.position)}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Pohon Struktur Organisasi GEHC Youth — based on revision pantatugas.md.
 * Hierarki lengkap:
 *   BPMJ → Komisi Pemuda → Tim Kerja
 *       → BEYONDERS (kelompok mentoring — detail di navbar #/beyonders)
 *       → 5 Panca Tugas (Liturgia..Marturia) → Sub-divisi
 *       → Benzarpreneurship/BZP (Merchandise · Fundraising · Donation)
 * Sub-divisi bersifat extensible — cukup tambah data, tanpa ubah kode.
 */

interface PillarDef {
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const OrgTreeSection: React.FC = () => {
  const { strukturMembers } = useApp();
  const { t } = useLang();
  const [members, setMembers] = useState<Member[] | null>(null);
  const tr = (value?: string | null) => trLabel(t.orgTree.labels, value);

  // API-first: ambil dari TiDB; gagal → fallback data lokal
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

  if (!members) {
    return (
      <section className="py-24 flex items-center justify-center gap-2 text-xs text-[#8C8880]">
        <Loader2 className="w-4 h-4 animate-spin" /> {t.leadersPage.loadingTree}
      </section>
    );
  }

  const sorted = [...members].sort((a, b) => a.order - b.order);

  // --- Level 1: BPMJ (Badan Pekerja Majelis Jemaat) ---
  const bpmjMembers = sorted.filter(
    (m) => m.division && m.division.toUpperCase() === 'BPMJ'
  );

  // --- Level 2: Komisi Pemuda ---
  const komisiMembers = sorted.filter(
    (m) => m.division && m.division.toUpperCase() === 'KOMISI'
  );

  // --- Level 2b: BOD Tim Kerja ---
  const timKerjaMembers = sorted.filter(
    (m) => m.division && m.division.toUpperCase() === 'TIMKERJA'
  );

  // --- Level 3: 6 Divisi (Panca Tugas + Benzarpreneurship) + Sub-divisi ---
  const structuralMembers = structuralNames.reduce((acc, pName) => {
    const pillarMembers = sorted.filter(
      (m) => m.division && m.division.toUpperCase() === pName
    );
    return acc.concat(pillarMembers);
  }, [] as Member[]);

  return (
    <section className="max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-8 h-1 rounded-full bg-[#FF416C]" />
        <h3 className="text-lg sm:text-xl font-bold text-[#1B1B1B]">{t.orgTree.heading}</h3>
      </div>

      {/* Level 1: BPMJ — Badan Pekerja Majelis Jemaat (nama asli) */}
      <div className="rounded-3xl border border-[#D9D7D0]/60 bg-gradient-to-r from-[#181818] to-[#262626] p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-white">{t.orgTree.bpmjTitle}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">{t.orgTree.bpmjSub}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {bpmjMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 min-w-0">
              <img
                src={m.photoUrl || initialsAvatar(m.name)}
                alt={m.name}
                className="w-8 h-8 rounded-full object-cover border border-white/20"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white truncate">{m.name}</p>
                {m.position && (
                  <p className="text-[9px] text-white/50 truncate">{tr(m.position)}</p>
                )}
              </div>
            </div>
          ))}
          {bpmjMembers.length === 0 && (
            <p className="text-xs text-white/40 italic col-span-full">{t.orgTree.bpmjEmpty}</p>
          )}
        </div>
      </div>

      {/* Level 2: Komisi Pemuda */}
      <div className="rounded-3xl border-2 border-[#FF416C]/25 bg-white p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-3">
          {t.orgTree.komisiTitle}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {komisiMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 min-w-0">
              <img
                src={m.photoUrl || initialsAvatar(m.name)}
                alt={m.name}
                className="w-9 h-9 rounded-full object-cover border border-[#D9D7D0]"
              />
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{m.name}</p>
                {m.position && (
                  <p className="text-[10px] text-[#8C8880] truncate">{tr(m.position)}</p>
                )}
              </div>
            </div>
          ))}
          {komisiMembers.length === 0 && (
            <p className="text-xs text-[#8C8880] italic col-span-full">{t.orgTree.komisiEmpty}</p>
          )}
        </div>
      </div>

      {/* Level 2b: BOD Tim Kerja — pelaksana program di bawah Komisi */}
      {timKerjaMembers.length > 0 && (
        <div className="rounded-3xl border border-[#D9D7D0]/60 bg-[#FAFAF5] p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#181818] mb-1">
            {t.orgTree.timKerjaTitle}
          </p>
          <p className="text-[10px] text-[#8C8880] mb-3">
            {t.orgTree.timKerjaSub}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {timKerjaMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 min-w-0">
                <img
                  src={m.photoUrl || initialsAvatar(m.name)}
                  alt={m.name}
                  className="w-9 h-9 rounded-full object-cover border border-[#D9D7D0]"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{m.name}</p>
                  {m.position && (
                    <p className="text-[10px] text-[#8C8880] truncate">{tr(m.position)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level 3: Enam Divisi (5 Panca Tugas + Benzarpreneurship) + Sub-divisi */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 items-start">
        {PANTATUGAS.map((p) => {
          const pillar: PillarDef = { name: p.name, tagline: p.tagline, icon: p.icon, color: p.color };
          const pillarMembers = structuralMembers.filter(
            (m) => m.division && m.division.toUpperCase() === p.name
          );
          return (
            <PillarCard
              key={pillar.name}
              pillar={pillar}
              members={pillarMembers}
              isStructural={structuralNames.includes(pillar.name)}
            />
          );
        })}
      </div>

      {/* Beyonders note — kelompok mentoring (detail di navbar #/beyonders) */}
      <div className="mt-6 p-4 rounded-[20px] border border-[#FF416C]/25 bg-white">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-1">
          {t.orgTree.beyondersTitle}
        </p>
        <p className="text-[11px] text-[#8C8880] leading-relaxed">{t.orgTree.beyondersNote}</p>
      </div>

      <p className="text-center text-[11px] text-[#8C8880] mt-10 italic max-w-lg mx-auto leading-relaxed">
        {t.orgTree.footerNote}
      </p>
    </section>
  );
};