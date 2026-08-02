// Lightweight i18n: React Context + typed dictionaries.
// Supports English, Simplified Chinese and Traditional Chinese.
// Language switching is instant and reactive via context state.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";
import { zhTW } from "./locales/zh-TW";

export type LanguageCode = "en-US" | "zh-CN" | "zh-TW";
export type TranslationKey = keyof typeof en;

type Dict = Record<TranslationKey, string>;

const DICTS: Record<LanguageCode, Dict> = {
  "en-US": en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

export type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en-US",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<LanguageCode>("en-US");

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTS[lang] ?? en;
    const t: TranslateFn = (key, vars) => {
      const template = (dict[key] as string) ?? (en[key] as string) ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        template
      );
    };
    return { lang, setLang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Applies the active language for non-React bits (e.g. `document.documentElement.lang`). */
export function useApplyLang() {
  const { lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return lang;
}
