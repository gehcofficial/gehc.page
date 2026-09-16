import React, { useMemo, useState } from 'react';
import { CircleHelp, X, Search, ArrowRight } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { portalGuide, portalNavGroup, portalNavLabel } from '../../lib/portal-i18n';
import { guideIdToPage } from '../../lib/portal-search-index';
import type { PortalNavItemDef } from '../../lib/portal-nav-config';
import type { PortalGuide } from '../../i18n/portal-en';
import { PortalGuidePreview } from './PortalGuidePreview';

export const PortalHelpDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  navItems: PortalNavItemDef[];
  isGroupMentor?: boolean;
  isMentee?: boolean;
  onNavigate: (id: string) => void;
}> = ({ open, onClose, navItems, isGroupMentor, isMentee, onNavigate }) => {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  const navFiltered = useMemo(() => {
    if (!term) return navItems;
    return navItems.filter((item) => {
      const label = portalNavLabel(t, item.id, { isGroupMentor, isMentee }).toLowerCase();
      const guide = portalGuide(t, item.id);
      return label.includes(term) || (guide?.purpose || '').toLowerCase().includes(term);
    });
  }, [navItems, term, t, isGroupMentor, isMentee]);

  const grouped = useMemo(() => {
    const map = new Map<string, PortalNavItemDef[]>();
    for (const item of navFiltered) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [navFiltered]);

  const otherGuides = useMemo(() => {
    const entries = Object.entries(t.portal.guides as Record<string, PortalGuide>);
    return entries
      .filter(([id]) => id.includes('.') || id === 'ibadah-mingguan')
      .filter(([, g]) => !term
        || g.title.toLowerCase().includes(term)
        || g.purpose.toLowerCase().includes(term)
        || g.steps.join(' ').toLowerCase().includes(term))
      .map(([id, guide]) => ({ id, guide, page: guideIdToPage(id)?.page }));
  }, [t, term]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label={t.portal.common.close} onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-[#FAF9F5] border-l border-[#D9D7D0] shadow-2xl overflow-y-auto p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CircleHelp className="w-4 h-4 text-[#FF416C]" />
              <h2 className="text-sm font-black">{t.portal.layout.helpTitle}</h2>
            </div>
            <p className="text-[11px] text-[#8C8880] mt-1">{t.portal.layout.helpHint}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white text-[#8C8880]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#D9D7D0]">
          <Search className="w-4 h-4 text-[#8C8880] shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.portal.search.placeholder}
            className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-[#8C8880]"
            inputMode="search"
          />
        </div>

        {grouped.map(([group, items]) => (
          <section key={group} className="space-y-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF416C]/70">{portalNavGroup(t, group)}</h3>
            {items.map((item) => {
              const guide = portalGuide(t, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className="w-full text-left rounded-2xl border border-[#D9D7D0]/60 bg-white p-3 hover:border-[#1B1B1B]/30"
                >
                  <p className="text-xs font-bold text-[#1B1B1B]">{portalNavLabel(t, item.id, { isGroupMentor, isMentee })}</p>
                  {guide && <p className="text-[11px] text-[#8C8880] mt-1 leading-relaxed">{guide.purpose}</p>}
                </button>
              );
            })}
          </section>
        ))}

        {navFiltered.length === 0 && otherGuides.length === 0 && (
          <p className="text-xs text-[#8C8880]">{t.portal.search.empty}</p>
        )}

        {otherGuides.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF416C]/70">{t.portal.search.groups.page}</h3>
            {otherGuides.map(({ id, guide, page }) => (
              <details key={id} className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-3 group">
                <summary className="cursor-pointer list-none">
                  <span className="text-xs font-bold text-[#1B1B1B]">{guide.title}</span>
                  <span className="block text-[11px] text-[#8C8880] mt-1 leading-relaxed">{guide.purpose}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-[#D9D7D0]/50">
                  <PortalGuidePreview title={guide.title} purpose={guide.purpose} steps={guide.steps} when={guide.when} notFor={guide.notFor} compact />
                  {page && (
                    <button
                      type="button"
                      onClick={() => { onNavigate(page); onClose(); }}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181818] text-white text-[11px] font-bold"
                    >
                      {t.portal.search.open} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </details>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
};
