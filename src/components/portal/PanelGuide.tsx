import React, { useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { portalGuide } from '../../lib/portal-i18n';

const storageKey = (id: string) => `gehc_guide_${id}`;

export const PanelGuide: React.FC<{ guideId: string }> = ({ guideId }) => {
  const { t } = useLang();
  const guide = portalGuide(t, guideId);
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(storageKey(guideId)) !== '1';
  });

  if (!guide) return null;

  const dismiss = () => {
    setOpen(false);
    localStorage.setItem(storageKey(guideId), '1');
  };
  const reopen = () => {
    setOpen(true);
    localStorage.removeItem(storageKey(guideId));
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={reopen}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
      >
        <CircleHelp className="w-3.5 h-3.5" />
        {t.portal.common.showGuide}
      </button>
    );
  }

  return (
    <div className="rounded-[24px] border border-[#D9D7D0]/70 bg-[#FAF9F5] p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CircleHelp className="w-4 h-4 text-[#FF416C] shrink-0" />
          <h3 className="text-sm font-black text-[#1B1B1B]">{guide.title}</h3>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded-lg text-[#8C8880] hover:bg-white hover:text-[#1B1B1B]"
          title={t.portal.common.hideGuide}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-[#1B1B1B] leading-relaxed">{guide.purpose}</p>
      <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#5C5850] leading-relaxed">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-[11px] text-[#5C5850] leading-relaxed">
        <span className="font-bold text-[#1B1B1B]">{t.portal.common.useIf} — </span>
        {guide.when}
      </p>
      <p className="text-[11px] text-[#8C8880] leading-relaxed">
        <span className="font-bold">{t.portal.common.notFor} — </span>
        {guide.notFor}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="text-[10px] font-black uppercase tracking-wider text-[#FF416C]"
      >
        {t.portal.common.understand}
      </button>
    </div>
  );
};
