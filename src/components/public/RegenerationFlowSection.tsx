import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Flame, Users, Split, Infinity as InfinityIcon } from 'lucide-react';
import { useLang } from '../../context/LangContext';

/**
 * Alur Regenerasi — diceritakan sebagai kisah (bukan spesifikasi sistem).
 * Copy bilingual dari i18n; landasan naratif: 2 Timotius 2:2.
 */
export const RegenerationFlowSection: React.FC = () => {
  const { t } = useLang();
  const reduce = useReducedMotion();

  const stages = [
    { icon: Flame, color: '#FF4B2B', title: t.flow.s1t, text: t.flow.s1d },
    { icon: Users, color: '#7C3AED', title: t.flow.s2t, text: t.flow.s2d },
    { icon: Split, color: '#0EA5E9', title: t.flow.s3t, text: t.flow.s3d },
    { icon: InfinityIcon, color: '#059669', title: t.flow.s4t, text: t.flow.s4d },
  ];

  return (
    <section className="relative py-20 sm:py-28 bg-[#111111] overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #FF416C 0%, transparent 70%)' }} />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #0EA5E9 0%, transparent 70%)' }} />

      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF416C]">
            {t.flow.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-3 leading-tight">
            {t.flow.title}
          </h2>
        </motion.div>

        <div className="relative mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.title}
                initial={reduce ? false : { opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 hover:bg-white/[0.07] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: `${stage.color}26`, color: stage.color }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[44px] leading-none font-black text-white/10 group-hover:text-white/20 transition-colors">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-base font-black text-white mt-4">{stage.title}</h3>
                <p className="text-xs leading-relaxed mt-2 text-white/60">{stage.text}</p>

                {i < stages.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-[21px] z-10 w-8 h-8 items-center justify-center rounded-full bg-[#111111] border border-white/15 text-white/50">
                    <Split className="w-3.5 h-3.5 rotate-90" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center text-xs text-white/40 mt-12 max-w-xl mx-auto leading-relaxed"
        >
          {t.flow.close}
        </motion.p>
      </div>
    </section>
  );
};
