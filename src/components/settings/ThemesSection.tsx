// Theme picker with live preview cards. Switching applies instantly.

import { Check } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { THEMES, type ThemeId } from "../../utils/theme";
import { useI18n } from "../../i18n";

export default function ThemesSection() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const { t } = useI18n();
  const current = settings.theme as ThemeId;

  return (
    <div>
      <h3 className="mb-1.5">{t("settings_themes_header")}</h3>
      <p className="mb-[18px] text-xs text-dim">{t("settings_themes_hint")}</p>

      <div className="flex flex-col gap-4">
        {THEMES.map((theme) => {
          const active = current === theme.id;
          const label = t(theme.labelKey);
          const desc = t(theme.descKey);
          return (
            <div
              key={theme.id}
              role="button"
              tabIndex={0}
              onClick={() => save({ theme: theme.id })}
              className={`flex cursor-pointer items-center gap-4 rounded-xl p-3.5 text-left transition-colors ${
                active
                  ? "border-2 border-accent bg-input"
                  : "border-2 border-border bg-input"
              }`}
            >
              {/* mini preview */}
              <div
                className="flex h-[60px] w-24 shrink-0 flex-col overflow-hidden rounded-lg border border-border-strong"
                style={{
                  boxShadow: theme.glow
                    ? "0 0 14px rgba(0,255,255,0.4)"
                    : "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ height: 14, background: theme.previewAccent }} />
                <div style={{ flex: 1, background: theme.previewBg }} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[15px] font-bold">
                  {label}
                  {active && <Check size={16} className="text-accent" />}
                </div>
                <div className="mt-[3px] text-xs text-dim">{desc}</div>
                <div className="mt-2 flex gap-1.5">
                  {theme.swatches.map((c) => (
                    <span
                      key={c}
                      className="inline-block size-3.5 rounded-full"
                      style={{ background: c, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
