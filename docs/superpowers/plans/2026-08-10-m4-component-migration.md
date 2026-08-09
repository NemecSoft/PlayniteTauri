# 组件迁移到 Tailwind + shadcn（M4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 24 个业务组件从手写 CSS 类 / 内联 `var(--xxx)` 迁移到 Tailwind 工具类 + shadcn 组件，最终清空 `src/styles/global.css` 的组件样式区。保留 GridView 虚拟化、Sidebar 拖拽、TopBar frameless 窗口等特殊逻辑。

**Architecture:** 先在 `globals.css` 的 `@theme inline` 补齐业务变量映射（`--accent`→`bg-accent` 等），再按"简单→中等→复杂"三批逐文件迁移。每个组件迁移后跑 `npm run build` 验证。特殊内联 style（虚拟化定位、`--sidebar-width`、`-webkit-app-region`）必须保留。

**Tech Stack:** Tailwind v4 (`@theme inline` + 工具类) + shadcn/ui (`Button`) + 现有 React 19 / TS 6

> **前提（已完成 M0-M3）**：Tailwind v4 + shadcn + next-themes 基础设施已就绪，`globals.css` 已有 `@import "tailwindcss"` + `@theme inline`（8 个 shadcn token）。本计划第一步补齐业务变量映射。

## Global Constraints

- 遵循 `AGENTS.md`；构建验证用 `npm run build`（tsc + vite）。
- **特殊内联 style 必须保留**：
  - `GridView.tsx` 的 `gridTemplateColumns` / `gap` / `transform` / `position`（虚拟化布局）
  - `Sidebar.tsx` 的 `--sidebar-width` 动态 CSS 变量
  - `TopBar.tsx` 的 `-webkit-app-region`（frameless 拖拽）
- 迁移只替换**静态 className** 和**可映射的内联 `var(--xxx)`**，不改变组件 JSX 结构、props、交互逻辑。
- 复用类（`.empty-state`、`.field`、`.btn`）先用 Tailwind 等价工具组合替代，再逐文件替换。
- `GamesView.tsx` 纯组合层（无 UI 类），**零成本跳过**。
- 每个文件迁移完：`npm run build` 通过 → `git add` 该文件 → commit（语义化消息）。
- 迁移期间新旧样式共存（旧 `global.css` 仍在），**最后**（M5）才删除旧样式区，避免中间态黑屏。

---

### Task 1: 补齐业务变量 → Tailwind 颜色映射（前置基础）

**Files:**
- Modify: `src/styles/globals.css`（`@theme inline`）

**Interfaces:**
- Consumes: tokens.css 的 shadcn token
- Produces: `bg-accent` / `text-muted` / `bg-panel` 等 Tailwind 工具类可用，后续组件迁移引用

- [ ] **Step 1: 在 `@theme inline` 中补充业务变量映射**

在 globals.css 的 `@theme inline` 块里增加以下映射（值对应现有 global.css 的业务变量名）：

```css
@theme inline {
  /* ...existing shadcn tokens... */
  --color-accent: hsl(var(--primary));              /* accent 主色 */
  --color-accent-hover: hsl(var(--ring));
  --color-panel: var(--panel-bg, #1e2227);          /* 面板背景 */
  --color-surface: var(--surface, #262a30);         /* 次级面板 */
  --color-muted: hsl(var(--muted));                 /* 已存在，覆盖前景弱化 */
  --color-success: var(--success, #22c55e);
}
```

> 若某个变量在现有组件里用 `var(--text-dim)`、`var(--bg-input)` 等，需要一一映射。**先扫描 global.css 确认完整业务变量清单**再写映射（见 Step 2）。

- [ ] **Step 2: 扫描确认业务变量完整清单**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
# 提取 global.css 中所有 --xxx 变量名
Select-String -Path src/styles/global.css -Pattern '--[a-z][a-z0-9-]+:' | ForEach-Object { ($_.Matches[0].Value -replace ':','') } | Sort-Object -Unique
```

Expected: 得到业务变量清单（`--accent`、`--accent-hover`、`--bg-*`、`--text-*`、`--border`、`--success`、`--sidebar-width` 等）。

- [ ] **Step 3: 对照清单完成 `@theme inline` 映射**

把所有需要暴露为 Tailwind 工具类的业务变量补进 `@theme inline`。确认映射后 build。

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 通过（新映射不破坏现有构建，因为还没组件用它们）。

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: map legacy business CSS vars to Tailwind colors in @theme"
```

---

### Task 2: 迁移简单纯 UI 组件（第一批，8 个）

**Files:**
- Modify: `src/components/views/EmptyState.tsx`
- Modify: `src/components/AppBody.tsx`
- Modify: `src/components/MainContent.tsx`
- Modify: `src/components/ToastContainer.tsx`
- Modify: `src/components/ImageProgressBar.tsx`
- Modify: `src/components/StatusBar.tsx`
- Modify: `src/components/GameContextMenu.tsx`

**Interfaces:**
- Consumes: Task 1 的 Tailwind 颜色工具、shadcn `Button`
- Produces: 8 个简单组件改用 Tailwind 类，不再依赖 `.empty-state`/`.spinner`/`.toast-*` 等手写类

- [ ] **Step 1: EmptyState**

把 `.empty-state`（flex 居中）替换为 `flex flex-col items-center justify-center gap-2`；`.big-icon` 替换为 `text-muted` + 尺寸类；内联 `color: var(--text-primary)` → `text-foreground`。

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
git add src/components/views/EmptyState.tsx
git commit -m "refactor: migrate EmptyState to Tailwind"
```

- [ ] **Step 2: AppBody**

`.app-shell` / `.app-body` 布局类替换为 flex 工具类（`flex flex-col h-full` / `flex flex-1 overflow-hidden`）。

```bash
npm run build && git add src/components/AppBody.tsx && git commit -m "refactor: migrate AppBody to Tailwind"
```

- [ ] **Step 3: MainContent**

`.main-area`（flex 容器）替换为 `flex-1 overflow-hidden`；`.center-loading`/`.spinner` 替换为 `flex items-center justify-center` + spinner 动画类（或在 Tailwind 中用 `animate-spin`）。

```bash
npm run build && git add src/components/MainContent.tsx && git commit -m "refactor: migrate MainContent to Tailwind"
```

- [ ] **Step 4: ToastContainer**

`.toast-container`（定位）替换为 `fixed top-3 right-3 z-[999] flex flex-col gap-2`；`.toast*` 替换为卡片类（`bg-card border border-border rounded-md shadow-lg p-3`）。

```bash
npm run build && git add src/components/ToastContainer.tsx && git commit -m "refactor: migrate ToastContainer to Tailwind"
```

- [ ] **Step 5: ImageProgressBar**

`.image-progress-*` 替换为 Tailwind（外层 `h-1 w-full bg-muted rounded-full overflow-hidden`；内层 `bg-primary transition-all`，`width` 百分比保留内联）。

```bash
npm run build && git add src/components/ImageProgressBar.tsx && git commit -m "refactor: migrate ImageProgressBar to Tailwind"
```

- [ ] **Step 6: StatusBar**

`.status-bar` 替换为 `flex items-center gap-3 px-3 h-7 text-xs text-muted-foreground border-t border-border`；`.status-item`/`.status-sep` 相应替换。

```bash
npm run build && git add src/components/StatusBar.tsx && git commit -m "refactor: migrate StatusBar to Tailwind"
```

- [ ] **Step 7: GameContextMenu**

`.context-menu`（fixed 定位）替换为 `fixed z-[1000] bg-card border border-border rounded-md shadow-lg py-1 min-w-[160px]`；`.context-menu-item` 替换为 `flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer`；`.danger` → `text-red-500`。

```bash
npm run build && git add src/components/GameContextMenu.tsx && git commit -m "refactor: migrate GameContextMenu to Tailwind"
```

- [ ] **Step 8: 第一批整体验证**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 通过，应用 UI 正常（简单组件视觉基本不变，用户 GUI 冒烟）。

---

### Task 3: 迁移设置表单（第一批，4 个相似文件）

**Files:**
- Modify: `src/components/settings/GeneralSection.tsx`
- Modify: `src/components/settings/LibrarySection.tsx`
- Modify: `src/components/settings/LoginSection.tsx`
- Modify: `src/components/settings/AppearanceSection.tsx`

**Interfaces:**
- Consumes: Task 1 映射、shadcn `Button`
- Produces: 设置表单改用 `.field` 的 Tailwind 等价（`mb-4` + label 类）+ 内联 `var(--xxx)` 映射为工具类

- [ ] **Step 1: 建立 `.field` 等价工具组合**

`.field` 通常是垂直排列（label + 控件）。用 `flex flex-col gap-2 mb-4` 替代。先在第一个文件验证。

- [ ] **Step 2: 迁移 GeneralSection（纯表单）**

`.field` → `flex flex-col gap-2 mb-4`；`.field.checkbox` → `flex items-center gap-2`；label 用 `text-sm text-foreground`；input 用 `bg-input border border-border rounded-md px-3 h-9`。

```bash
npm run build && git add src/components/settings/GeneralSection.tsx && git commit -m "refactor: migrate GeneralSection to Tailwind"
```

- [ ] **Step 3: 迁移 LibrarySection / LoginSection**

同理。LoginSection 的 `color: var(--success)` → `text-success`；`.link-btn` → shadcn `Button variant="link"`。

```bash
npm run build && git add src/components/settings/LibrarySection.tsx src/components/settings/LoginSection.tsx && git commit -m "refactor: migrate Library+Login sections to Tailwind"
```

- [ ] **Step 4: 迁移 AppearanceSection（内联 style 较重）**

把大量 `style={{ color: var(--text-dim) }}` 等替换为 Tailwind 类；保留功能性内联（flex 布局可转类）。`btn` → shadcn `Button`。

```bash
npm run build && git add src/components/settings/AppearanceSection.tsx && git commit -m "refactor: migrate AppearanceSection to Tailwind"
```

- [ ] **Step 5: 验证**

```bash
npm run build
```

Expected: build 通过，设置页 UI 正常。

---

### Task 4: 迁移中等组件（第二批，8 个）

**Files:**
- Modify: `src/components/views/NewsView.tsx`
- Modify: `src/components/views/ToolsView.tsx`
- Modify: `src/components/views/VideosView.tsx`
- Modify: `src/components/settings/ThemesSection.tsx`
- Modify: `src/components/settings/PluginsSection.tsx`
- Modify: `src/components/LoginScreen.tsx`
- Modify: `src/pages/GameDetailPage.tsx`

**Interfaces:**
- Consumes: Task 1 映射、shadcn `Button`
- Produces: 中等组件迁移完成

- [ ] **Step 1: NewsView**

`.news-*` 列表类替换；`btn primary small` → shadcn `Button size="sm"`；`color: var(--accent)` → `text-accent`。

```bash
npm run build && git add src/components/views/NewsView.tsx && git commit -m "refactor: migrate NewsView to Tailwind"
```

- [ ] **Step 2: ToolsView**

`.tools-*` 卡片类替换；`btn` → `Button`；`color: var(--accent)` → `text-accent`。

```bash
npm run build && git add src/components/views/ToolsView.tsx && git commit -m "refactor: migrate ToolsView to Tailwind"
```

- [ ] **Step 3: VideosView**

`.videos-*` 替换；`color: var(--accent)` → `text-accent`；保留 iframe/列表逻辑。

```bash
npm run build && git add src/components/views/VideosView.tsx && git commit -m "refactor: migrate VideosView to Tailwind"
```

- [ ] **Step 4: ThemesSection（内联 style 最重）**

几乎纯 inline，全部转为 Tailwind 类；主题卡用 `bg-card border border-border rounded-md`；swatches 用 `size-6 rounded-full`。**注意保留主题变量映射**（`--bg-input` 等若已映射则用工具类）。

```bash
npm run build && git add src/components/settings/ThemesSection.tsx && git commit -m "refactor: migrate ThemesSection to Tailwind"
```

- [ ] **Step 5: PluginsSection**

`.btn primary` → `Button`；`.tb-btn` → `Button size="icon" variant="ghost"`；大量内联 `var(--bg-input)` 等映射为工具类。

```bash
npm run build && git add src/components/settings/PluginsSection.tsx && git commit -m "refactor: migrate PluginsSection to Tailwind"
```

- [ ] **Step 6: LoginScreen**

4 个按钮迁移：tab → `Button variant="ghost"`；`btn primary block` → `Button className="w-full"`；`link-btn` → `Button variant="link"`。`color: var(--accent)` → `text-accent`。

```bash
npm run build && git add src/components/LoginScreen.tsx && git commit -m "refactor: migrate LoginScreen to Tailwind"
```

- [ ] **Step 7: GameDetailPage**

`btn` 返回按钮 → `Button variant="ghost" size="sm"`；`.detail-*` 类替换；保留 iframe/404/loading 多态渲染。

```bash
npm run build && git add src/pages/GameDetailPage.tsx && git commit -m "refactor: migrate GameDetailPage to Tailwind"
```

- [ ] **Step 8: 第二批整体验证**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 通过，新闻/工具/视频/登录/详情/设置主题页 UI 正常。

---

### Task 5: 迁移复杂组件（第三批，3 个 + 跳过 1 个）

**Files:**
- Modify: `src/components/NewsView.tsx`（已含）→ 实际为 `src/components/views/NewsView.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/views/GridView.tsx`
- Skip: `src/components/views/GamesView.tsx`（纯组合层，无 UI 类，零成本）

**Interfaces:**
- Consumes: 前两批迁移成果、shadcn `Button`
- Produces: 复杂组件迁移，保留特殊交互逻辑

- [ ] **Step 1: TopBar（9 按钮 + frameless 拖拽）**

⚠️ 保留所有 `-webkit-app-region: drag` / `no-drag` 元素（frameless 窗口必须）。`.topbar*` 布局类替换为 Tailwind；9 个按钮迁到 shadcn `Button`（菜单/tab/窗口控制），窗口控制按钮 `size="icon" variant="ghost"`。**逐个按钮验证**，勿一次全改。

```bash
npm run build && git add src/components/TopBar.tsx && git commit -m "refactor: migrate TopBar to Tailwind (keep -webkit-app-region)"
```

- [ ] **Step 2: Sidebar（拖拽 resize + --sidebar-width）**

⚠️ `style={{ "--sidebar-width": ... }}` 变量**必须保留**（控制动态宽度）。`.sidebar` 布局类替换为 `flex flex-col` + `width: var(--sidebar-width)`（内联）；`.sidebar-tag-*` 列表项替换为 Tailwind；`.sidebar-resizer`（拖拽手柄）保留。

```bash
npm run build && git add src/components/Sidebar.tsx && git commit -m "refactor: migrate Sidebar to Tailwind (keep --sidebar-width)"
```

- [ ] **Step 3: GridView（虚拟化布局）**

⚠️ **保留所有计算内联 style**：`gridTemplateColumns`、`gap`、`position:absolute`、`transform: translateY(...)`。只替换静态类名：`.content`（滚动容器）→ 保留或 `overflow-y-auto`；`.grid-card`/`.cover*`/`.title`/`.group-header` 等 → Tailwind 类。`.cover-btn play/details` → shadcn `Button size="sm"`（注意 hover 叠层）。

```bash
npm run build && git add src/components/views/GridView.tsx && git commit -m "refactor: migrate GridView to Tailwind (keep virtualized layout)"
```

- [ ] **Step 4: 第三批整体验证（GUI 冒烟重点）**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 通过。**GUI 冒烟**：顶栏可拖拽/窗口控制正常、侧栏可拖拽 resize、游戏网格虚拟滚动正常、卡片可点选/启动/详情。

---

### Task 6: 全量回归验证

**Files:**
- 无（仅验证）

**Interfaces:**
- Consumes: 全部迁移成果

- [ ] **Step 1: 完整构建**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 通过，CSS 体积下降（global.css 组件样式区未删但不再被引用，实际不下降；真正的体积下降在 M5）。

- [ ] **Step 2: 全功能 GUI 冒烟**

运行应用，逐页验证：主页/游戏库（网格虚拟滚动、筛选/分组/排序、详情、启动）、新闻、视频、工具、设置（通用/外观/游戏库/插件/主题/登录）、公告弹窗、右键菜单、Toast、登录流程。

- [ ] **Step 3: 汇报**

向用户汇总迁移进度，确认 M4 完成，可进入 M5（旧主题下线）。

---

## 后续计划（不在本计划内）

- **M5 计划**：删除旧 `src/utils/theme.ts` 12 主题、`config.json` theme 字段一次性迁移、删除 `global.css` 组件样式区（已迁移的类）、清理死代码、重写 `docs/design/theming.md`、更新 `docs/CHANGELOG.md` 与 `AGENTS.md`。

## Self-Review

- **覆盖**：24 组件除 `GamesView`（纯组合，跳过）外全部覆盖；3 批按复杂度排序。✓
- **特殊逻辑**：GridView 虚拟化 style、Sidebar `--sidebar-width`、TopBar `-webkit-app-region` 均明确"必须保留"。✓
- **前置**：Task 1 补齐业务变量映射，是后续所有替换的依赖。✓
- **验证**：每文件 build + commit；Task 6 全量回归 + GUI 冒烟。✓
- **未覆盖（M5）**：旧主题删除、config.json 迁移、文档重写——已标注。✓

## 执行修正（SDD plan correction）

**Task 5（GridView/TopBar/Sidebar）延迟到 M5**。原因：这三个是**主题耦合最深 + 风险最高**的组件——
- 它们的样式深度绑定旧 12 主题的专属视觉（卡片描边/霓虹/国风/吉卜力等 `[data-theme]` 规则）
- TopBar 的 frameless 拖拽 `-webkit-app-region`、Sidebar 的 `--sidebar-width`、GridView 的虚拟化布局都是关键交互
- 在 M4（旧主题仍生效）迁移它们，会破坏主题化卡片视觉 + 冒窗口/拖拽/虚拟化失效风险

**正确顺序**：这三个组件应在 M5（新 token 主题完整视觉就绪 + 旧主题下线）时统一迁移/重建。M4 已完成其余 20 个"业务色 token 驱动"组件的安全迁移。
