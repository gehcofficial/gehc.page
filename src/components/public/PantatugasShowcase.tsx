import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { PANTATUGAS } from '../../lib/pantatugas';
import { unlockOurPeople } from '../../lib/our-people-unlock';
import { SectionHeader, Reveal } from './ui/SectionHeader';

/**
 * Showcase enam pelayanan (5 panca tugas + Benzarpreneurship) — grid 3×2.
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

      <div className="max-w-[1080px] mx-auto px-4 sm:px-8 mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {PANTATUGAS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.name} delay={i * 0.08}>
                <div
                  className="h-full rounded-[28px] p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl bg-white flex items-start gap-4"
                  style={{ borderTop: `4px solid ${p.color}` }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${p.color}1A`, color: p.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-black tracking-wide" style={{ color: p.color }}>
                      {t.serve.items[i]?.label ?? p.label}
                    </h3>
                    <p className="text-[11px] text-[#8C8880] leading-relaxed mt-1">
                      {t.serve.items[i]?.tagline ?? p.tagline}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.15}>
          <div className="flex justify-center mt-8">
            <button
              onClick={() => {
                unlockOurPeople();
                setPublicTab('leaders');
                const start = Date.now();
                const tryScroll = () => {
                  const el = document.getElementById('our-people');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                  }
                  if (Date.now() - start < 2500) requestAnimationFrame(tryScroll);
                };
                requestAnimationFrame(tryScroll);
              }}
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
