import React from 'react';
import { useLang } from '../../context/LangContext';
import { BrandCityReveal } from './BrandCityReveal';

type BrandCaptionProps = {
  className?: string;
  align?: 'left' | 'center';
  theme?: 'dark' | 'light';
};

const lineCls = {
  dark: 'font-bold text-[10px] lg:text-[11px] text-white tracking-tight truncate',
  light: 'font-bold text-[10px] lg:text-[11px] text-[#1B1B1B] tracking-tight truncate',
};

const pillCls = {
  dark: 'inline-flex shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-[#FAF9F5] uppercase tracking-wider',
  light:
    'inline-flex shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF416C]/10 text-[#FF416C] uppercase tracking-wider',
};

export const BrandCaption: React.FC<BrandCaptionProps> = ({
  className = '',
  align = 'left',
  theme = 'dark',
}) => {
  const { t } = useLang();
  const line = lineCls[theme];
  const rowAlign = align === 'center' ? 'justify-center' : '';

  return (
    <div className={`flex flex-col gap-1 min-w-0 ${align === 'center' ? 'items-center text-center' : ''} ${className}`}>
      <span className={line}>{t.brand.church}</span>
      <div className={`flex items-center gap-1.5 min-w-0 ${rowAlign}`}>
        <BrandCityReveal text={t.brand.city} className={line} />
        <span className={pillCls[theme]}>{t.brand.bipra}</span>
      </div>
    </div>
  );
};
