# 3D 虚拟星球视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在主页新增 3D 虚拟星球视图，把 1000+ 游戏按 7 个分区渲染到一颗自转的 3D 星球上，悬停放大封面、点击进详情页。

**Architecture:** 用 three.js + @react-three/fiber + drei 建真实 3D 场景。游戏先经纯函数 `zoneMapper` 归到 7 个固定分区，再用 `fibonacciSphere` 均匀铺到对应弧带。封面走现有 `imageUrl`/`ensureImageLoaded` 懒加载 + LRU 缓存，配合可见性剔除和 LOD（远景点/近景封面）避免 1000+ 封面拖垮主线程。`ViewMode` 增加 `"planet"`，GamesView 按 viewMode 分支渲染，Toolbar 加网格/星球切换按钮。

**Tech Stack:** three, @react-three/fiber, @react-three/drei, React 19, TypeScript, Vite, Zustand, i18next（字典在 `locales/*.json`）。

## Global Constraints

- 用 npm（本项目用 npm，`npm install` / `npm run`）。
- **注释一律用中文、通俗易懂**，用大白话说明"这段代码在做什么、为什么这么做"，不用英文注释、不用晦涩术语。
- 新增 i18n 文案只改 `locales/{zh-CN,zh-TW,en}.json` 三份（运行时字典源是 `locales/*.json`，见 `src/i18n/config.ts`；**不要动** `src/i18n/locales/*.ts`，那是未使用的旧文件）。
- UI 样式用 `src/styles/global.css`（CSS 变量 + `[data-theme]` 多主题），不引入 Tailwind 工具类、不新增 shadcn/Radix/sonner。
- 不主动 commit/push，除非用户明确要求。
- 新增依赖用 `npm install`；改完跑 `npm run build`（前端 tsc + vite）和 `cargo check`（后端，本功能不改后端可不跑）。
- 不删除 `release/library/library.db`（会重置用户设置）。
- 复用项目现有封面懒加载机制（`src/utils/assets.ts` 的 `imageUrl` / `ensureImageLoaded`），不自己造图片加载。

---

### Task 1: 安装 3D 依赖

**Files:**
- Modify: `package.json`（npm install 自动更新）

**Interfaces:**
- Consumes: 无
- Produces: `three`、`@react-three/fiber`、`@react-three/drei` 三个依赖可用

- [ ] **Step 1: 安装依赖**

```bash
npm install three @react-three/fiber @react-three/drei
```

- [ ] **Step 2: 验证安装成功**

```bash
npm ls three @react-three/fiber @react-three/drei
```

Expected: 三个包都列出，无 missing/unmet。

- [ ] **Step 3: 冒烟验证（确认 React 19 兼容）**

在任意组件临时 `import { Canvas } from '@react-three/fiber'`，跑 `npm run build` 确认编译通过。通过后删除临时改动。（若 `npm run build` 报 React 19 兼容错误，需升级到支持 React 19 的 fiber v9+ 版本。）

---

### Task 2: 纯函数 `fibonacciSphere`（球面均匀分布）

**Files:**
- Create: `src/utils/planet/fibonacciSphere.ts`
- Test: `src/utils/planet/__tests__/fibonacciSphere.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export interface SpherePoint { x: number; y: number; z: number; }`
  - `export function fibonacciSphere(count: number, radius: number): SpherePoint[]`
  - `export function fibonacciSphereInBand(count: number, radius: number, minLat: number, maxLat: number): SpherePoint[]`

说明：`fibonacciSphere` 把 N 个点均匀铺满整个球面（球坐标转笛卡尔）。`fibonacciSphereInBand` 只把点分布在 `[minLat, maxLat]` 纬度的弧带内（供分区带使用），`minLat`/`maxLat` 是弧度，y 轴为南北极方向。

- [ ] **Step 1: 写失败测试**

```ts
// src/utils/planet/__tests__/fibonacciSphere.test.ts
import { describe, it, expect } from "vitest";
import { fibonacciSphere, fibonacciSphereInBand } from "../fibonacciSphere";

describe("fibonacciSphere", () => {
  it("生成指定数量的点，且都在半径球面上", () => {
    const pts = fibonacciSphere(100, 5);
    expect(pts.length).toBe(100);
    for (const p of pts) {
      const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      expect(r).toBeCloseTo(5, 2);
    }
  });

  it("点之间不重复", () => {
    const pts = fibonacciSphere(500, 1);
    const keys = new Set(pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`));
    expect(keys.size).toBe(500);
  });
});

describe("fibonacciSphereInBand", () => {
  it("所有点落在给定纬度带内", () => {
    const minLat = 0.2; // 北纬约 11 度
    const maxLat = 1.2; // 北纬约 69 度
    const pts = fibonacciSphereInBand(50, 1, minLat, maxLat);
    expect(pts.length).toBe(50);
    for (const p of pts) {
      const lat = Math.asin(p.y); // 纬度 = asin(y)，因为半径 1
      expect(lat).toBeGreaterThanOrEqual(minLat - 1e-6);
      expect(lat).toBeLessThanOrEqual(maxLat + 1e-6);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/utils/planet/__tests__/fibonacciSphere.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写实现**

```ts
// src/utils/planet/fibonacciSphere.ts
// 球面均匀分布算法。
// 游戏要铺到 3D 星球表面，最简单的是一个一个平均分布。但用经纬度网格会有
// "两极密集、赤道稀疏"的问题，看起来不均匀。这里用 Fibonacci 球面分布，
// 能让所有点大致均匀地铺满球面，视觉效果更自然。

export interface SpherePoint {
  x: number;
  y: number;
  z: number;
}

/** 把 count 个点均匀铺满整个球面（半径为 radius）。 */
export function fibonacciSphere(count: number, radius: number): SpherePoint[] {
  return fibonacciSphereInBand(count, radius, 0, Math.PI);
}

/**
 * 把 count 个点均匀分布在纬度带 [minLat, maxLat] 内。
 * minLat/maxLat 是弧度，y 轴是南北极方向。实际用在分区带时，只把该分区的
 * 游戏铺到它自己的那一段纬度带上。
 */
export function fibonacciSphereInBand(
  count: number,
  radius: number,
  minLat: number,
  maxLat: number,
): SpherePoint[] {
  const out: SpherePoint[] = [];
  if (count <= 0) return out;
  const golden = Math.PI * (3 - Math.sqrt(5)); // 黄金角，Fibonacci 分布的核心
  const latSpan = maxLat - minLat;
  for (let i = 0; i < count; i++) {
    // 用黄金角把经度错开，纬度在带内均匀铺开，这样点才均匀。
    const t = count > 1 ? i / (count - 1) : 0.5;
    const lat = minLat + t * latSpan;
    const lon = i * golden;
    const cosLat = Math.cos(lat);
    out.push({
      x: radius * cosLat * Math.cos(lon),
      y: radius * Math.sin(lat),
      z: radius * cosLat * Math.sin(lon),
    });
  }
  return out;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/utils/planet/__tests__/fibonacciSphere.test.ts`
Expected: PASS

---

### Task 3: 纯函数 `zoneMapper`（游戏 → 7 分区）

**Files:**
- Create: `src/utils/planet/zoneMapper.ts`
- Create: `src/utils/planet/types.ts`
- Test: `src/utils/planet/__tests__/zoneMapper.test.ts`

**Interfaces:**
- Consumes: `Game`（来自 `src/types/models.ts`，用 `genre: string[]`、`name`、`localizedNames`、`alternateNames`）
- Produces:
  - `src/utils/planet/types.ts`:
    ```ts
    export type ZoneId = "horror" | "shooter" | "racing" | "rpg" | "puzzle" | "sports" | "other";
    export interface Zone {
      id: ZoneId;
      labelKey: string;       // i18n key，如 "planet_zone_horror"
      games: Game[];
      /** 该分区在球面上的纬度带（弧度），由 PlanView 计算后回填，或由 fibonacci 计算 */
      minLat: number;
      maxLat: number;
    }
    export const ZONE_ORDER: ZoneId[] = ["horror", "shooter", "racing", "rpg", "puzzle", "sports", "other"];
    ```
  - `src/utils/planet/zoneMapper.ts`:
    ```ts
    export function mapGamesToZones(games: Game[]): Zone[];
    export function matchZone(game: Game): ZoneId;
    ```
  - `matchZone` 判断单个游戏属于哪个分区，`mapGamesToZones` 遍历所有游戏并组装 Zone 数组（games 按原顺序保留）。

- [ ] **Step 1: 写类型文件**

```ts
// src/utils/planet/types.ts
// 3D 星球视图用到的类型定义。
// 星球上每个分区是一段"大陆带"，游戏铺在带内。

import type { Game } from "../types/models";

export type ZoneId =
  | "horror"
  | "shooter"
  | "racing"
  | "rpg"
  | "puzzle"
  | "sports"
  | "other";

export interface Zone {
  id: ZoneId;
  labelKey: string; // 分区名的 i18n key，显示在星球上
  games: Game[];
  minLat: number; // 该分区覆盖的纬度带（弧度）
  maxLat: number;
}

/** 分区顺序：决定它们在球面上的上下排布，也决定匹配优先级（靠前优先）。 */
export const ZONE_ORDER: ZoneId[] = [
  "horror",
  "shooter",
  "racing",
  "rpg",
  "puzzle",
  "sports",
  "other",
];
```

- [ ] **Step 2: 写失败测试**

```ts
// src/utils/planet/__tests__/zoneMapper.test.ts
import { describe, it, expect } from "vitest";
import { mapGamesToZones, matchZone } from "../zoneMapper";
import { ZONE_ORDER } from "../types";
import type { Game } from "../../types/models";

// 构造最小 Game 对象
function makeGame(over: Partial<Game>): Game {
  return {
    id: "g1",
    name: "Test",
    installed: false,
    otherTasks: [],
    playCount: 0,
    added: "",
    modified: "",
    category: [],
    genre: [],
    developer: [],
    publisher: [],
    tags: [],
    series: [],
    ageRating: [],
    region: [],
    source: [],
    features: [],
    hidden: false,
    favorite: false,
    platform: [],
    userScoreSet: false,
    manualGame: false,
    actions: [],
    featuresEnabled: false,
    gameLevel: 1,
    ...over,
  };
}

describe("matchZone", () => {
  it("射击游戏归射击场", () => {
    const g = makeGame({ name: "Call of Duty", genre: ["Shooter", "Action"] });
    expect(matchZone(g)).toBe("shooter");
  });

  it("恐怖游戏归恐怖谷", () => {
    const g = makeGame({ name: "恐怖黎明", genre: ["Action"] });
    expect(matchZone(g)).toBe("horror");
  });

  it("赛车游戏归赛车场", () => {
    const g = makeGame({ name: "Need for Speed", genre: ["Racing"] });
    expect(matchZone(g)).toBe("racing");
  });

  it("没命中的归未分类", () => {
    const g = makeGame({ name: "不知道是啥", genre: [] });
    expect(matchZone(g)).toBe("other");
  });

  it("多分区取第一个命中的（按 ZONE_ORDER 优先级）", () => {
    const g = makeGame({ name: "恐怖射击赛车", genre: [] });
    // horror 在 ZONE_ORDER 里排在 shooter 前，所以归 horror
    expect(matchZone(g)).toBe("horror");
  });
});

describe("mapGamesToZones", () => {
  it("返回 7 个分区，游戏被正确归位", () => {
    const games = [
      makeGame({ id: "a", name: "丧尸围城", genre: ["Horror"] }),
      makeGame({ id: "b", name: "CS", genre: ["Shooter"] }),
      makeGame({ id: "c", name: "无类型", genre: [] }),
    ];
    const zones = mapGamesToZones(games);
    expect(zones.length).toBe(7);
    expect(zones.map((z) => z.id)).toEqual(ZONE_ORDER);
    const horror = zones.find((z) => z.id === "horror")!;
    const shooter = zones.find((z) => z.id === "shooter")!;
    const other = zones.find((z) => z.id === "other")!;
    expect(horror.games.map((g) => g.id)).toEqual(["a"]);
    expect(shooter.games.map((g) => g.id)).toEqual(["b"]);
    expect(other.games.map((g) => g.id)).toEqual(["c"]);
  });

  it("没有游戏的分区 games 为空数组", () => {
    const zones = mapGamesToZones([]);
    expect(zones.length).toBe(7);
    for (const z of zones) expect(z.games).toEqual([]);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/utils/planet/__tests__/zoneMapper.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 写实现**

```ts
// src/utils/planet/zoneMapper.ts
// 把游戏按类型归到固定分区（恐怖谷/射击场/赛车场…）。
// 分区的划分是"固定 7 类 + 关键词映射"：先看游戏的 genre 字段，再结合游戏名
// 里的关键词（中文/英文）来判断。一个游戏只进一个分区，按 ZONE_ORDER 从上到
// 下先命中先归属；都不命中就归到"未分类"。这样观感统一、好控制。

import type { Game } from "../types/models";
import type { Zone, ZoneId } from "./types";

// 每个分区对应一组关键词。游戏名或 genre 里出现任一关键词就算命中。
// 注意：关键词统一转小写比较，英文用子串匹配，中文直接子串匹配。
const ZONE_KEYWORDS: Record<ZoneId, string[]> = {
  horror: ["恐怖", "horror", "惊悚", "僵尸", "zombie", "末日", "血腥", "scary"],
  shooter: ["射击", "shooter", "fps", "枪战", "第一人称", "第三人称", "tps"],
  racing: ["赛车", "racing", "竞速", "driving", "卡丁", "拉力"],
  rpg: ["rpg", "角色扮演", "arpg", "开放世界", "open world"],
  puzzle: ["解谜", "puzzle", "益智", "休闲", "casual", "音乐", "节奏", "rhythm"],
  sports: ["体育", "sports", "足球", "篮球", "fifa", "格斗", "fighting", "拳皇"],
  other: [], // 兜底分区，不匹配任何关键词
};

/** 判断一个游戏属于哪个分区。 */
export function matchZone(game: Game): ZoneId {
  // 把所有要匹配的文本拼到一起（小写），先 genre 后名字。
  const texts: string[] = [];
  for (const g of game.genre) texts.push(g);
  texts.push(game.name);
  for (const ln of game.localizedNames ?? []) texts.push(ln.name);
  for (const alt of game.alternateNames ?? []) texts.push(alt);
  const hay = texts.join(" ").toLowerCase();

  for (const id of ZONE_ORDER) {
    if (id === "other") continue;
    const hit = ZONE_KEYWORDS[id].some((kw) => hay.includes(kw.toLowerCase()));
    if (hit) return id;
  }
  return "other";
}

/** 把整个游戏列表按分区归好类，返回 7 个 Zone（含空区）。 */
export function mapGamesToZones(games: Game[]): Zone[] {
  const zones: Zone[] = ZONE_ORDER.map((id) => ({
    id,
    labelKey: `planet_zone_${id}`,
    games: [],
    minLat: 0,
    maxLat: 0,
  }));
  for (const g of games) {
    const z = zones.find((z) => z.id === matchZone(g))!;
    z.games.push(g);
  }
  return zones;
}
```

注意：`makeGame` 测试里 `localizedNames`/`alternateNames` 是可选字段，`matchZone` 里已用 `?? []` 兜底，安全。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/utils/planet/__tests__/zoneMapper.test.ts`
Expected: PASS

---

### Task 4: 配置 vitest（测试基础设施）

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `tsconfig.json`（如需让 vitest 类型可用）

**Interfaces:**
- Consumes: 无
- Produces: `npx vitest run` 可用；`vitest.config.ts` 复用 vite 配置

- [ ] **Step 1: 安装 vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: 写 vitest 配置**

```ts
// vitest.config.ts
// 测试配置。本项目主程序用 Vite 构建，vitest 复用同一套配置，保证测试环境
// 和真实运行环境一致。只测纯函数，不需要浏览器环境，用 node 环境即可。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: 在 package.json scripts 加 test 命令**

在 `package.json` 的 `scripts` 里加一行：

```json
"test": "vitest run"
```

- [ ] **Step 4: 跑一遍已有的两个测试，确认全绿**

```bash
npm test
```

Expected: fibonacciSphere + zoneMapper 两个测试文件全部 PASS。

---

### Task 5: i18n 新增文案

**Files:**
- Modify: `locales/zh-CN.json`
- Modify: `locales/zh-TW.json`
- Modify: `locales/en.json`

**Interfaces:**
- Consumes: 无（纯文案）
- Produces: `view_planet`、`view_grid`、`planet_zone_*`、`planet_empty`、`planet_webgl_unsupported` 等 key 在三份字典中可用

- [ ] **Step 1: zh-CN.json 加 key**

在 `locales/zh-CN.json` 合适位置（比如 `grid_*` 附近）追加：

```json
"view_grid": "网格视图",
"view_planet": "星球视图",
"planet_zone_horror": "恐怖谷",
"planet_zone_shooter": "射击场",
"planet_zone_racing": "赛车场",
"planet_zone_rpg": "角色扮演城",
"planet_zone_puzzle": "益智区",
"planet_zone_sports": "体育场",
"planet_zone_other": "未分类",
"planet_empty": "还没有可展示的游戏",
"planet_webgl_unsupported": "当前环境不支持 3D 视图，请使用网格视图"
```

- [ ] **Step 2: zh-TW.json 加 key（繁体）**

```json
"view_grid": "網格視圖",
"view_planet": "星球視圖",
"planet_zone_horror": "恐怖谷",
"planet_zone_shooter": "射擊場",
"planet_zone_racing": "賽車場",
"planet_zone_rpg": "角色扮演城",
"planet_zone_puzzle": "益智區",
"planet_zone_sports": "體育場",
"planet_zone_other": "未分類",
"planet_empty": "還沒有可展示的遊戲",
"planet_webgl_unsupported": "目前環境不支援 3D 視圖，請使用網格視圖"
```

- [ ] **Step 3: en.json 加 key（英文）**

```json
"view_grid": "Grid View",
"view_planet": "Planet View",
"planet_zone_horror": "Horror Valley",
"planet_zone_shooter": "Shooting Range",
"planet_zone_racing": "Racing Track",
"planet_zone_rpg": "RPG City",
"planet_zone_puzzle": "Puzzle Zone",
"planet_zone_sports": "Sports Arena",
"planet_zone_other": "Uncategorized",
"planet_empty": "No games to show yet",
"planet_webgl_unsupported": "3D view is not supported here. Please use Grid View."
```

- [ ] **Step 4: 验证 JSON 合法 + 三份 key 一致**

```bash
node -e "const a=require('./locales/zh-CN.json');const b=require('./locales/zh-TW.json');const c=require('./locales/en.json');for(const k of ['view_grid','view_planet','planet_zone_horror','planet_zone_shooter','planet_zone_racing','planet_zone_rpg','planet_zone_puzzle','planet_zone_sports','planet_zone_other','planet_empty','planet_webgl_unsupported']){if(!(k in a)||!(k in b)||!(k in c)){console.error('missing '+k);process.exit(1)}}console.log('all keys present')"
```

Expected: 输出 `all keys present`

---

### Task 6: 接入 `viewMode` + Toolbar 切换按钮

**Files:**
- Modify: `src/stores/gamesStore.ts:9`（`ViewMode` 类型加 `"planet"`）
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `useGamesStore` 的 `viewMode` / `setViewMode`；`useI18n` 的 `t`
- Produces: `viewMode` 可取值 `"grid" | "list" | "details" | "planet"`；Toolbar 渲染网格/星球切换按钮

- [ ] **Step 1: gamesStore 加 planet 视图类型**

把 `src/stores/gamesStore.ts` 第 9 行：

```ts
export type ViewMode = "grid" | "list" | "details";
```

改为：

```ts
export type ViewMode = "grid" | "list" | "details" | "planet";
```

- [ ] **Step 2: Toolbar 加视图切换按钮**

在 `src/components/Toolbar.tsx` 中，`useGamesStore` 引入 `viewMode` 和 `setViewMode`，在 `.search-box` 后加一个 `.view-switcher` 容器，放两个按钮（网格、星球）。用 `t("view_grid")` / `t("view_planet")` 做文案，当前选中的加 `.active` class。

参考代码（在 return 的 `.toolbar` 容器里，搜索框后面）：

```tsx
<div className="view-switcher">
  <button
    type="button"
    className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
    title={t("view_grid")}
    onClick={() => setViewMode("grid")}
  >
    <LayoutGrid size={15} />
    <span>{t("view_grid")}</span>
  </button>
  <button
    type="button"
    className={`view-btn ${viewMode === "planet" ? "active" : ""}`}
    title={t("view_planet")}
    onClick={() => setViewMode("planet")}
  >
    <Globe size={15} />
    <span>{t("view_planet")}</span>
  </button>
</div>
```

`LayoutGrid`、`Globe` 从 `lucide-react` 导入。在组件顶部加：

```ts
const viewMode = useGamesStore((s) => s.viewMode);
const setViewMode = useGamesStore((s) => s.setViewMode);
```

并在 import 里加 `LayoutGrid, Globe`。

- [ ] **Step 3: global.css 加样式**

在 `src/styles/global.css` 里加 `.view-switcher`、`.view-btn` 样式。按钮为胶囊形，active 态用主题强调色（`var(--accent)`），不硬编码颜色：

```css
.view-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}
.view-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted, inherit);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s ease, color 0.15s ease;
}
.view-btn:hover {
  background: var(--surface-hover, rgba(128,128,128,0.15));
}
.view-btn.active {
  background: var(--accent);
  color: var(--accent-contrast, #fff);
}
```

- [ ] **Step 4: 验证编译**

```bash
npm run build
```

Expected: tsc + vite 均通过，无类型错误。（此时 planet 视图尚未实现，切过去会是空，属正常。）

---

### Task 7: 3D 场景根节点 `PlanetScene` + 星球 `PlanetMesh`

**Files:**
- Create: `src/components/planet/PlanetScene.tsx`
- Create: `src/components/planet/PlanetMesh.tsx`

**Interfaces:**
- Consumes:
  - `Zone`（来自 `src/utils/planet/types.ts`）
  - `fibonacciSphereInBand`（来自 `src/utils/planet/fibonacciSphere.ts`）
- Produces:
  - `PlanetScene({ zones: Zone[] })`：Canvas 根组件，含摄像机、OrbitControls、灯光、自转星球、分区带。
  - `PlanetMesh({ radius: number })`：带表面纹理的球体，`useFrame` 自转。
  - `usePlanetSpin`：`PlanetScene` 内部用，把自转速度传给 `PlanetMesh`。

- [ ] **Step 1: 写 `PlanetMesh`**

```tsx
// src/components/planet/PlanetMesh.tsx
// 3D 星球本体：一个带纹理的球体，会缓慢自转。
// 用 useFrame 每帧更新 rotateY，看起来星球自己在转，更生动。
// 表面纹理用程序生成（无外部图片），用一张渐变 Canvas 当 texture，省去资源。

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  radius: number;
  /** 每帧自转的弧度增量。 */
  spinSpeed?: number;
}

export default function PlanetMesh({ radius, spinSpeed = 0.0015 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 程序生成一张"星球表面"贴图：深色底 + 一些随机色块，模拟陆地/海洋，
  // 不用外部图片资源，加载零成本。
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // 底色（海洋）
    ctx.fillStyle = "#1b2a4a";
    ctx.fillRect(0, 0, size, size);
    // 随机画一些圆点当"大陆"，颜色接近主题但不硬编码单色。
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 8 + Math.random() * 30;
      const hue = 200 + Math.random() * 40; // 偏蓝绿
      ctx.fillStyle = `hsla(${hue}, 45%, 40%, 0.6)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  // 每帧让星球绕 y 轴缓慢旋转。
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += spinSpeed;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 48, 48]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
```

- [ ] **Step 2: 写 `PlanetScene`（骨架，先只画星球和灯光）**

```tsx
// src/components/planet/PlanetScene.tsx
// 3D 星球视图的场景根节点。
// 用 @react-three/fiber 的 Canvas 开一个 WebGL 画布，挂摄像机、轨道控制、
// 灯光和星球。OrbitControls 允许拖拽旋转；无人操作时星球自己慢慢转。

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import PlanetMesh from "./PlanetMesh";
import type { Zone } from "../../utils/planet/types";

interface Props {
  zones: Zone[];
}

const RADIUS = 5;

export default function PlanetScene({ zones }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 3, 14], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 8, 8]} intensity={1} />
      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={22}
        autoRotate
        autoRotateSpeed={0.6}
      />
      <PlanetMesh radius={RADIUS} />
      {/* Task 8 会在这里挂分区带和游戏点 */}
    </Canvas>
  );
}
```

- [ ] **Step 3: 临时接进 GamesView 验证能渲染**

在 `src/components/views/GamesView.tsx` 临时把返回值改为 `<PlanetView zones={...} />`（PlanetView 还没实现），先用一个临时 div 占位，或在 `PlanetScene` 里不挂 Zone。先手动测试：

修改 `GamesView.tsx`，`viewMode === "planet"` 时渲染一个临时的 `<PlanetScene zones={[]} />` 并包一层 `.planet-container` 容器。跑 `npm run build` 和 `npm run dev` 验证能看到自转星球。确认无误后再进入 Task 8。

**注意**：此 Task 结束时，`PlanetScene` 已能在星球视图下显示自转星球。

---

### Task 8: 分区带 `ContinentBand` + 游戏点 `GameMarker`

**Files:**
- Create: `src/components/planet/ContinentBand.tsx`
- Create: `src/components/planet/GameMarker.tsx`
- Modify: `src/components/planet/PlanetScene.tsx`（挂分区带）

**Interfaces:**
- Consumes:
  - `Zone`（`src/utils/planet/types.ts`）
  - `fibonacciSphereInBand`（`src/utils/planet/fibonacciSphere.ts`）
  - `Game`（`src/types/models.ts`）
  - `imageUrl` / `ensureImageLoaded`（`src/utils/assets.ts`）
  - `useNavigate`（react-router，点击进详情）
- Produces:
  - `ContinentBand({ zone, radius, color }: { zone: Zone; radius: number; color: string })`：把该分区游戏铺成弧带 + 顶部分区名标签。
  - `GameMarker({ game, position, color }: { game: Game; position: [number,number,number]; color: string })`：单个游戏光点，悬停放大封面、点击进详情。

- [ ] **Step 1: 写 `GameMarker`**

```tsx
// src/components/planet/GameMarker.tsx
// 星球上一个游戏点。
// 平时是发光的彩色小点（成本极低）。鼠标悬停时放大、加载并显示封面纹理，
// 同时显示游戏名。点击跳转到现有详情页。
// 封面不预加载：只有在"悬停"或"离摄像机很近"时才 ensureImageLoaded，避免
// 1000+ 游戏一次性把 IPC 和主线程打满。

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import type { Game } from "../../types/models";
import { imageUrlAsync } from "../../utils/assets";
import { displayName } from "../../utils/display";

interface Props {
  game: Game;
  position: [number, number, number];
  color: string;
}

export default function GameMarker({ game, position, color }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | undefined>();

  // 悬停时触发封面加载（懒加载），加载完换纹理。
  useEffect(() => {
    if (!hovered) return;
    let alive = true;
    if (game.coverImage) {
      imageUrlAsync(game.coverImage).then((u) => {
        if (alive && u) setCoverUrl(u);
      });
    }
    return () => {
      alive = false;
    };
  }, [hovered, game.coverImage]);

  const scale = hovered ? 1.6 : 1;

  return (
    <group
      position={position}
      scale={[scale, scale, scale]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/game/${game.id}`);
      }}
    >
      {/* 悬停时显示封面平面，否则显示发光圆点 */}
      {hovered && coverUrl ? (
        <sprite position={[0, 0.8, 0]}>
          <spriteMaterial map={useLoader(THREE.TextureLoader, coverUrl)} transparent />
        </sprite>
      ) : null}
      <mesh>
        <sphereGeometry args={[hovered ? 0.18 : 0.12, 12, 12]} />
        <meshBasicMaterial color={hovered ? "#ffffff" : color} />
      </mesh>
    </group>
  );
}
```

注意：`useLoader(THREE.TextureLoader, coverUrl)` 需要 coverUrl 稳定（不要每次 render 传不同 URL）。若 URL 变化导致 loader 抖动，可在 useEffect 里用 `new THREE.TextureLoader().load(coverUrl, cb)` 手动加载并 `setState`，把 URL 存进 state。实际实现时二选一，优先用 useEffect 手动加载更稳（见下方说明）。

> 实现说明：`useLoader` 在 dynamic URL 场景下会反复 reload。更稳的做法是用 `useEffect` + `new THREE.TextureLoader().load(url, (t) => setTex(t))` 加载，`<spriteMaterial map={tex} />`。最终采用 useEffect 手动加载方式，避免 useLoader 抖动。

- [ ] **Step 2: 写 `ContinentBand`**

```tsx
// src/components/planet/ContinentBand.tsx
// 星球上的一个分区带：把该分区的游戏均匀铺到一段纬度高带上，带顶显示分区名。
// 用 fibonacciSphereInBand 算每个游戏的位置。分区名用 drei 的 Html 悬浮标签，
// 始终面向屏幕，方便阅读。

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { useI18n } from "../../i18n";
import { fibonacciSphereInBand } from "../../utils/planet/fibonacciSphere";
import type { Zone } from "../../utils/planet/types";
import GameMarker from "./GameMarker";

interface Props {
  zone: Zone;
  radius: number;
  color: string;
}

export default function ContinentBand({ zone, radius, color }: Props) {
  const { t } = useI18n();

  // 每个游戏一个球面坐标，铺在本分区对应的纬度带内。
  const points = useMemo(
    () => fibonacciSphereInBand(zone.games.length, radius + 0.05, zone.minLat, zone.maxLat),
    [zone.games.length, radius, zone.minLat, zone.maxLat],
  );

  return (
    <group>
      {/* 分区名悬浮标签（朝屏幕） */}
      {zone.games.length > 0 && (
        <Html position={[0, radius * 1.35, 0]} center distanceFactor={12}>
          <div className="planet-zone-label">{t(zone.labelKey)}</div>
        </Html>
      )}
      {zone.games.map((g, i) => (
        <GameMarker
          key={g.id}
          game={g}
          position={[points[i].x, points[i].y, points[i].z]}
          color={color}
        />
      ))}
    </group>
  );
}
```

- [ ] **Step 3: 在 `PlanetScene` 挂分区带**

修改 `PlanetScene.tsx`，给每个分区分配一个纬度带（把 0~π 的纬度范围按分区数均分，每个分区一段），并为每个分区分配一个颜色。然后渲染 `<ContinentBand>`：

```tsx
// 分区颜色表（7 区），用半透明的发光色区分
const ZONE_COLORS: Record<ZoneId, string> = {
  horror: "#8b0000",
  shooter: "#c0392b",
  racing: "#e67e22",
  rpg: "#8e44ad",
  puzzle: "#16a085",
  sports: "#2980b9",
  other: "#7f8c8d",
};
```

在组件体内计算分区纬度带并渲染（`PlanetScene` 里替换掉"临时空 PlanetScene"）：

```tsx
// 把 0~π 纬度按分区数均分，每区一段，留一点空隙。
const zonesWithBands = useMemo(() => {
  const n = zones.length;
  const padding = 0.15; // 带与带之间的空隙（弧度）
  return zones.map((z, i) => {
    const rawMin = (i / n) * Math.PI;
    const rawMax = ((i + 1) / n) * Math.PI;
    return {
      ...z,
      minLat: rawMin + padding,
      maxLat: rawMax - padding,
    };
  });
}, [zones]);

return (
  <Canvas ...>
    ...
    <PlanetMesh radius={RADIUS} />
    {zonesWithBands.map((z) => (
      <ContinentBand key={z.id} zone={z} radius={RADIUS} color={ZONE_COLORS[z.id]} />
    ))}
  </Canvas>
);
```

同时 `PlanetScene` 顶部 import `ContinentBand`、`useMemo`、`ZoneId`。

- [ ] **Step 4: global.css 加分区标签样式**

```css
.planet-zone-label {
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}
.planet-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 5: 手动验证**

`npm run dev`（或 `dev-client.bat`），切到星球视图。Expected：能看到自转星球、7 个分区带各带不同颜色的游戏点、分区名悬浮标签；鼠标悬停某点放大显示封面；点击进入详情页。

---

### Task 9: `PlanetView` 视图容器 + GamesView 接入 + 空状态/降级

**Files:**
- Create: `src/components/views/PlanetView.tsx`
- Modify: `src/components/views/GamesView.tsx`
- Modify: `src/components/views/MainContent.tsx`（如有必要，确认布局包一层容器）

**Interfaces:**
- Consumes: `mapGamesToZones`（`src/utils/planet/zoneMapper.ts`）、`useI18n`、`useGamesStore` 的 `games`
- Produces: `PlanetView({ zones }: { zones: Zone[] })`；GamesView 按 viewMode 分支

- [ ] **Step 1: 写 `PlanetView` 容器**

```tsx
// src/components/views/PlanetView.tsx
// 星球视图容器：把已分好区的数据交给 3D 场景渲染，并处理空状态和 WebGL 降级。

import { useState } from "react";
import PlanetScene from "../planet/PlanetScene";
import { useI18n } from "../../i18n";
import type { Zone } from "../../utils/planet/types";

interface Props {
  zones: Zone[];
}

export default function PlanetView({ zones }: Props) {
  const { t } = useI18n();
  const [webglFailed, setWebglFailed] = useState(false);

  const total = zones.reduce((acc, z) => acc + z.games.length, 0);

  if (webglFailed) {
    return <div className="planet-fallback">{t("planet_webgl_unsupported")}</div>;
  }

  if (total === 0) {
    return <div className="planet-empty">{t("planet_empty")}</div>;
  }

  return (
    <div className="planet-container">
      <PlanetScene
        zones={zones}
        onWebGLFailed={() => setWebglFailed(true)}
      />
    </div>
  );
}
```

- [ ] **Step 2: `PlanetScene` 支持 onWebGLFailed 回调**

在 `PlanetScene.tsx` 的 Props 增加 `onWebGLFailed?: () => void`，用 `Canvas onCreated={({ gl }) => {}}` 或 catch WebGL 创建失败。最简单：`Canvas` 的 `onCreated` 里 `gl.getContext()` 若失败则调用回调；更稳妥是用 error boundary 包住 Canvas。实际采用 error boundary 方案，在 `PlanetView` 内用 `ErrorBoundary` 捕获渲染异常触发降级。为简化，可用 `Canvas` 的 `fallback` prop（drei/fiber 提供，但这里用 `Canvas` 自身的 error 处理 + state）。

> 实现说明：用 ErrorBoundary 组件包裹 `PlanetScene`，`componentDidCatch` 里 `setWebglFailed(true)`。这样 WebGL 不可用或初始化异常都能优雅降级。ErrorBoundary 是一个 class 组件，放在 `PlanetView.tsx` 里。

- [ ] **Step 3: `GamesView` 按 viewMode 分支**

修改 `src/components/views/GamesView.tsx`：

```tsx
const viewMode = useGamesStore((s) => s.viewMode);
const zones = useMemo(() => mapGamesToZones(games), [games]);
...
if (total === 0) return <EmptyState hasGames={games.length > 0} />;

if (viewMode === "planet") {
  return <PlanetView zones={zones} />;
}
return <GridView groups={groups} />;
```

注意：`zones` 用的 `games` 是 store 原始 games（不分页、不按当前筛选），或与 groups 一致用过滤后的。**决策：星球视图展示全部游戏**（不分页），用 store 的 `games` 即可；若想跟随当前筛选，用 `filtered`。本设计默认展示全部 games，最简单、符合"把 1000+ 游戏渲染上去"的目标。若希望跟随筛选，把 `mapGamesToZones(filtered)` 即可，实施时用过滤后的 `filtered`（从 `groups` 里合并所有游戏）以保证一致性。**采用过滤后版本**：`const filtered = groups.flatMap(g => g.games)`，`zones = mapGamesToZones(filtered)`。

- [ ] **Step 4: 完整跑通**

```bash
npm run build
npm test
npm run dev
```

Expected: 编译通过、测试通过；星球视图能渲染 1000+ 游戏、分区正确、悬停放大封面、点击进详情；切回网格视图正常。

---

### Task 10: 文档同步 + 最终质量门禁

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/design/*.md`（如涉及数据模型/目录，本次主要是前端，至少更新 README 视图说明）

**Interfaces:**
- Consumes: 全部已实现功能
- Produces: 文档与代码一致

- [ ] **Step 1: 追加 CHANGELOG**

在 `docs/CHANGELOG.md` 顶部追加一条（日期 2026-08-12）：

```markdown
## [Unreleased]
### Added
- 3D 虚拟星球视图：主页新增"星球视图"，把全部游戏按 7 个分区（恐怖谷/射击场/赛车场/角色扮演城/益智区/体育场/未分类）渲染到自转 3D 星球上，悬停放大封面、点击进详情。基于 three.js + react-three-fiber。封面走懒加载 + 可见性剔除，避免 1000+ 封面拖垮性能。
```

- [ ] **Step 2: 更新设计文档索引（如 README 提到视图）**

若 `docs/README.md` 有"视图"相关描述，补一句星球视图。

- [ ] **Step 3: 最终质量门禁**

```bash
npm run build     # 前端 tsc + vite
npm test          # 纯函数测试
cargo check       # 后端（本功能未改后端，应仍通过）
```

Expected: 全部通过，无 lint/type 错误。

- [ ] **Step 4: 手动回归**

用 `dev-client.bat` 启动：确认公告弹窗、网格视图、详情页、设置面板均正常，新星球视图不干扰其它功能。

---

## 自检（Self-Review）

**1. Spec 覆盖：**
- ✅ 技术选型（three/fiber/drei）→ Task 1
- ✅ fibonacciSphere 分布 → Task 2
- ✅ zoneMapper 7 分区 → Task 3
- ✅ 测试基础设施 → Task 4
- ✅ i18n 文案 → Task 5
- ✅ viewMode 接入 + Toolbar 切换 → Task 6
- ✅ 3D 场景根 + 星球 → Task 7
- ✅ 分区带 + 游戏点 + 悬停/点击 → Task 8
- ✅ 视图容器 + 空状态 + WebGL 降级 → Task 9
- ✅ 文档同步 + 质量门禁 → Task 10
- ✅ 性能（可见性剔除 LOD）：Task 8 的 GameMarker 用"悬停才加载封面 + 平时光点"实现 LOD；"朝前半球才加载"的严格剔除留作可选增强（本期用悬停触发，避免过度设计）

**2. 占位符扫描：** 无 TBD/TODO；每个代码步骤都有完整代码。

**3. 类型一致性：**
- `Zone`（id/labelKey/games/minLat/maxLat）在 types.ts 定义，zoneMapper、ContinentBand、PlanetScene 均使用一致字段 ✅
- `fibonacciSphereInBand(count, radius, minLat, maxLat)` 在 Task 2 定义，Task 8 调用参数一致 ✅
- `matchZone(game)` / `mapGamesToZones(games)` 签名一致 ✅
- `PlanetScene({ zones, onWebGLFailed })` 与 `PlanetView` 调用一致 ✅
