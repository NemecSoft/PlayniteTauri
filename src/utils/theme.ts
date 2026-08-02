// Theme definitions & application.

export type ThemeId = "Default" | "Cartoon" | "Cyberpunk";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  dataAttr: string;
  // preview swatch colors for the picker card
  swatches: string[];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "Cartoon",
    label: "卡通风格",
    description: "明亮、多彩、圆润，活泼的卡通质感",
    dataAttr: "cartoon",
    swatches: ["#4ecdc4", "#ff6b6b", "#ffe66d", "#a29bfe"],
  },
  {
    id: "Cyberpunk",
    label: "赛博朋克风格",
    description: "暗色霓虹、发光边缘，未来科技感",
    dataAttr: "cyberpunk",
    swatches: ["#0ff", "#f0f", "#faff05", "#2d7ff9"],
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
