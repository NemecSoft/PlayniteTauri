// Runtime theme application for the 96-palette theme library.
//
// Static shadcn themes (dark/light/cyberpunk/chinese) live in tokens.css and
// are switched via next-themes' `data-theme` attribute. The dynamic library
// themes (themeLibrary.ts) instead inject their tokens onto :root at runtime,
// overriding the CSS variables so every component — migrated (shadcn tokens)
// or not (legacy --bg-base/--text-primary) — follows the chosen palette.

import type { ThemePaletteTokens } from "./themeLibrary";

const STORAGE_KEY = "app-theme";

/** Map a ThemePaletteTokens key to the CSS variable name it sets. */
const KEY_TO_VAR: Record<keyof ThemePaletteTokens, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  border: "--border",
  ring: "--ring",
  // legacy business variables
  bgBase: "--bg-base",
  bgTop: "--bg-top",
  bgSidebar: "--bg-sidebar",
  bgPanel: "--bg-panel",
  bgItemHover: "--bg-item-hover",
  bgItemActive: "--bg-item-active",
  bgInput: "--bg-input",
  borderStrong: "--border-strong",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textDim: "--text-dim",
  accent: "--accent",
  accentHover: "--accent-hover",
  accentSoft: "--accent-soft",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
};

/** Apply a palette's tokens onto :root (documentElement inline style). */
export function applyPaletteTheme(palette: ThemePaletteTokens): void {
  const root = document.documentElement;
  (Object.keys(palette) as (keyof ThemePaletteTokens)[]).forEach((k) => {
    root.style.setProperty(KEY_TO_VAR[k], palette[k]);
  });
}

/** Clear any runtime-injected palette (fall back to static data-theme). */
export function clearPaletteTheme(): void {
  const root = document.documentElement;
  (Object.values(KEY_TO_VAR)).forEach((v) => {
    root.style.removeProperty(v);
  });
}

export function getStoredThemeId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function storeThemeId(id: string | null): void {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}

/** Restore the previously chosen library theme on startup. */
export function restoreLibraryTheme(library: {
  id: string;
  palette: ThemePaletteTokens;
}[]): void {
  const id = getStoredThemeId();
  if (!id) return;
  const entry = library.find((t) => t.id === id);
  if (entry) applyPaletteTheme(entry.palette);
}
