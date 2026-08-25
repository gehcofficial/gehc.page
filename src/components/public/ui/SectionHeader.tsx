import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CONTAINER } from '../../../lib/theme';

/**
 * Header section seragam untuk seluruh halaman publik:
 * eyebrow-chip + judul display + deskripsi, dengan opsi tone gelap/terang,
 * perataan kiri/tengah, dan slot aksi di kanan (untuk layout dua kolom).
 */
interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: 'light' | 'dark';
  align?: 'left' | 'center';
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<Props> = ({
  eyebrow,
  title,
  subtitle,
  tone = 'light',
  align = 'left',
  action,
  className = '',
}) => {
  const reduce = useReducedMotion();
  const dark = tone === 'dark';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      className={`${CONTAINER} flex flex-col ${
        align === 'center' ? 'items-center text-center' : 'md:flex-row md:items-end justify-between'
      } gap-5 ${className}`}
    >
      <div className={align === 'center' ? 'max-w-2xl mx-auto' : 'max-w-2xl'}>
        {eyebrow && (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 shadow-sm border ${
              dark ? 'bg-white/10 border-white/15' : 'bg-white border-[#D9D7D0]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dark ? 'bg-[#FF416C]' : 'bg-gradient-to-r from-[#FF416C] to-[#FF4B2B]'
              }`}
            />
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                dark ? 'text-white/70' : 'text-[#8C8880]'
              }`}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <h2
          className={`text-3xl sm:text-5xl font-black tracking-tight font-display leading-tight ${
            dark ? 'text-white' : 'text-[#1B1B1B]'
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className={`mt-3 leading-relaxed text-sm sm:text-base ${
              dark ? 'text-white/60' : 'text-[#8C8880]'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  );
};

/** Pembungkus reveal ringan untuk kartu/blok — hormati prefers-reduced-motion. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
