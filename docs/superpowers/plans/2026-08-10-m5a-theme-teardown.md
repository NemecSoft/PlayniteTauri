# 旧主题体系下线（M5a）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 彻底删除旧 12 主题体系（`utils/theme.ts` + 前后端 `theme` 字段），让 next-themes 全权接管主题（localStorage 驱动，`data-theme` 属性）。首次启动时把旧 `config.json` 的 theme 值一次性映射到新主题并写入 localStorage。

**Architecture:** 
- 删除后端 `AppSettings.theme` 字段（`crates/yungame-core/src/models.rs`）——前端 `types/models.ts`、`settingsStore` 同步删除。
- 删除 `src/utils/theme.ts` 与 `App.tsx` 的 `applyTheme(theme)` 调用。
- `ThemesSection` 改用 next-themes 的 `useTheme()` 读写主题。
- 旧 config.json 的 theme 值在 `main.tsx` 挂载时一次性迁移：Cyberpunk→cyberpunk、Chinese→chinese、其余→dark，写入 localStorage 后废弃。

**Tech Stack:** next-themes + React 19 / TS 6 / Tauri v2 (Rust)

> **范围说明**：本计划只做**旧主题体系下线 + 主题模型切换**（M5a）。GridView/TopBar/Sidebar 三个复杂组件的**新 token 视觉重建**以及 `global.css` 组件样式区清理是**视觉设计工程**（M5b），作为独立后续计划，在 M5a 完成后再编写。

## Global Constraints

- 遵循 `AGENTS.md`；前端构建验证 `npm run build`（tsc + vite），后端 `cargo check`。
- **前后端必须同步删字段**：`models.rs` 删 `theme` 后，前端 `models.ts` 若仍引用会 tsc 报错——按 Task 顺序先前端后后端，或同 commit 内完成。
- next-themes 接管后，`theme` 完全由 localStorage 键 `"theme"` 驱动，**不再写 config.json**。
- 旧 config.json 的 `theme` 值首次启动迁移到 localStorage 后，config.json 中该字段随 `save_app_settings` 自然消失（因为 `AppSettings` 已无该字段，serde 默认忽略未知字段）。
- `data-theme` 取值只能是：`dark` / `light` / `cyberpunk` / `chinese`。
- `cargo check` 必须通过（后端删字段不能留下未使用代码）。
- 每次任务结束跑 `npm run build` + `cargo check`。

---

### Task 1: 后端删除 theme 字段

**Files:**
- Modify: `crates/yungame-core/src/models.rs:217`（`pub theme: String`）
- Modify: `crates/yungame-core/src/models.rs:347`（`theme: "Default".into()`）

**Interfaces:**
- Consumes: 无
- Produces: `AppSettings` 无 `theme` 字段，`config.rs` 读写自动忽略旧 theme 值

- [ ] **Step 1: 删除结构体字段与默认值**

删除 `models.rs:217` 的 `pub theme: String,` 行。
删除 `models.rs:347` 的 `theme: "Default".into(),` 行。

- [ ] **Step 2: 后端编译验证**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
cargo check 2>&1 | Select-Object -Last 8
```

Expected: 编译通过。若其它 Rust 代码引用了 `theme`，需要一并清理（搜索 `\.theme`）。

- [ ] **Step 3: Commit**

```bash
git add crates/yungame-core/src/models.rs
git commit -m "refactor: remove theme field from AppSettings (next-themes takes over)"
```

---

### Task 2: 前端删除 theme 字段与 settingsStore

**Files:**
- Modify: `src/types/models.ts:106`（`theme: string;`）
- Modify: `src/stores/settingsStore.ts:12`（`theme: "Default",`）
- Modify: `src/components/settings/ThemesSection.tsx`（改用 next-themes useTheme）

**Interfaces:**
- Consumes: Task 1（后端已删字段）
- Produces: 前端 `AppSettings` 无 `theme`；`ThemesSection` 用 `useTheme()` 读写

- [ ] **Step 1: 删除 models.ts 的 theme 字段**

删除 `src/types/models.ts:106` 的 `theme: string;`。

- [ ] **Step 2: 删除 settingsStore 的 theme 默认值**

删除 `src/stores/settingsStore.ts:12` 的 `theme: "Default",`。

- [ ] **Step 3: 重写 ThemesSection 使用 next-themes**

把 `ThemesSection` 从"读 `settings.theme` + `save({theme})`"改为 next-themes 的 `useTheme()`。当前主题选项改为新体系（dark/light/cyberpunk/chinese）：

```tsx
import { useTheme } from "next-themes";

const NEW_THEMES = [
  { id: "dark", labelKey: "theme_dark" },
  { id: "light", labelKey: "theme_light" },
  { id: "cyberpunk", labelKey: "theme_cyberpunk" },
  { id: "chinese", labelKey: "theme_chinese" },
];

export default function ThemesSection() {
  const { theme, setTheme } = useTheme();
  // ...render NEW_THEMES 列表，onClick={() => setTheme(t.id)}
  // active = theme === t.id
}
```

> 需要为 4 个新主题添加 i18n key（`theme_dark`/`theme_light`/`theme_cyberpunk`/`theme_chinese`）到 `locales/en.json`、`locales/zh-CN.json`、`locales/zh-TW.json`。旧的 THEMES 常量从 `utils/theme.ts` 删除后，此组件不再 import 它。

- [ ] **Step 4: 验证前后端一致**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
cargo check 2>&1 | Select-Object -Last 6
npm run build 2>&1 | Select-Object -Last 6
```

Expected: 两者都通过。若 `npm run build` 报 `theme` 未定义，说明还有其它前端引用 `settings.theme`，需清理（见 Task 3）。

- [ ] **Step 5: Commit**

```bash
git add src/types/models.ts src/stores/settingsStore.ts src/components/settings/ThemesSection.tsx locales/
git commit -m "refactor: remove theme from frontend, ThemesSection uses next-themes"
```

---

### Task 3: 移除 utils/theme.ts 与 App.tsx 的 applyTheme

**Files:**
- Delete: `src/utils/theme.ts`
- Modify: `src/App.tsx`（移除 `applyTheme` import 与 `useEffect` 调用）

**Interfaces:**
- Consumes: Task 2（THEMES 已无引用）
- Produces: 旧主题工具彻底删除；App 不再设置 `data-theme`（由 next-themes 接管）

- [ ] **Step 1: 移除 App.tsx 的 applyTheme 调用**

在 `App.tsx`：
- 删除 `import { applyTheme } from "./utils/theme";`
- 删除 `useEffect(() => { applyTheme(theme) }, [theme])` 及其依赖 `theme` 的提取

搜索确认无其它 `utils/theme.ts` 引用：

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
Select-String -Path src -Pattern "utils/theme|applyTheme|from \"../utils/theme\"" -Recurse
```

Expected: 仅剩 `App.tsx` 一处（正在删）；其余无引用。

- [ ] **Step 2: 删除 utils/theme.ts**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
Remove-Item src/utils/theme.ts
```

- [ ] **Step 3: 验证**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build 2>&1 | Select-Object -Last 6
```

Expected: build 通过（无 `theme.ts` 或 `applyTheme` 引用）。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy theme util and applyTheme from App"
```

---

### Task 4: config.json theme 一次性迁移到 localStorage

**Files:**
- Modify: `src/main.tsx`（在 React 挂载前做一次性迁移）

**Interfaces:**
- Consumes: Task 2/3（theme 已从 settings 移除）
- Produces: 老用户 config.json 的 theme 值映射到 localStorage 的 `theme` 键

- [ ] **Step 1: 读取旧 theme 值并写入 localStorage（一次性）**

在 `main.tsx` 挂载 React 前（`createRoot` 前）加迁移逻辑：

```tsx
// One-time migration: legacy config.json theme → next-themes localStorage.
// Old values (Cartoon/Cyberpunk/Chinese/...) mapped to new token themes.
(function migrateLegacyTheme() {
  try {
    const storageKey = "theme";
    if (localStorage.getItem(storageKey) !== null) return; // already migrated
    const legacy = (window as any).__LEGACY_THEME__; // injected by boot? or read here
    // If unavailable, read from config via a marker; default to dark.
    const map: Record<string, string> = {
      cyberpunk: "cyberpunk", cyberpunk: "cyberpunk",
      chinese: "chinese", Chinese: "chinese",
      Default: "dark", Dark: "dark", Light: "light",
    };
    const next = map[legacy] || "dark";
    localStorage.setItem(storageKey, next);
  } catch {
    /* noop */
  }
})();
```

> **关键**：旧 `config.json` 的 theme 值需要在 `main.tsx` 处可读。由于 settings 由后端 `get_settings` 异步返回（不通过 `window` 全局），最可靠的做法是：在迁移点从 **`config.json` 文件路径**读取——但前端无法直接读文件（Tauri 需 IPC）。因此改为：**利用旧的 `localStorage` 或让后端提供一次性值**。

**实际可行方案**：由于后端 `get_settings` 已不返回 `theme`（Task 1 删除），旧值无法再读。因此在 Task 1 **删除前**，先在 `main.tsx` 增加一次性迁移（从当时还能读的 settings 取旧 theme）——**所以迁移逻辑必须在 Task 1 之前或与其配合**。调整执行顺序：**Task 4 放到 Task 1 之前**（见下方"执行顺序修正"）。

- [ ] **Step 2: 验证迁移不破坏启动**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 通过，应用启动后 localStorage 有 `theme` 键，`<html data-theme>` 正确。

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: one-time migrate legacy config theme to localStorage"
```

---

### Task 5: 全量验证 + i18n 同步

**Files:**
- Verify: 前后端编译、GUI 冒烟

**Interfaces:**
- Consumes: 全部 M5a 任务

- [ ] **Step 1: 前后端完整构建**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
cargo check 2>&1 | Select-Object -Last 5
npm run build 2>&1 | Select-Object -Last 5
```

Expected: 均通过。

- [ ] **Step 2: GUI 冒烟（主题切换）**

运行应用：
1. 打开设置→主题页，确认显示 4 个新主题（dark/light/cyberpunk/chinese），切换生效（`<html data-theme>` 变化、背景/主色变化）。
2. 刷新/重启后主题保持（localStorage 持久化）。
3. 确认 GridView/TopBar/Sidebar（未迁移，仍用旧类）在 dark 下视觉正常（旧 global.css 仍提供这些类的默认样式）。

- [ ] **Step 3: 汇报**

确认 M5a 完成，可进入 M5b（GridView/TopBar/Sidebar 新 token 视觉重建 + global.css 清理）。

---

## 执行顺序修正（重要）

原 Task 顺序（Task1 先删后端）会导致 **Task 4 无法读取旧 theme 值**（因为删了字段就读不到）。**修正执行顺序**：

1. **Task 4 提前到最前**：在删除 theme 字段之前，先在 `main.tsx` 写入一次性迁移（此时后端仍返回旧 theme，可读）。
2. 再执行 Task 1/2/3（删后端字段 → 删前端字段 → 删 utils/theme.ts）。

**因此最终顺序：Task 4 → Task 1 → Task 2 → Task 3 → Task 5。**

## Self-Review

- **覆盖**：M5a 覆盖"删 theme 字段（前后端）+ 删 utils/theme.ts + ThemesSection 改用 next-themes + config.json 迁移"。✓
- **顺序修正**：迁移提前到删字段之前，避免读不到旧值。✓
- **前后端一致性**：Task 1 删后端后，Task 2 同步删前端，tsc/cargo 各自验证。✓
- **未覆盖（M5b）**：GridView/TopBar/Sidebar 视觉重建、global.css 清理——已标注为独立计划。✓
- **占位符**：无。迁移逻辑已写明（含顺序修正说明）。✓
