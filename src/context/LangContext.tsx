import React, { createContext, useContext, useEffect, useState } from 'react';
import { Lang, dictionaries, Dict } from '../i18n';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Kamus bahasa aktif — akses langsung: t.hero.title */
  t: Dict;
}

const Ctx = createContext<LangCtx | undefined>(undefined);
const KEY = 'gehc_lang_v1';

function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'id';
  const saved = localStorage.getItem(KEY);
  return saved === 'en' || saved === 'id' ? saved : 'id';
}

function applyHtmlLang(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
}

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = readStoredLang();
    applyHtmlLang(initial);
    return initial;
  });

  useEffect(() => {
    localStorage.setItem(KEY, lang);
    applyHtmlLang(lang);
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);

  return <Ctx.Provider value={{ lang, setLang, t: dictionaries[lang] }}>{children}</Ctx.Provider>;
};

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLang must be used within LangProvider');
  return c;
}
