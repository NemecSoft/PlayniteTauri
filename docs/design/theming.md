# 主题系统（多主题即时切换）

## 目标

支持多套界面风格主题，**切换即时应用**，并持久化。主题 = **配色（palette）× 风格（style）** 双轴组合：
- **配色**：6 个精选方案（明亮 / 暗黑 / 中国红 / 中国蓝 / 中国绿 / 中国水墨），见 `themeLibrary.ts`
- **风格**：7 个精选签名风格（`styleLibrary.ts`），全部带有**专属视觉特效**（`data-fx`）

风格与配色自由组合，点击即注入 CSS 变量到 `:root`，零延迟生效。

## 实现方案

### CSS 变量驱动（`src/styles/global.css`）

所有界面颜色、圆角、字体、发光效果均通过 CSS 变量定义。默认（深色）主题作为 `:root` 基底，
各主题通过 `html[data-theme]` 属性选择器覆盖同一组变量：

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
export type ThemeId =
  | "Default" | "Cartoon" | "Cyberpunk"
  | "Memphis" | "Neumorphism" | "Comic" | "Ghibli" | "Chinese";

export interface ThemeDefinition {
  id: ThemeId;
  labelKey: string;   // i18n key（主题名）
  descKey: string;    // i18n key（主题描述）
  dataAttr: string;   // 对应 html[data-theme]
  swatches: string[]; // 预览色板
  previewAccent: string; // 选择卡预览条颜色
  previewBg: string;     // 选择卡预览背景
  glow?: boolean;        // 预览是否发光（赛博朋克）
}
```

`applyTheme(theme)` 在 `document.documentElement` 上设置 `data-theme` 属性。
新增主题只需在 `THEMES` 数组中添加一项 + `global.css` 中对应 `html[data-theme]` 变量块，
`ThemesSection` 选择 UI 完全由数组驱动（`labelKey`/`descKey` 翻译，不再硬编码主题名）。

### 即时切换

在 `App.tsx` 中监听 `settings.theme`：

```ts
useEffect(() => { applyTheme(theme); }, [theme]);
```

设置界面修改 `settings.theme`（Zustand → 后端持久化）后，Effect 立即触发 `applyTheme()`，
CSS 变量随之切换，**零延迟即时生效**。

### 主题选择 UI（`ThemesSection.tsx`）

设置 → 主题 分区展示多张带缩略预览与色板的选择卡，点击即应用。预览条/底色/是否发光均由
`ThemeDefinition` 配置，选择卡完全数据驱动。

## 各主题视觉

| 主题 | 视觉特征 |
| --- | --- |
| **卡通风格** | 明亮暖色（奶油底 + 珊瑚橙 + 薄荷绿）、大圆角、活泼配色、圆润字体 |
| **赛博朋克风格** | 暗色霓虹（青 + 品红）、发光边框（`--glow`）、科技感字体、霓虹辉光 |
| **孟菲斯风格** | 大胆几何原色（玫红/金黄/薄荷/宝蓝）、大圆角、内容区圆点底纹 |
| **新拟态风格** | 柔和浅灰、内嵌/外凸投影（`8px 8px 16px` 双层阴影）、超大圆角、无边框靠投影 |
| **美国漫画风格** | 米白底 + 粗黑描边、硬阴影（`4px 4px 0`）、Impact 感组标题、波普高饱和 |
| **吉卜力风格** | 柔和粉彩（草绿/暖黄/天蓝）、自然色调、圆润柔和、手绘温暖质感 |
| **中国风** | 纸色底 + 墨色朱红/鎏金、楷体字栈、细腻纸墨肌理、克制雅致 |

---

## 精选配色（`themeLibrary.ts`，6 个）

配色库精简为 6 个手工设计的签名方案（替代原先 96 个行业场景 palette）。每个方案提供
完整的 shadcn token + 旧业务变量（`--bg-base`/`--text-primary`/`--accent` 等），因此
新旧组件都跟随所选配色。

| 配色 | id | 特征 |
| --- | --- | --- |
| 明亮 | `p-light` | 浅灰蓝底、高对比深字、清爽蓝 accent |
| 暗黑 | `p-dark` | OLED 深底、霓虹紫 accent（默认） |
| 中国红 | `p-cn-red` | 宣纸米底 + 国旗红 accent + 鎏金点缀 |
| 中国蓝 | `p-cn-blue` | 深靛蓝底 + 国潮蓝 accent |
| 中国绿 | `p-cn-green` | 浅草绿底 + 翡翠绿 accent |
| 中国水墨 | `p-cn-ink` | 灰白渐变 + 墨黑 accent，留白雅致 |

> `themeLibrary.ts` 已改手工维护；`scripts/gen-themes.py` 被守卫，检测到精选库即拒绝覆盖。

## 签名风格专属特效（`data-fx`）

`styleLibrary.ts` 精简为 7 个精选签名风格。`StyleVars` 的可选 `fx` 字段运行时由
`applyStyleVars()` 写入 `:root[data-fx]`，`globals.css` 用 `:root[data-fx="..."]` 选择器提供
强辨识度视觉特效，叠加在通用的 radius/shadow/glass 变量之上：

| 风格 | fx | 专属特效 |
| --- | --- | --- |
| 苹果 apple | `apple` | 毛玻璃面板 + 大圆角 + 高光描边 |
| 软浮雕 neumorphism | `soft` | 凹凸双层投影 + 近背景同色卡片 |
| 毛玻璃 glassmorphism | `glass` | 半透明面板 + backdrop-blur + 高光边 |
| 粗野硬朗 brutalism | `brutal` | 粗黑边框 + 硬投影 + 全直角 |
| 赛博朋克 / 科幻 HUD cyberpunk | `cyber` | 霓虹发光 + 扫描线网格 + 高饱和暗底 |
| 像素风 pixel art | `pixel` | 锯齿像素边框 + 硬阴影 + 像素字体 |
| 复古未来 / 蒸汽波 retro/vapor | `retro` | 霓虹渐变文字 + 品红-青暗底 |

> 说明：`globals.css` 中仍保留 `hud` 与 `glass`/`soft` 等额外 `data-fx` 规则，供未来恢复或
> 复用；当前风格库仅激活上表 7 个 `fx`。

`gen-styles.py` 已加守卫，检测到 7 个精选风格即拒绝覆盖，避免误重建 67 个风格。
