---
name: palette-tuning
description: 调节 PlayniteTauri 的主题/配色：添加新 palette、调整色值、添加渐变背景、命名/重命名、改 icon 映射、检查对比度。涉及 src/utils/themeLibrary.ts、src/utils/themeApply.ts、src/styles/global.css、src/components/settings/ThemesSection.tsx。Use when the user mentions adding a theme/palette, adjusting colors, changing a palette's name or icon, or any theme/palette tuning.
---

# Palette Tuning（调节 PlayniteTauri 配色）

PlayniteTauri 的"主题系统"分两层，**正交独立**：

- **Style（风格）**：质感语言——圆角/阴影/玻璃/像素/赛博… 在 `src/utils/styleLibrary.ts`。
- **Palette（配色）**：色相——背景/主色/文字/边框… 在 `src/utils/themeLibrary.ts`。

每次修改必须保持两个层**各自独立、可组合**（风格 × 配色 自由配对），不要把风格特性写进 palette。

## 调色时的核心文件

| 文件 | 作用 | 何时改 |
|---|---|---|
| `src/utils/themeLibrary.ts` | 所有 palette 的色值定义（id、name、zh、category、palette 字段） | 新增/删除/改色/重命名 |
| `src/utils/themeApply.ts` | 把 palette 写入 CSS 变量（`applyPaletteTheme`） + 启动时恢复（`restoreLibraryTheme`） | 加**专属背景 class**（如 `theme-diamond`）时同步两边 |
| `src/styles/global.css` | `:root` 的 CSS 变量声明 + `body` 默认背景（顶底渐变）+ **专属 body 背景覆盖** | 加**专属背景 class** 的 CSS（`body.theme-X { ... }`） |
| `src/components/settings/ThemesSection.tsx` | 主题页 UI：`paletteIconMap`（按 `palette.id` 索引图标）+ 选中切换状态（`useState`！） | 新增 palette 必须**同步加 icon 映射**（否则图标 fallback 到 Palette） |
| `docs/design/theme-system.md` | 配色设计决策、调色表、候选方案对比 | 新增 palette 后追加章节（按"决策→对比→色值表→设计原则"四段写） |
| `docs/CHANGELOG.md` | 变更记录 | 配色变更后追加 |

## 添加新 palette 的标准流程

1. **取色**（凭视觉或 ui-ux-pro-max skill `search.py` 搜索行业/风格关键词 → `extract_color_tokens`）
2. **在 `themeLibrary.ts` 末尾追加**一个新对象：
   ```ts
   {
     id: "p-<英文短串>",         // 全小写带连字符；如果是"特别版/复刻某风格"，加分类前缀如 "p-diamond"
     name: "English Name",       // 英文标签（设置页色卡副标题）
     zh: "中文名",               // 中文标签（设置页主标题）
     category: "中国风" | "特别版" | ... , // 分类标签
     palette: { /* 见下"必填字段" */ }
   }
   ```
3. **必填的 palette 字段**（缺少会导致主题/文字/边框失色）：
   - `background` `foreground` `card` `cardForeground`
   - `primary` `primaryForeground` `secondary` `secondaryForeground`
   - `muted` `mutedForeground` `border` `ring`
   - `bgBase` `bgTop` `bgSidebar` `bgPanel` `bgItemHover` `bgItemActive` `bgInput`
   - `borderStrong` `textPrimary` `textSecondary` `textDim`
   - `accent` `accentHover` `accentSoft` `success` `warning` `danger`
4. **`ThemesSection.tsx` 加 icon 映射**：
   ```ts
   import { ..., Map } from "lucide-react";
   const paletteIconMap = { ..., "p-<你的id>": Map };
   ```
   ⚠️ **Key bug 历史教训**：map key 必须是 palette 的真实 `id`（`"p-cn-red"`），不能用 `"chinese-red"` 这种短串——之前因为 key 错配，所有 palette 一直走 `Palette` 兜底。
5. **如果需要专属背景**（如钻石版的彩色斜向渐变），在 `themeApply.ts` 和 `ThemesSection.tsx` 的 `onClick` 里同步切换 `document.body.classList`，并在 `global.css` 写 `body.<className> { background: ...; }` + `body.<className> .main-area { background: transparent; }`。
6. **持久化**：默认主题 id 通过 `getStoredThemeId()` → `localStorage` → `restoreLibraryTheme` 启动时恢复；专属背景 class 也要在 `restoreLibraryTheme` 里同步 toggle。
7. **文档**：`docs/design/theme-system.md` 追加一段（决策→候选对比→色值表→设计原则），`docs/CHANGELOG.md` 追加一行。

## 命名/重命名 palette

- 改 `zh`（中文显示名）和 `name`（英文 tag）即可，**不要改 `id`**（改 id 会导致 `getStoredThemeId()` 找不到之前存的 localStorage 配置，已选用户会"丢设置"）。
- 重命名后文档同步更新。

## 调色前的检查清单

- [ ] **对比度**：主文字 vs 背景 ≥ 4.5:1（WCAG AA）；次要文字 ≥ 3:1。可以用 [webaim contrast checker](https://webaim.org/resources/contrastchecker/) 或 `color-mix(in srgb, ...)`.
- [ ] **背景层次在主色家族内做**：用主色 ±5-8% 亮度差做顶栏/侧栏/面板，不要引入其他色相干扰。
- [ ] **稀缺感 = 高级感**：金色/亮色等强调色只用于文字/边框/描边/焦点环，不铺满按钮底。
- [ ] **状态色**：success 用偏青绿（不要纯绿，跟主色协调）；warning 用偏金黄；danger 用偏红（在主色家族内的红），不能和主色冲突。
- [ ] **亮/暗主题都要兼顾**：palette 改完要看一遍"明亮"和"暗黑"两个 palette 是否还正常（它们是 reference）。

## 调色后必跑

```powershell
# 前端类型检查 + build
npm run build

# 客户端实际渲染验证（启动后切到新 palette 看效果）
```

## 反模式（不要做）

- ❌ 在 `paletteIconMap` 用 `"chinese-red"` 短 id 替代真实 id `"p-cn-red"`
- ❌ 把"风格"特性（如圆角、阴影）写进 palette（应该放 styleLibrary）
- ❌ 改 palette 的 `id`（会让已选用户的 localStorage 失效）
- ❌ 漏填 `mutedForeground` `textDim` 等次要字段（会 fallback 到其他色，导致整片色失协调）
- ❌ 改完 palette 不更新 `docs/design/theme-system.md`（文档与代码漂移）

## 调试技巧

- **看不到效果**：浏览器开发者工具的 "Application → Local Storage" 看 `themeId` 是否持久化；`document.body.classList` 看 `theme-diamond` 这类专属 class 是否切换。
- **对比度差**：用 webaim contrast checker 输入前景+背景 hex 验证。
- **渐变背景没生效**：检查 `global.css` 的 `body.theme-X` 是否在 `body` 块的**之后**定义（CSS 后定义覆盖前定义）。
- **TypeScript 编译报 palette 字段缺失**：用 editor 复制 `p-light` 对象作为新 palette 的模板，删改字段不会漏。
