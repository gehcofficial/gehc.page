import React from 'react';
import { useLang } from '../../../context/LangContext';

/** Pil EN | ID untuk berganti bahasa halaman publik. */
export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useLang();
  return (
    <div
      className="flex items-center rounded-full bg-white/10 border border-white/15 p-0.5 shrink-0"
      role="group"
      aria-label="Language / Bahasa"
    >
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 h-[26px] rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
            lang === l ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};
