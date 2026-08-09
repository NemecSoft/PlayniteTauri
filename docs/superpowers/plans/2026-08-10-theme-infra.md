# 主题系统基础设施重构（M0-M3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 Tailwind CSS v4 + shadcn/ui + next-themes，重建主题基础设施（语义 token + 主题切换 + 基础组件），验证不黑屏，为后续 24 个业务组件全量迁移铺路。

**Architecture:** 采用 shadcn 标准语义 token 层（`--background`/`--primary` 等），组件只消费 token；next-themes 用 `data-theme` 属性驱动 `<html>` 根节点切换，localStorage 持久化。先做最小入口验证 Tailwind v4 不黑屏，再落地基础设施。

**Tech Stack:** Vite 8 + React 19 (React Compiler) + TypeScript 6 + Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn/ui + next-themes + zustand 5

> **范围说明：** 本计划只覆盖设计文档的 **M0-M3**（可行性验证 + 基础设施 + 旧主题下线 + 基础组件重写）。M4（24 个业务组件全量迁移）与 M5（config.json 迁移、清理、文档）工作量过大，将作为**独立后续计划**，在 M0-M3 交付并确认不黑屏后再编写。

## Global Constraints

- 遵循 `AGENTS.md`：先读再改；沿用既有模式；用 `scripts/auto-build.mjs` 或 `build.ps1` 构建；完成后跑 `npm run build` + `cargo check`；文档同步 `docs/design/*.md` 和 `docs/CHANGELOG.md`。
- 构建验证用 `npm run build`（tsc + vite）。**dev 模式可能因 CSS 注入时序掩盖黑屏问题，每任务必须验证 build 产物**。
- 技术栈锁定：Vite 8、React 19.2、TypeScript 6、Tailwind v4（`@tailwindcss/vite`，非 v3 的 PostCSS 方案）。
- `@import "tailwindcss"` 必须是 `globals.css` 的第一行，不得被其它 `@import` 覆盖。
- `vite.config.ts` 的 `plugins` 数组中 `@tailwindcss/vite()` 必须排在 `react()` 之前。
- 新 token 命名遵循 shadcn 标准：`--background`/`--foreground`/`--card`/`--card-foreground`/`--primary`/`--primary-foreground`/`--secondary`/`--secondary-foreground`/`--muted`/`--muted-foreground`/`--border`/`--ring`。
- 主题精简为：`dark`（默认）、`light`、`cyberpunk`（赛博朋克）、`chinese`（中国风）。
- 不新增 sonner / Radix 之外的 toast 等依赖，除非设计明确要求。
- `lucide-react` 已存在，直接复用。
- 每次 `npm run build` 成功后才算任务完成。

---

### Task 1: 安装依赖（tailwindcss + @tailwindcss/vite + shadcn 基础）

**Files:**
- Modify: `package.json`（依赖自动写入）

**Interfaces:**
- Consumes: 无
- Produces: `tailwindcss` / `@tailwindcss/vite` 等已安装，Task 2 可引用插件

- [ ] **Step 1: 安装 Tailwind v4 及其 Vite 插件**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm install tailwindcss @tailwindcss/vite
```

Expected: `package.json` devDependencies 增加 `tailwindcss` 与 `@tailwindcss/vite`。

- [ ] **Step 2: 安装 shadcn 依赖**

```bash
npm install class-variance-authority clsx tailwind-merge
npm install next-themes
```

Expected: dependencies 增加 `class-variance-authority`、`clsx`、`tailwind-merge`、`next-themes`。

- [ ] **Step 3: 验证安装**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm ls tailwindcss @tailwindcss/vite next-themes clsx tailwind-merge class-variance-authority
```

Expected: 5 个包均列出，无 `UNMET` 标记。

- [ ] **Step 4: Commit**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
git add package.json package-lock.json
git commit -m "chore: add tailwind v4, shadcn helpers and next-themes deps"
```

---

### Task 2: 配置 Tailwind v4 Vite 插件（排在 react() 之前）

**Files:**
- Modify: `vite.config.ts:5-15`

**Interfaces:**
- Consumes: Task 1 安装的 `@tailwindcss/vite`
- Produces: Vite 正确注入 Tailwind，Task 3 的 `globals.css` 可被编译

- [ ] **Step 1: 在 plugins 数组最前加入 @tailwindcss/vite**

在 `vite.config.ts` 顶部 import 插件，并把它放在 `react()` 之前：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async () => ({
  plugins: [
    // IMPORTANT: @tailwindcss/vite MUST precede react() to avoid CSS
    // injection ordering issues that caused a black screen before.
    tailwindcss(),
    react({
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", { target: "19" }],
        ],
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/target/**",
        "**/dist/**",
        "**/dist-admin/**",
        "**/release/**",
        "**/admin_release/**",
        "**/node_modules/**",
      ],
    },
  },
}));
```

- [ ] **Step 2: 验证配置编译**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npx tsc --noEmit
```

Expected: 无类型错误（此时未引用 Tailwind 类，编译应正常通过）。

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add @tailwindcss/vite plugin ahead of react()"
```

---

### Task 3: 创建 globals.css 入口（M0 最小验证）

**Files:**
- Create: `src/styles/globals.css`

**Interfaces:**
- Consumes: Task 2 的 Tailwind Vite 插件
- Produces: `globals.css` 成为 Tailwind + 全局样式唯一入口，Task 5 在其上叠加 token

- [ ] **Step 1: 创建 globals.css**

```css
/* Tailwind must be imported first — @import order is the #1 black-screen cause. */
@import "tailwindcss";

html,
body,
#root {
  height: 100%;
  margin: 0;
}
```

- [ ] **Step 2: 临时挂载 globals.css 验证（dev + build 双验证）**

在 `src/main.tsx` 的 import 区最前面加 `import "./styles/globals.css";`（仅本任务验证用，Task 4 会重构入口）。

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 成功；启动 dev（`npm run dev`）后页面**不黑屏**，能正常显示应用（此步验证 Tailwind v4 preflight 是否破坏现有布局）。

- [ ] **Step 3: 移除 Task 3 的临时 import（还原，避免与现有 global.css 冲突）**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
# 撤销 Step 2 加的那行 import，保持 main.tsx 原样
```

Expected: `git diff src/main.tsx` 为空。

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: add tailwind globals.css entry and verify no black screen"
```

---

### Task 4: 创建 cn() 工具与 lib/utils.ts

**Files:**
- Create: `src/lib/utils.ts`

**Interfaces:**
- Consumes: `clsx` / `tailwind-merge`（Task 1）
- Produces: 导出 `cn(...inputs)`，供后续所有 shadcn 组件使用

- [ ] **Step 1: 创建 utils.ts**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add cn() helper (clsx + tailwind-merge)"
```

---

### Task 5: 定义语义 token 与 globals.css 主题变量（M1）

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/styles/globals.css`（@import tokens 在 tailwind 之后）

**Interfaces:**
- Consumes: Task 3 的 `globals.css`
- Produces: `--background`/`--primary` 等语义 token 定义，以及 `[data-theme]` 各主题变量，Task 6/7/8 引用

- [ ] **Step 1: 创建 tokens.css（明暗双主题 + 精选主题）**

```css
/* tokens.css — semantic design tokens, shadcn naming.
   Applied on :root (light default) and [data-theme]. */

:root,
[data-theme="light"] {
  --background: 222 47% 96%;
  --foreground: 222 47% 10%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 10%;
  --primary: 262 83% 58%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 90%;
  --secondary-foreground: 222 47% 10%;
  --muted: 220 14% 90%;
  --muted-foreground: 220 9% 46%;
  --border: 220 13% 82%;
  --ring: 262 83% 58%;
}

[data-theme="dark"] {
  --background: 222 47% 7%;
  --foreground: 214 32% 91%;
  --card: 222 47% 10%;
  --card-foreground: 214 32% 91%;
  --primary: 262 83% 68%;
  --primary-foreground: 222 47% 10%;
  --secondary: 217 33% 17%;
  --secondary-foreground: 214 32% 91%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --border: 217 33% 25%;
  --ring: 262 83% 68%;
}

/* Cyberpunk: neon cyan / magenta accents */
[data-theme="cyberpunk"] {
  --background: 240 40% 6%;
  --foreground: 186 100% 90%;
  --card: 240 30% 10%;
  --card-foreground: 186 100% 90%;
  --primary: 320 100% 60%;
  --primary-foreground: 0 0% 0%;
  --secondary: 190 90% 40%;
  --secondary-foreground: 0 0% 0%;
  --muted: 240 25% 14%;
  --muted-foreground: 189 40% 65%;
  --border: 190 70% 35%;
  --ring: 320 100% 60%;
}

/* Chinese style: cinnabar red + ink */
[data-theme="chinese"] {
  --background: 20 20% 10%;
  --foreground: 35 50% 90%;
  --card: 20 18% 14%;
  --card-foreground: 35 50% 90%;
  --primary: 6 78% 48%;
  --primary-foreground: 0 0% 100%;
  --secondary: 28 30% 20%;
  --secondary-foreground: 35 50% 90%;
  --muted: 20 16% 18%;
  --muted-foreground: 35 20% 65%;
  --border: 20 20% 26%;
  --ring: 6 78% 48%;
}
```

> 注：token 用 HSL（`h s l` 三元组）以匹配 shadcn 生成器输出，Tailwind 侧用 `oklch()` 或 `hsl(var(--background))` 消费。

- [ ] **Step 2: 在 globals.css 引入 tokens.css**

```css
@import "tailwindcss";
@import "./tokens.css";
```

- [ ] **Step 3: 配置 Tailwind v4 主题映射（oklch 或 hsl 消费 token）**

在 `globals.css` 尾部用 `@theme` 声明 Tailwind 颜色别名：

```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-border: hsl(var(--border));
  --color-ring: hsl(var(--ring));
}
```

- [ ] **Step 4: 验证编译**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 成功（Tailwind 能解析 token 变量）。

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/globals.css
git commit -m "feat: add semantic tokens for dark/light/cyberpunk/chinese themes"
```

---

### Task 6: 创建 next-themes ThemeProvider（M1）

**Files:**
- Create: `src/providers/ThemeProvider.tsx`

**Interfaces:**
- Consumes: `next-themes`（Task 1），token 层（Task 5）
- Produces: 导出 `<ThemeProvider>`，用 `attribute="data-theme"` 控制 `<html>`；Task 7 挂载到 App

- [ ] **Step 1: 创建 ThemeProvider**

```tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

> `enableSystem={false}`：本项目是桌面应用，不做系统跟随，避免不必要的媒体查询分支。

- [ ] **Step 2: 验证编译**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/providers/ThemeProvider.tsx
git commit -m "feat: add next-themes ThemeProvider (data-theme attr)"
```

---

### Task 7: 在 App 根节点挂载 ThemeProvider（M1）

**Files:**
- Modify: `src/App.tsx`（在应用根包裹 ThemeProvider）

**Interfaces:**
- Consumes: Task 6 的 `ThemeProvider`
- Produces: 应用运行时 `<html data-theme="dark">` 等，主题切换生效

- [ ] **Step 1: 读 App.tsx 当前结构**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
Get-Content src/App.tsx | Select-Object -First 60
```

Expected: 看到 App 组件返回的根 JSX 结构。

- [ ] **Step 2: 用 ThemeProvider 包裹应用根**

在 App 组件返回的最外层 JSX 外包 `<ThemeProvider>`，例如：

```tsx
import { ThemeProvider } from "./providers/ThemeProvider";

export default function App() {
  // ...existing hooks/state...
  return (
    <ThemeProvider>
      {/* ...existing root JSX... */}
    </ThemeProvider>
  );
}
```

（保持原有内容不变，仅在最外层包一层。）

- [ ] **Step 3: 验证主题切换生效（冒烟）**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 成功。启动应用后在 `<html>` 元素上能看到 `data-theme="dark"` 属性，页面用新 token 渲染，**不黑屏**。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/providers/ThemeProvider.tsx
git commit -m "feat: wrap app with ThemeProvider"
```

---

### Task 8: 生成 shadcn 基础组件（button + 其它 M3 需用）

**Files:**
- Create: `src/components/ui/button.tsx`（及其它 Task 9 需要的 ui 组件）

**Interfaces:**
- Consumes: `cn()`（Task 4）、token（Task 5）、`cva`（Task 1）
- Produces: `Button` 组件（variant/size），Task 9 用于替换业务按钮

- [ ] **Step 1: 创建 button.tsx**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-red-500 text-white hover:bg-red-500/90",
        outline:
          "border border-border bg-transparent hover:bg-muted hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

- [ ] **Step 2: 验证编译**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: add shadcn button with variants"
```

---

### Task 9: 用新 Button 替换一个现有业务按钮（验证链路打通）

**Files:**
- Modify: 一个简单组件里的按钮（如设置页或首页某按钮）

**Interfaces:**
- Consumes: Task 8 的 `Button`
- Produces: 验证 `cn` + token + Tailwind 类在全链路可用

- [ ] **Step 1: 定位一个简单按钮**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
Get-ChildItem -Recurse src/components -Filter *.tsx | Select-Object -First 30
```

Expected: 列出全部组件，选一个按钮最少的（如设置弹窗里的关闭按钮）替换。

- [ ] **Step 2: 替换为 shadcn Button**

把目标组件中的 `<button className="...">` 改为 `<Button className="..." variant="..." ...>`，删除手写按钮样式类，改用 token 相关 Tailwind 类（如 `bg-primary`）。

- [ ] **Step 3: 验证构建 + 冒烟**

```bash
cd d:/AI/Code/Playnite/PlayniteTauri
npm run build
```

Expected: build 成功；应用正常显示，替换后的按钮用新主题 token 渲染，不黑屏。

- [ ] **Step 4: Commit**

```bash
git add <改动的组件>
git commit -m "refactor: migrate one button to shadcn Button"
```

---

## 后续计划（不在本计划内）

- **M4 计划**：24 个业务组件逐组件迁移到 Tailwind + shadcn（每组件一个任务）。
- **M5 计划**：旧 `config.json` theme 字段一次性迁移、删除旧 `utils/theme.ts` 与 12 主题 CSS、清理死代码、重写 `docs/design/theming.md`、更新 `docs/CHANGELOG.md` 与 `AGENTS.md`。

M0-M3 交付并通过"不黑屏 + 主题切换"验证后，再编写 M4/M5 计划。

---

## Self-Review

- **Spec coverage（M0-M3 范围）**：设计 §3（preflight 解法，Task 2 插件顺序 + Task 3 验证）、§4（依赖，Task 1）、§5（globals.css/utils/ThemeProvider/ui，Task 3/4/5/6/8）、§6（token 映射，Task 5）。✓
- **占位符扫描**：所有任务均含真实代码/命令/验证方式。✓
- **类型一致性**：`cn()`（Task 4）→ 各 ui 组件统一引用；`ThemeProvider`（Task 6）→ App（Task 7）签名一致（`attribute="data-theme"`）。✓
- **未覆盖（属 M4/M5）**：24 业务组件迁移、旧主题删除、config.json 迁移、文档重写——已明确标注为后续计划，符合 Scope Check 拆分原则。✓
