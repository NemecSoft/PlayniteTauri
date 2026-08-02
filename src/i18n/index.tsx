// i18n facade. The underlying engine is i18next (see ./config.ts), aligned
// with the tauri-template stack. We expose a `useI18n()` hook compatible with
// the previous custom implementation so components can switch with minimal
// churn. We intentionally read from the i18next instance directly (instead of
// react-i18next's hook) to avoid any hook/Suspense pitfalls under React 19.

import { useSyncExternalStore } from "react";
import { i18n, type LanguageCode } from "./config";

export type { LanguageCode };

/** Subscribe to i18next language/version changes so components re-render. */
function subscribe(cb: () => void): () => void {
  i18n.on("languageChanged", cb);
  return () => {
    i18n.off("languageChanged", cb);
  };
}

/** Returns the current language + setter and the translation function `t`. */
export function useI18n() {
  const lang = useSyncExternalStore(
    subscribe,
    () => i18n.language as LanguageCode,
    () => i18n.language as LanguageCode
  );

  return {
    lang,
    setLang: (l: LanguageCode) => {
      if (l !== i18n.language) i18n.changeLanguage(l);
    },
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? i18n.t(key, vars) : i18n.t(key),
  };
}

/** Alias for direct i18next t() when not in a component. */
export function t(key: string, vars?: Record<string, string | number>) {
  return vars ? i18n.t(key, vars) : i18n.t(key);
}

/** Applies the active language to `document.documentElement.lang` (handled by i18next config). */
export function useApplyLang(): LanguageCode {
  return useI18n().lang;
}
