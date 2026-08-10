// Theme picker: 4 static base themes (next-themes) + 96 dynamic library
// palettes (ui-ux-pro-max). Clicking a library palette injects its tokens onto
// :root at runtime and persists the choice to localStorage.

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { themeLibrary } from "../../utils/themeLibrary";
import {
  applyPaletteTheme,
  clearPaletteTheme,
  getStoredThemeId,
  storeThemeId,
} from "../../utils/themeApply";
import { useI18n } from "../../i18n";

interface StaticTheme {
  id: string;
  labelKey: string;
  accent: string;
  bg: string;
}

const STATIC_THEMES: StaticTheme[] = [
  { id: "dark", labelKey: "theme_dark", accent: "#6d5df6", bg: "#0e0e16" },
  { id: "light", labelKey: "theme_light", accent: "#6d5df6", bg: "#f7f7f9" },
  { id: "cyberpunk", labelKey: "theme_cyberpunk", accent: "#e11d48", bg: "#0a0a14" },
  { id: "chinese", labelKey: "theme_chinese", accent: "#c23a34", bg: "#171412" },
];

export default function ThemesSection() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  // Current selection: either a static next-themes id, or a library palette id.
  const libraryThemeId = getStoredThemeId();
  const isLibraryActive = !!libraryThemeId;

  const filtered =
    query.trim() === ""
      ? themeLibrary
      : themeLibrary.filter((th) =>
          th.name.toLowerCase().includes(query.trim().toLowerCase()),
        );

  const selectStatic = (id: string) => {
    clearPaletteTheme(); // remove any runtime-injected palette
    storeThemeId(null);
    setTheme(id);
  };

  const selectLibrary = (entry: (typeof themeLibrary)[number]) => {
    applyPaletteTheme(entry.palette);
    storeThemeId(entry.id);
  };

  return (
    <div>
      <h3 className="mb-1.5">{t("settings_themes_header")}</h3>
      <p className="mb-3 text-xs text-dim">{t("settings_themes_hint")}</p>

      {/* Static base themes */}
      <div className="mb-4 flex flex-col gap-3">
        {STATIC_THEMES.map((st) => {
          const active = !isLibraryActive && theme === st.id;
          return (
            <div
              key={st.id}
              role="button"
              tabIndex={0}
              onClick={() => selectStatic(st.id)}
              className={`flex cursor-pointer items-center gap-4 rounded-xl p-3.5 text-left transition-colors ${
                active
                  ? "border-2 border-accent bg-input"
                  : "border-2 border-border bg-input"
              }`}
            >
              <div
                className="flex h-[48px] w-20 shrink-0 flex-col overflow-hidden rounded-lg border border-border-strong"
              >
                <div style={{ height: 10, background: st.accent }} />
                <div style={{ flex: 1, background: st.bg }} />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-bold">
                {t(st.labelKey)}
                {active && <Check size={16} className="text-accent" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-input px-2.5">
        <Search size={14} className="text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings_themes_search")}
          className="flex-1 bg-transparent py-2 text-[13px] outline-none"
        />
      </div>

      {/* Library palettes (96) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((entry) => {
          const active = isLibraryActive && libraryThemeId === entry.id;
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              title={entry.name}
              onClick={() => selectLibrary(entry)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${
                active
                  ? "border-accent bg-item-active"
                  : "border-border bg-input hover:border-border-strong"
              }`}
            >
              <div
                className="flex h-7 w-8 shrink-0 flex-col overflow-hidden rounded border border-border-strong"
              >
                <div style={{ flex: 1, background: entry.palette.primary }} />
                <div style={{ flex: 1, background: entry.palette.background }} />
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-primary-text">
                {entry.name}
              </span>
              {active && <Check size={14} className="shrink-0 text-accent" />}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-6 text-center text-xs text-dim">
          {t("settings_themes_noMatch")}
        </div>
      )}
    </div>
  );
}
