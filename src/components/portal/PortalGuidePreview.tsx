import React from 'react';
import { CircleHelp, ListOrdered, CheckCircle2, Ban } from 'lucide-react';
import { useLang } from '../../context/LangContext';

type Props = {
  title: string;
  purpose?: string;
  steps?: string[];
  when?: string;
  notFor?: string;
  compact?: boolean;
};

/** Pratinjau panduan: tujuan + langkah + kapan dipakai / bukan untuk. */
export const PortalGuidePreview: React.FC<Props> = ({ title, purpose, steps, when, notFor, compact = false }) => {
  const { t } = useLang();
  return (
    <div className={`space-y-3 ${compact ? '' : 'p-1'}`}>
      <div className="flex items-center gap-2">
        <CircleHelp className="w-4 h-4 text-[#FF416C] shrink-0" />
        <h3 className="text-sm font-black text-[#1B1B1B]">{title}</h3>
      </div>
      {purpose && <p className="text-xs text-[#5C5850] leading-relaxed">{purpose}</p>}
      {steps && steps.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880] flex items-center gap-1.5">
            <ListOrdered className="w-3 h-3" /> {t.portal.search.stepsHeading}
          </p>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-[#1B1B1B]">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] flex items-center justify-center shrink-0 text-[10px] font-bold text-[#8C8880]">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {when && (
        <p className="text-[11px] text-[#5C5850] leading-relaxed flex gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <span><span className="font-bold">{t.portal.search.whenHeading} — </span>{when}</span>
        </p>
      )}
      {notFor && (
        <p className="text-[11px] text-[#8C8880] leading-relaxed flex gap-1.5">
          <Ban className="w-3.5 h-3.5 text-[#8C8880] shrink-0 mt-0.5" />
          <span><span className="font-bold">{t.portal.search.notForHeading} — </span>{notFor}</span>
        </p>
      )}
    </div>
  );
};
