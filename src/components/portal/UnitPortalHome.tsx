import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calendar, Megaphone, Users, LayoutGrid } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePortalProfile } from '../../hooks/usePortalProfile';
import { unitPortalModules, unitPortalTagline } from '../../lib/unit-portal-modules';
import { usePublicOrgTree } from '../../hooks/usePublicOrgTree';

type WartaRow = { id: string; title: string; publishedAt?: string | null; status?: string };

export const UnitPortalHome: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { id: portalId, profile, scopeLabel } = usePortalProfile();
  const { currentRole, currentTenant, contentItems, ensureContent } = useApp();
  const { data: orgTree } = usePublicOrgTree();
  const [memberTotal, setMemberTotal] = useState<number | null>(null);
  const [warta, setWarta] = useState<WartaRow[]>([]);

  useEffect(() => {
    void ensureContent();
  }, [ensureContent]);

  useEffect(() => {
    fetch('/api/unit/members', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMemberTotal(Array.isArray(d?.members) ? d.members.length : 0))
      .catch(() => setMemberTotal(null));
  }, [portalId]);

  useEffect(() => {
    fetch('/api/internal-warta', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { warta: [] }))
      .then((d) => setWarta((Array.isArray(d?.warta) ? d.warta : []).slice(0, 5)))
      .catch(() => setWarta([]));
  }, [portalId]);

  const modules = useMemo(() => {
    return unitPortalModules(portalId).filter((m) => !m.roles || m.roles.includes(currentRole));
  }, [portalId, currentRole]);

  const publishedAgenda = contentItems.filter((c) => c.type === 'ACTIVITY' && c.is_published).length;
  const publishedWarta = contentItems.filter((c) => c.type === 'WEEKLY_INFO' && c.is_published).length;

  const orgPreview = (orgTree?.members || []).filter((m) => m.name && !m.isOpenRole).slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-[#181818] via-[#222] to-[#181818] rounded-[28px] p-6 sm:p-8 text-white border border-white/10 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-wider">
            {profile.shortLabel}
          </span>
          <span className="text-[11px] text-white/60">{scopeLabel}</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">{profile.label}</h2>
        <p className="text-sm text-white/75 mt-2 max-w-2xl">{unitPortalTagline(portalId)}</p>
        <p className="text-[11px] text-white/50 mt-2">
          Tenant aktif: <strong className="text-white/80">{currentTenant.name}</strong> · peran{' '}
          <strong className="text-brand uppercase">{currentRole}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border border-[#D9D7D0] p-4">
          <Users className="w-4 h-4 text-brand" />
          <p className="text-[10px] text-[#8C8880] mt-2 uppercase font-bold">Anggota unit</p>
          <p className="text-2xl font-black">{memberTotal ?? '—'}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#D9D7D0] p-4">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <p className="text-[10px] text-[#8C8880] mt-2 uppercase font-bold">Agenda aktif</p>
          <p className="text-2xl font-black">{publishedAgenda}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#D9D7D0] p-4">
          <Megaphone className="w-4 h-4 text-purple-600" />
          <p className="text-[10px] text-[#8C8880] mt-2 uppercase font-bold">Warta publik</p>
          <p className="text-2xl font-black">{publishedWarta}</p>
        </div>
        <div className="rounded-2xl bg-white border border-[#D9D7D0] p-4">
          <LayoutGrid className="w-4 h-4 text-sky-600" />
          <p className="text-[10px] text-[#8C8880] mt-2 uppercase font-bold">Modul MVP</p>
          <p className="text-2xl font-black">{modules.length}</p>
        </div>
      </div>

      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5">
        <h3 className="text-sm font-black uppercase tracking-wide mb-3">Modul unit</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onNavigate(m.tab)}
              className="text-left p-4 rounded-2xl border border-[#EFEDE8] hover:border-brand transition-colors group"
            >
              <p className="text-xs font-black text-[#1B1B1B] group-hover:text-brand">{m.title}</p>
              <p className="text-[11px] text-[#8C8880] mt-1 leading-relaxed">{m.description}</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-2 text-[#1B1B1B]">
                Buka <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wide">Info &amp; peluang terbaru</h4>
          {warta.length === 0 ? (
            <p className="text-xs text-[#8C8880]">Belum ada info internal untuk unit ini.</p>
          ) : (
            warta.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-xs p-2 rounded-xl border border-[#EFEDE8]">
                <span className="truncate font-medium">{w.title}</span>
                <span className="text-[10px] text-[#8C8880] shrink-0 ml-2">{w.status || ''}</span>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => onNavigate('internal-warta')}
            className="text-[11px] font-bold text-brand flex items-center gap-1"
          >
            Semua info <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wide">Cuplikan struktur (publik)</h4>
          {orgPreview.length === 0 ? (
            <p className="text-xs text-[#8C8880]">Struktur organisasi landing akan tampil setelah data OrgNode diisi.</p>
          ) : (
            orgPreview.map((m) => (
              <div key={m.id} className="text-xs p-2 rounded-xl border border-[#EFEDE8]">
                <span className="font-bold">{m.name}</span>
                {m.position && <span className="text-[#8C8880]"> · {m.position}</span>}
              </div>
            ))
          )}
          {portalId === 'jemaat' && (
            <button
              type="button"
              onClick={() => onNavigate('org-hierarchy')}
              className="text-[11px] font-bold text-brand flex items-center gap-1"
            >
              Kelola hirarki <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnitPortalHome;
