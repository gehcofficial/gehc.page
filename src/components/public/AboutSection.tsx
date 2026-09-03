import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Landmark, GraduationCap, Home } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { trLabel } from '../../i18n';

interface LeaderDto {
  id: string;
  name: string;
  position?: string | null;
  division?: string | null;
}

const initialsAvatar = (n: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(n || '?')}&backgroundColor=1b1b1b`;

const FACT_ICONS = [Landmark, GraduationCap, Home];

/**
 * ABOUT — "Tentang Pemuda GEHC" untuk audiens global.
 * Menyatukan perkenalan komunitas, fakta editorial, panel kepemimpinan
 * (announcing soon), dan ayat penutup (eks-Manifesto).
 */
export const AboutSection: React.FC = () => {
  const { t } = useLang();
  const [leaders, setLeaders] = useState<LeaderDto[] | null>(null);
  const facts = [t.about.fact1t, t.about.fact2t, t.about.fact3t];
  const factDescs = [t.about.fact1d, t.about.fact2d, t.about.fact3d];

  // Tim Kerja (BOD retreat) dari TiDB — max 3 untuk preview About
  useEffect(() => {
    let cancelled = false;
    fetch('/api/db/struktur')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { members: LeaderDto[] }) => {
        if (!cancelled)
          setLeaders(
            (d.members || [])
              .filter((m) => m.division === 'TIMKERJA')
              .slice(0, 3)
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="about" className="py-16 sm:py-24 px-4 sm:px-8 max-w-[1200px] mx-auto">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        {/* Kiri: cerita */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D9D7D0] mb-4 shadow-sm">
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              {t.about.eyebrow}
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1B1B1B] font-display leading-tight">
            {t.about.title}
          </h2>
          <p className="text-sm sm:text-base text-[#8C8880] mt-5 leading-relaxed">{t.about.intro1}</p>
          <p className="text-sm sm:text-base text-[#1B1B1B]/80 mt-3 leading-relaxed font-medium">
            {t.about.intro2}
          </p>

          {/* Ayat penutup (eks-Manifesto) */}
          <motion.blockquote
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mt-8 pl-5 border-l-4 border-[#FF416C]"
          >
            <p className="text-base sm:text-lg italic text-[#1B1B1B] leading-relaxed">{t.about.verse}</p>
            <p className="mt-2 text-xs font-bold text-[#FF416C] tracking-wide uppercase">{t.about.verseRef}</p>
          </motion.blockquote>
        </div>

        {/* Kanan: fakta + leadership */}
        <div className="space-y-5">
          <div className="space-y-3">
            {facts.map((f, i) => {
              const Icon = FACT_ICONS[i];
              return (
                <motion.div
                  key={f}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-start gap-4 p-5 rounded-[24px] bg-white border border-[#D9D7D0]/50 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF416C]/15 to-[#FF4B2B]/15 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#FF416C]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#1B1B1B]">{f}</p>
                    <p className="text-xs text-[#8C8880] mt-1 leading-relaxed">{factDescs[i]}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Leadership — nama asli bila sudah ter-seed, announcing bila belum */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-[28px] bg-gradient-to-br from-[#181818] to-[#262626] p-6"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-[#FF416C] mb-3">
              {t.leadersPage.coreLabel} · {t.leadersPage.supportLabel}
            </p>

            {leaders && leaders.length > 0 ? (
              <div className="space-y-2.5">
                {leaders.map((l) => (
                  <div key={l.id} className="flex items-center gap-3">
                    <img
                      src={initialsAvatar(l.name)}
                      alt={l.name}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-9 rounded-full object-cover border border-white/20"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{l.name}</p>
                      {l.position && (
                        <p className="text-[10px] text-white/50 truncate">
                          {trLabel(t.orgTree.labels, l.position)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black text-white">{t.about.leadTitle}</h3>
                <p className="text-xs text-white/60 mt-2 leading-relaxed">{t.about.leadSoon}</p>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
