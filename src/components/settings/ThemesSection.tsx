// Theme picker: a single flat list of styles and a single flat list of
// palettes. Clicking either injects its variables onto :root at runtime and
// persists to localStorage. No search, no category collapsing — just pick.

import { Check } from "lucide-react";
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
  const paletteId = getStoredThemeId();
  const styleId = getStoredStyleId();

  return (
    <div>
      <h3 className="mb-1.5">{t("settings_themes_header")}</h3>
      <p className="mb-3 text-xs text-dim">{t("settings_themes_hint")}</p>

      {/* ---- Styles (flat list) ---- */}
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold text-secondary-text">
          {t("settings_styles_label")}（{styleLibrary.length}）
        </div>
        <div className="flex flex-wrap gap-2">
          {styleLibrary.map((s) => {
            const active = styleId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  applyStyleVars(s.vars);
                  storeStyleId(s.id);
                }}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  active
                    ? "border-accent bg-accent text-primary-foreground"
                    : "border-border bg-input text-primary-text hover:border-border-strong"
                }`}
              >
                {s.zh}
                {active && <Check size={12} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Palettes (flat list, one row per palette) ---- */}
      <div>
        <div className="mb-2 text-xs font-semibold text-secondary-text">
          {t("settings_palettes_label")}（{themeLibrary.length}）
        </div>
        <div className="flex flex-col gap-2">
          {themeLibrary.map((p) => {
            const active = paletteId === p.id;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                title={p.name}
                onClick={() => {
                  applyPaletteTheme(p.palette);
                  storeThemeId(p.id);
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  active
                    ? "border-accent bg-item-active"
                    : "border-border bg-input hover:border-border-strong"
                }`}
              >
                <div className="flex h-6 w-14 shrink-0 overflow-hidden rounded border border-border-strong">
                  <div style={{ flex: 1, background: p.palette.primary }} />
                  <div style={{ flex: 1, background: p.palette.background }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-primary-text">
                    {p.zh}
                  </div>
                  <div className="truncate text-[10px] text-dim">{p.name}</div>
                </div>
                {active && <Check size={14} className="shrink-0 text-accent" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}