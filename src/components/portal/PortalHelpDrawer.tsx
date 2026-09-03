import React, { useMemo } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { portalGuide, portalNavGroup, portalNavLabel } from '../../lib/portal-i18n';
import type { PortalNavItemDef } from '../../lib/portal-nav-config';

export const PortalHelpDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  navItems: PortalNavItemDef[];
  isGroupMentor?: boolean;
  isMentee?: boolean;
  onNavigate: (id: string) => void;
}> = ({ open, onClose, navItems, isGroupMentor, isMentee, onNavigate }) => {
  const { t } = useLang();
  const grouped = useMemo(() => {
    const map = new Map<string, PortalNavItemDef[]>();
    for (const item of navItems) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [navItems]);

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
      </aside>
    </div>
  );
};
