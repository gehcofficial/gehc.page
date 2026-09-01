import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { PANTATUGAS } from '../../lib/pantatugas';
import { SectionHeader, Reveal } from './ui/SectionHeader';

/**
 * Showcase lima fungsi (pantatugas) — versi publik naratif.
 * Tanpa org-chart & catatan arsitektur; struktur detail ada di tab Pengurus.
 */
export const PantatugasShowcase: React.FC = () => {
  const { setPublicTab } = useApp();
  const { t } = useLang();

  return (
    <section className="py-14 sm:py-20 bg-[#F3F1EC] border-y border-[#D9D7D0]/50">
      <SectionHeader
        eyebrow={t.serve.eyebrow}
        title={t.serve.title}
        subtitle={t.serve.sub}
        align="center"
      />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PANTATUGAS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.name} delay={i * 0.08}>
                <div
                  className="h-full rounded-[28px] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl bg-white"
                  style={{ borderTop: `4px solid ${p.color}` }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mb-3"
                    style={{ backgroundColor: `${p.color}1A`, color: p.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black tracking-wide" style={{ color: p.color }}>
                    {t.serve.items[i]?.label ?? p.label}
                  </h3>
                  <p className="text-[11px] text-[#8C8880] leading-relaxed mt-1">
                    {t.serve.items[i]?.tagline ?? p.tagline}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.15}>
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setPublicTab('leaders')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#181818] text-white text-xs font-bold shadow-lg hover:bg-black transition-colors"
            >
              {t.serve.cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
