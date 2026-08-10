// Theme picker: independent 96-color-palette + 67-style selectors.
// A "theme" is the combination of a chosen palette (colors) and a chosen
// style (radius/glow/shadow/font). Both persist to localStorage and are
// injected onto :root at runtime.

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { themeLibrary } from "../../utils/themeLibrary";
import { styleLibrary } from "../../utils/styleLibrary";
import {
  applyPaletteTheme,
  applyStyleVars,
  getStoredStyleId,
  getStoredThemeId,
  storeStyleId,
  storeThemeId,
} from "../../utils/themeApply";
import { useI18n } from "../../i18n";

export default function ThemesSection() {
  const { t } = useI18n();
  const [paletteQuery, setPaletteQuery] = useState("");
  const [styleQuery, setStyleQuery] = useState("");

  const paletteId = getStoredThemeId();
  const styleId = getStoredStyleId();

  const filteredPalettes =
    paletteQuery.trim() === ""
      ? themeLibrary
      : themeLibrary.filter((th) =>
          th.name.toLowerCase().includes(paletteQuery.trim().toLowerCase()),
        );

  const filteredStyles =
    styleQuery.trim() === ""
      ? styleLibrary
      : styleLibrary.filter((s) =>
          s.name.toLowerCase().includes(styleQuery.trim().toLowerCase()),
        );

  const selectPalette = (entry: (typeof themeLibrary)[number]) => {
    applyPaletteTheme(entry.palette);
    storeThemeId(entry.id);
  };

  const selectStyle = (entry: (typeof styleLibrary)[number]) => {
    applyStyleVars(entry.vars);
    storeStyleId(entry.id);
  };

  return (
    <div>
      <h3 className="mb-1.5">{t("settings_themes_header")}</h3>
      <p className="mb-4 text-xs text-dim">{t("settings_themes_hint")}</p>

      {/* ---- Style selector (67) ---- */}
      <div className="mb-1 flex items-center gap-2 rounded-md border border-border bg-input px-2.5">
        <Search size={14} className="text-dim" />
        <input
          value={styleQuery}
          onChange={(e) => setStyleQuery(e.target.value)}
          placeholder={t("settings_styles_search")}
          className="flex-1 bg-transparent py-2 text-[13px] outline-none"
        />
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {filteredStyles.map((st) => {
          const active = styleId === st.id;
          return (
            <button
              key={st.id}
              onClick={() => selectStyle(st)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                active
                  ? "border-accent bg-accent text-primary-foreground"
                  : "border-border bg-input text-primary-text hover:border-border-strong"
              }`}
            >
              {st.name}
              {active && <Check size={12} className="ml-1 inline" />}
            </button>
          );
        })}
      </div>

      {/* ---- Palette selector (96) ---- */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-input px-2.5">
        <Search size={14} className="text-dim" />
        <input
          value={paletteQuery}
          onChange={(e) => setPaletteQuery(e.target.value)}
          placeholder={t("settings_themes_search")}
          className="flex-1 bg-transparent py-2 text-[13px] outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filteredPalettes.map((entry) => {
          const active = paletteId === entry.id;
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              title={entry.name}
              onClick={() => selectPalette(entry)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${
                active
                  ? "border-accent bg-item-active"
                  : "border-border bg-input hover:border-border-strong"
              }`}
            >
              <div className="flex h-7 w-8 shrink-0 flex-col overflow-hidden rounded border border-border-strong">
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

      {filteredPalettes.length === 0 && (
        <div className="py-6 text-center text-xs text-dim">
          {t("settings_themes_noMatch")}
        </div>
      )}
    </div>
  );
}
