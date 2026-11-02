import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { vi } from './locales/vi';
import { en } from './locales/en';

export type Lang = 'vi' | 'en';
export type Dict = Record<keyof typeof vi, string>;
export type TKey = keyof Dict;
export type T = (key: TKey, params?: Record<string, string | number>) => string;

const DICTS: Record<Lang, Dict> = { vi, en };
const STORAGE_KEY = 'ngan.lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

/** Language of the latest render, for plain helpers that cannot call the hook. */
let activeLang: Lang = readLang();

function translate(lang: Lang, key: TKey, params?: Record<string, string | number>): string {
  const raw = DICTS[lang][key] ?? vi[key];
  return params ? raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : raw;
}

export const tr: T = (key, params) => translate(activeLang, key, params);

export const currentLang = (): Lang => activeLang;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const Ctx = createContext<I18n | null>(null);

/** UI language lives in localStorage, not the vault, so the gate can use it before unlock. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICTS[lang]['app.title'];
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode: the choice just lasts for this session */
    }
  }, []);

  activeLang = lang;

  const t = useCallback<T>((key, params) => translate(lang, key, params), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useT must be used inside LangProvider');
  return ctx;
}
