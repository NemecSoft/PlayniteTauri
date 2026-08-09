# 主题系统重构：从手写 CSS 到 Tailwind v4 + shadcn/ui + next-themes

> 状态：设计草案（brainstorming 阶段，待获批后进入实现）
> 决策摘要：这是 **big-bang 全量重写**，放弃现有 12 主题手写体系，24 个组件全部改用 Tailwind/shadcn。

## 1. 背景与目标

### 1.1 现状
- `src/styles/global.css` 2728 行，含 12 主题 × 23 语义变量的手写 CSS 变量驱动体系。
- 主题切换靠 `src/utils/theme.ts` + `[data-theme]` 属性 + zustand `settingsStore` + 后端 IPC 持久化。
- 组件样式大量手写选择器，且多处 React 内联 `style={{ color: "var(--xx)" }}` 深度耦合 CSS 变量。

### 1.2 目标
- 引入 **Tailwind CSS v4**（utility-first）+ **shadcn/ui**（无头组件 + 语义 token）+ **next-themes**（主题切换/持久化）。
- 建立**语义化设计 token 层**（`--background`/`--foreground`/`--primary`/`--secondary`/`--muted` 等 shadcn 标准命名）。
- 主题精简为：**明暗双主题 + 精选主题**（起步：暗黑、赛博朋克、中国风，后续可扩展）。
- 主题持久化改用 **next-themes 原生 localStorage**，与后端解耦；老用户 `config.json` 的 theme 字段一次性迁移。

## 2. 核心架构（shadcn/ui 主题原理）

```
shadcn/ui 主题底层 = CSS 自定义变量（语义化 token）
  ↓ 所有组件统一读取 --background / --primary 等变量，不写死色值
  ↓ React(next-themes) 负责状态管理 / 持久化 / 动态切换 data-attribute 或 class
  ↓ HTML 根节点(<html>) 上的 data-attribute / class 打通二者
```

组件不感知具体主题，只消费 token；切换主题 = 换一套 token 值。

## 3. 之前黑屏的根因分析与解决方案（技术可行性前提）

用户选择"重新评估 preflight 冲突"。基于项目实际（Vite 8 + React Compiler + Tauri v2），之前的黑屏根因**大概率不是 Tailwind 本身**，而是集成方式问题：

| 可能根因 | 说明 | 本方案解法 |
| --- | --- | --- |
| **@import 顺序** | Tailwind 的 `@import "tailwindcss"` 未放最前，被其它 CSS 覆盖或自身 reset 被覆盖 | v4 必须作为 `main.css` 的第一行 `@import` |
| **Vite 插件顺序** | `@tailwindcss/vite` 与 React Compiler(babel) 插件顺序冲突 | 在 `vite.config.ts` 的 `plugins` 中 `@tailwindcss/vite()` 放最前 |
| **preflight 重置布局** | preflight 重置 button/input/ul 等默认样式，破坏现有手写布局 | 先确认 reset 后布局塌陷点；必要时用 `@layer` 分层或局部禁用 preflight |
| **React Compiler + CSS 注入时序** | 编译缓存 / HMR 注入导致 CSS 未就绪，首帧空白 | 保留现有 boot screen 兜底，验证 build 产物而非仅 dev |

**验证策略（里程碑 0，先跑通再迁移）**：单独建一个最小 Tailwind v4 + shadcn 入口，先确认不黑屏，再全量迁移。这是 big-bang 的前提保障。

## 4. 依赖清单

```
npm i tailwindcss @tailwindcss/vite
npm i class-variance-authority clsx tailwind-merge lucide-react
npm i next-themes @radix-ui/react-* (按需，shadcn add 会自动装)
```

> 注意：`lucide-react` 已存在（项目已在用）。sonner 等 toast 库按需。

## 5. 目录结构规划

```
src/
├── styles/
│   ├── globals.css          # 唯一入口: @import "tailwindcss" + token + 少量全局
│   └── tokens.css           # 语义 token (可选拆分)
├── lib/
│   ├── utils.ts             # cn() = twMerge + clsx
│   └── theme.ts             # 主题定义 + next-themes 配置（替代旧 utils/theme.ts）
├── components/
│   ├── ui/                  # shadcn 组件 (button/dialog/card/form/...)
│   └── ...                  # 现有业务组件逐步改用 Tailwind + ui/*
├── providers/
│   └── ThemeProvider.tsx    # next-themes 封装
```

## 6. 主题 token 映射（12 主题 → 明暗 + 精选）

新 token 采用 shadcn 标准命名，旧主题变量做一次性映射：

| shadcn token | 旧项目变量 | 说明 |
| --- | --- | --- |
| `--background` / `--foreground` | `--bg-base` / `--text-primary` | 页面底/前景 |
| `--card` / `--card-foreground` | `--bg-card` | 卡片 |
| `--primary` / `--primary-foreground` | `--accent` | 主色/主色上文字 |
| `--secondary` / `--secondary-foreground` | `--bg-*` 次级 | 次级 |
| `--muted` / `--muted-foreground` | `--text-secondary` | 弱化 |
| `--border` | `--border` | 边框 |
| `--ring` | `--accent` 半透明 | 焦点环 |

**明暗双主题**：`[data-theme="light"]` / `[data-theme="dark"]` 两套 token。
**精选主题**：在 dark/light 基础上，叠加 accent 系 token 差异（赛博朋克=青紫、中国风=朱红）。
next-themes 用 `attribute="data-theme"` 切换。

## 7. 持久化与迁移

- next-themes 默认 localStorage 键（如 `theme`），`attribute="data-theme"` 写 `<html data-theme="...">`。
- **一次性迁移**：`main.tsx` 或 ThemeProvider 初始化时，若 localStorage 无值但 `config.json` 的 theme 有旧值，则读旧值映射到新主题写入 localStorage，并清除/标注旧字段。
- 后端 `config.json` 的 theme 字段保留写入但**不再驱动 UI**（或删除，二选一，见开放问题）。

## 8. 分阶段实施（big-bang 但按里程碑推进，降低回归）

- **M0 可行性验证**：搭 Tailwind v4 + shadcn 最小入口，确认不黑屏（含 build 产物）。
- **M1 基础设施**：globals.css / tokens / cn() / ThemeProvider / next-themes 接入，跑通主题切换。
- **M2 旧主题下线**：删除旧 `utils/theme.ts` 12 主题、`[data-theme]` 多主题 CSS，移除 `global.css` 主题变量区。
- **M3 基础组件重写**：shadcn ui/* 生成；按钮/弹窗/表单/输入等组件改用 Tailwind。
- **M4 业务组件迁移**：24 个业务组件逐组件迁移（首页/游戏网格/详情/设置/登录/权限等），每完成一个跑通验证。
- **M5 收尾**：旧 config.json 迁移、清理死代码、文档同步（CHANGELOG / AGENTS.md / theming.md）。

## 9. 风险

- **回归风险高**（0 测试）：每 M 阶段需手动验证核心流程（主题切换、登录、游戏库、权限、设置持久化）。
- **内联 style 耦合**：24 组件中大量 `var(--xx)` 内联样式需逐一替换为 token 或 Tailwind 类。
- **preflight 布局影响**：reset 改变默认间距/字体后，现有布局需回归。
- **旧主题丢失**：12 → 4 主题，部分视觉退化可接受（用户已确认精简）。

## 10. 开放问题（待用户拍板）

1. **后端 config.json 的 theme 字段**：彻底删除 vs 保留写入但不再驱动 UI？
2. **精选主题数量**：起步 3 套（暗黑/赛博朋克/中国风）是否够？要否加"浅色"变体？
3. **迁移完成后 `docs/design/theming.md` 是否重写**为新的 token 体系文档？

---

*本文档基于 brainstorming 流程编写，尚未获批。获批后进入 writing-plans 拆解任务。*
