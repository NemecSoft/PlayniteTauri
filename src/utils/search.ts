// Search helpers: builds a searchable "haystack" per game that includes the
// primary name, localized names, alternate names, plus the Pinyin initials of
// Chinese characters so that e.g. "星际争霸" can be found by typing "xjzb".

import { pinyin } from "pinyin-pro";
import type { Game } from "../types/models";

const normalize = (s: string) =>
  s.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

/**
 * Returns the Pinyin initials of a string (letters only, lowercase).
 * "星际争霸" -> "xjzb". Non-Chinese chars are appended as-is (lowercased).
 */
export function pinyinInitials(text: string): string {
  if (!text) return "";
  return pinyin(text, {
    pattern: "first",
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
  })
    .join("")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** All name variants (primary + localized + alternate) for a game. */
export function gameNameVariants(game: Game): string[] {
  const variants: string[] = [game.name];
  if (game.sortName) variants.push(game.sortName);
  for (const n of game.localizedNames || []) variants.push(n.name);
  variants.push(...(game.alternateNames || []));
  // dedupe preserving order
  return Array.from(new Set(variants.filter((v) => v)));
}

/**
 * A single normalized search haystack for a game. Contains:
 *  - every name variant (primary/localized/alternate)
 *  - pinyin initials of every Chinese name variant
 *  - the full pinyin of Chinese name variants (so "xingjizhengba" also works)
 *  - metadata fields (genre, developer, publisher, tags, platform, series)
 */
export function gameSearchHaystack(game: Game): string {
  const parts: string[] = [];
  const variants = gameNameVariants(game);

  for (const v of variants) {
    parts.push(v);
    const initials = pinyinInitials(v);
    if (initials && initials !== normalize(v)) parts.push(initials);
    // full pinyin for CJK names
    const full = pinyin(v, { toneType: "none", type: "array", nonZh: "consecutive" })
      .join("")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (full && full !== normalize(v) && full !== initials) parts.push(full);
  }

  parts.push(...game.genre, ...game.developer, ...game.publisher, ...game.tags);
  parts.push(...game.platform, ...game.series);

  return normalize(parts.join(" "));
}

/** Memoized haystack cache to avoid recomputing pinyin on every keystroke. */
const cache = new Map<string, string>();

export function getSearchHaystack(game: Game): string {
  const cached = cache.get(game.id);
  if (cached) return cached;
  const hay = gameSearchHaystack(game);
  if (cache.size > 2000) cache.clear();
  cache.set(game.id, hay);
  return hay;
}

export function matchSearch(game: Game, query: string): boolean {
  if (!query) return true;
  const q = normalize(query.trim());
  if (!q) return true;
  return getSearchHaystack(game).includes(q);
}
