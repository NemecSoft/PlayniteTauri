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
      <h3 style={{ marginBottom: 6 }}>{t("settings_themes_header")}</h3>
      <p style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 18 }}>
        {t("settings_themes_hint")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {THEMES.map((theme) => {
          const active = current === theme.id;
          const label = t(theme.labelKey);
          const desc = t(theme.descKey);
          return (
            <button
              key={theme.id}
              onClick={() => save({ theme: theme.id })}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                padding: 14,
                borderRadius: 12,
                textAlign: "left",
                background: "var(--bg-input)",
                border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
                cursor: "pointer",
                transition: "border-color 0.15s, transform 0.15s",
              }}
            >
              {/* mini preview */}
              <div
                style={{
                  width: 96,
                  height: 60,
                  borderRadius: 8,
                  flexShrink: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid var(--border-strong)",
                  boxShadow: theme.glow
                    ? "0 0 14px rgba(0,255,255,0.4)"
                    : "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ height: 14, background: theme.previewAccent }} />
                <div style={{ flex: 1, background: theme.previewBg }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {label}
                  {active && <Check size={16} style={{ color: "var(--accent)" }} />}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 3 }}>
                  {desc}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {theme.swatches.map((c) => (
                    <span
                      key={c}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: c,
                        display: "inline-block",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
