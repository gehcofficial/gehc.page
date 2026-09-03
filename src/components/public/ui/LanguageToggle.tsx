import React from 'react';
import { useLang } from '../../../context/LangContext';

/** Pil EN | ID — dark untuk Navbar publik, light untuk chrome portal. */
export const LanguageToggle: React.FC<{ variant?: 'dark' | 'light' }> = ({ variant = 'dark' }) => {
  const { lang, setLang } = useLang();
  const dark = variant === 'dark';
  return (
    <div
      className={`flex items-center rounded-full p-0.5 shrink-0 ${
        dark ? 'bg-white/10 border border-white/15' : 'bg-white border border-[#D9D7D0]'
      }`}
      role="group"
      aria-label="Language / Bahasa"
    >
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 h-[26px] rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
            lang === l
              ? dark
                ? 'bg-white text-black shadow-sm'
                : 'bg-[#181818] text-white shadow-sm'
              : dark
                ? 'text-white/60 hover:text-white'
                : 'text-[#8C8880] hover:text-[#1B1B1B]'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};
