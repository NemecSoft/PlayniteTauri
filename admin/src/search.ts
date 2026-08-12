// 管理端搜索：和客户端一致，支持拼音首字母（如"xjzb"匹配"星际争霸"）。
// 与 src/utils/search.ts 逻辑相同——这里复制一份，避免跨 tsconfig include 边界
// import（admin 和 client 是独立构建）。

import { pinyin } from "pinyin-pro";
import type { Game } from "./lib";

const normalize = (s: string) =>
  s.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

/** 中文转拼音首字母（如"星际争霸" -> "xjzb"）。 */
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

/** 主名 + 本地化名 + 别名收集 + 去重。 */
export function gameNameVariants(game: Game): string[] {
  const variants: string[] = [game.name];
  if (game.sortName) variants.push(game.sortName);
  for (const n of game.localizedNames || []) variants.push(n.name);
  variants.push(...(game.alternateNames || []));
  return Array.from(new Set(variants.filter((v) => v)));
}

/** 取显示名（中文优先，回退英文）。 */
export function displayName(game: Game): string {
  const ln = game.localizedNames?.find((n) => n.language === "zh-CN" && n.name?.trim());
  if (ln) return ln.name;
  const tw = game.localizedNames?.find((n) => n.language === "zh-TW" && n.name?.trim());
  if (tw) return tw.name;
  return game.name;
}

/** 匹配搜索词：子串匹配显示名，或拼音首字母匹配。空查询返回 true。 */
export function matchSearch(game: Game, query: string): boolean {
  if (!query) return true;
  const q = normalize(query.trim());
  if (!q) return true;
  const shown = displayName(game);
  const shownNorm = normalize(shown);
  const initials = pinyinInitials(shown);
  return shownNorm.includes(q) || (!!initials && initials.includes(q));
}