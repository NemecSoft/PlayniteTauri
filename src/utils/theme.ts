// Theme definitions & application.

export type ThemeId =
  | "Default"
  | "Cartoon"
  | "Cyberpunk"
  | "Memphis"
  | "Neumorphism"
  | "Comic"
  | "Ghibli"
  | "Chinese";

export interface ThemeDefinition {
  id: ThemeId;
  /** i18n key for the theme name (e.g. "settings_themeCartoon"). */
  labelKey: string;
  /** i18n key for the theme description. */
  descKey: string;
  dataAttr: string;
  /** preview swatch colors for the picker card */
  swatches: string[];
  /** accent color used for the preview bar in the picker */
  previewAccent: string;
  /** preview background for the mini swatch */
  previewBg: string;
  /** whether the preview card should glow */
  glow?: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "Cartoon",
    labelKey: "settings_themeCartoon",
    descKey: "settings_themeCartoonDesc",
    dataAttr: "cartoon",
    swatches: ["#4ecdc4", "#ff6b6b", "#ffe66d", "#a29bfe"],
    previewAccent: "linear-gradient(90deg,#6edbcf,#ffb3c1)",
    previewBg: "#fff7ec",
  },
  {
    id: "Cyberpunk",
    labelKey: "settings_themeCyberpunk",
    descKey: "settings_themeCyberpunkDesc",
    dataAttr: "cyberpunk",
    swatches: ["#0ff", "#f0f", "#faff05", "#2d7ff9"],
    previewAccent: "linear-gradient(90deg,#0b1b2b,#1a0b2e)",
    previewBg: "#0a0f1e",
    glow: true,
  },
  {
    id: "Memphis",
    labelKey: "settings_themeMemphis",
    descKey: "settings_themeMemphisDesc",
    dataAttr: "memphis",
    swatches: ["#ff4d6d", "#ffb703", "#06d6a0", "#4361ee"],
    previewAccent: "linear-gradient(90deg,#ff4d6d,#ffb703)",
    previewBg: "#fffaf3",
  },
  {
    id: "Neumorphism",
    labelKey: "settings_themeNeumorphism",
    descKey: "settings_themeNeumorphismDesc",
    dataAttr: "neumorphism",
    swatches: ["#e0e5ec", "#a3b1c6", "#8ab4f8", "#ffffff"],
    previewAccent: "linear-gradient(90deg,#dde3ec,#cdd5e3)",
    previewBg: "#e0e5ec",
  },
  {
    id: "Comic",
    labelKey: "settings_themeComic",
    descKey: "settings_themeComicDesc",
    dataAttr: "comic",
    swatches: ["#ffd700", "#e63946", "#2b2d42", "#ffffff"],
    previewAccent: "linear-gradient(90deg,#ffd700,#e63946)",
    previewBg: "#fffdf0",
  },
  {
    id: "Ghibli",
    labelKey: "settings_themeGhibli",
    descKey: "settings_themeGhibliDesc",
    dataAttr: "ghibli",
    swatches: ["#9fce7f", "#e8c07d", "#7fb6d9", "#f2e6c9"],
    previewAccent: "linear-gradient(90deg,#a8d08d,#f3dba6)",
    previewBg: "#f6f3e7",
  },
  {
    id: "Chinese",
    labelKey: "settings_themeChinese",
    descKey: "settings_themeChineseDesc",
    dataAttr: "chinese",
    swatches: ["#9e1b32", "#c8a24b", "#f0e6d2", "#3a2f28"],
    previewAccent: "linear-gradient(90deg,#9e1b32,#c8a24b)",
    previewBg: "#f7efe0",
  },
];

/** Maps a settings.theme value to a document data-theme attribute. */
export function themeToAttr(theme: string): string {
  const t = THEMES.find((x) => x.id === theme);
  return t ? t.dataAttr : "default";
}

/** Applies the theme by setting the data-theme attribute on <html>. */
export function applyTheme(theme: string): void {
  const attr = themeToAttr(theme);
  document.documentElement.setAttribute("data-theme", attr);
}
