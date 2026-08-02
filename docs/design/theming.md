# 主题系统（双主题即时切换）

## 目标

支持 **卡通风格** 与 **赛博朋克风格** 两种主题，**切换即时应用**，并持久化。

## 实现方案

### CSS 变量驱动（`src/styles/global.css`）

所有界面颜色、圆角、字体、发光效果均通过 CSS 变量定义。默认（深色）主题作为 `:root` 基底，
两种主题通过 `html[data-theme]` 属性选择器覆盖同一组变量：

| 变量 | 作用 |
| --- | --- |
| `--bg-base` / `--bg-top` / `--bg-sidebar` / `--bg-panel` | 各级背景 |
| `--bg-item-hover` / `--bg-item-active` / `--bg-input` | 交互背景 |
| `--border` / `--border-strong` | 边框 |
| `--text-primary` / `--text-secondary` / `--text-dim` | 文本层级 |
| `--accent` / `--accent-hover` / `--accent-soft` | 强调色 |
| `--success` / `--warning` / `--danger` | 语义色 |
| `--glow` | 霓虹发光（赛博朋克用） |
| `--radius` / `--radius-lg` | 圆角（卡通用大圆角） |
| `--font-ui` | 字体（赛博朋克用等宽风、卡通用圆润风） |

### 主题定义（`src/utils/theme.ts`）

```ts
export type ThemeId = "Default" | "Cartoon" | "Cyberpunk";
export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  dataAttr: string;   // 对应 html[data-theme]
  swatches: string[]; // 预览色板
}
```

`applyTheme(theme)` 在 `document.documentElement` 上设置 `data-theme` 属性。

### 即时切换

在 `App.tsx` 中监听 `settings.theme`：

```ts
useEffect(() => { applyTheme(theme); }, [theme]);
```

设置界面修改 `settings.theme`（Zustand → 后端持久化）后，Effect 立即触发 `applyTheme()`，
CSS 变量随之切换，**零延迟即时生效**。

### 主题选择 UI（`ThemesSection.tsx`）

设置 → 主题 分区展示两张带缩略预览与色板的选择卡，点击即应用。

## 两种主题视觉

| 主题 | 视觉特征 |
| --- | --- |
| **卡通风格** | 明亮暖色（奶油底 + 珊瑚橙 + 薄荷绿）、大圆角、活泼配色、圆润字体 |
| **赛博朋克风格** | 暗色霓虹（青 + 品红）、发光边框（`--glow`）、科技感字体、霓虹辉光 |
