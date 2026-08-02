// Display-name helper.
// The app displays games by their Chinese localized name by default.
// Fallback order: zh-CN -> zh-TW -> original English `name`.
// Search matches ONLY this displayed name (not every stored alias).

import type { Game } from "../types/models";

/** Preferred language order for the displayed name. */
const DISPLAY_LANG_ORDER = ["zh-CN", "zh-TW"];

/**
 * Returns the name to display for a game: the first available localized name
 * in the preferred order (zh-CN, then zh-TW), falling back to the English
 * `name` if no Chinese localized name exists.
 */
export function displayName(game: Game): string {
  const localized = game.localizedNames || [];
  for (const lang of DISPLAY_LANG_ORDER) {
    const hit = localized.find((ln) => ln.language === lang);
    if (hit && hit.name.trim()) return hit.name.trim();
  }
  // Fallback to the primary (usually English) name.
  return game.name;
}
