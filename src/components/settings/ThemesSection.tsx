// Theme picker backed by next-themes. Switching applies the `data-theme`
// attribute instantly; the choice persists to localStorage.

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useI18n } from "../../i18n";

interface NewThemeMeta {
  id: string;
  labelKey: string;
  descKey: string;
  accent: string;
  bg: string;
  swatches: string[];
  glow?: boolean;
}

const NEW_THEMES: NewThemeMeta[] = [
  {
    id: "dark",
    labelKey: "theme_dark",
    descKey: "theme_dark_desc",
    accent: "#7c6cf0",
    bg: "#12141b",
    swatches: ["#7c6cf0", "#12141b", "#161a23"],
  },
  {
    id: "light",
    labelKey: "theme_light",
    descKey: "theme_light_desc",
    accent: "#7c6cf0",
    bg: "#f2f4f9",
    swatches: ["#7c6cf0", "#f2f4f9", "#ffffff"],
  },
  {
    id: "cyberpunk",
    labelKey: "theme_cyberpunk",
    descKey: "theme_cyberpunk_desc",
    accent: "#ff2ec4",
    bg: "#0a0a1a",
    swatches: ["#ff2ec4", "#22e0e8", "#0a0a1a"],
    glow: true,
  },
  {
    id: "chinese",
    labelKey: "theme_chinese",
    descKey: "theme_chinese_desc",
    accent: "#d6443b",
    bg: "#1e1714",
    swatches: ["#d6443b", "#1e1714", "#2b221d"],
  },
];

export default function ThemesSection() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <div>
      <h3 className="mb-1.5">{t("settings_themes_header")}</h3>
      <p className="mb-[18px] text-xs text-dim">{t("settings_themes_hint")}</p>

      <div className="flex flex-col gap-4">
        {NEW_THEMES.map((th) => {
          const active = theme === th.id;
          return (
            <div
              key={th.id}
              role="button"
              tabIndex={0}
              onClick={() => setTheme(th.id)}
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
                  boxShadow: th.glow
                    ? "0 0 14px rgba(0,255,255,0.4)"
                    : "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ height: 14, background: th.accent }} />
                <div style={{ flex: 1, background: th.bg }} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[15px] font-bold">
                  {t(th.labelKey)}
                  {active && <Check size={16} className="text-accent" />}
                </div>
                <div className="mt-[3px] text-xs text-dim">{t(th.descKey)}</div>
                <div className="mt-2 flex gap-1.5">
                  {th.swatches.map((c) => (
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
