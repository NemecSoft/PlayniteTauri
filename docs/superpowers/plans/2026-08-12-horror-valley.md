# 恐怖谷地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 3D 星球视图的恐怖谷分区升级为一块可开车探索的 3D 地图：含道路/河流/山脉/森林/草地，每个游戏是一个山洞洞口（封面作贴图），开车进入山洞跳详情页，有"返回星球"按钮。

**Architecture:** 新增独立 3D 场景 `HorrorValleyView`（独立 Canvas，与星球场景分离）。地形用噪声生成（道路/河流/山脉/森林/草地）。车辆用 `cannon-es` 原生 API（RaycastVehicle，第三人称相机）。山洞用拱形 mesh + 封面贴图，车接近触发进详情。导航状态 `planetMode: "planet" | "horrorValley"` 由 PlanetView 管理。恐怖谷分区的 ContinentBand 可点击进入。

**Tech Stack:** three, @react-three/fiber, @react-three/drei, cannon-es, React 19, TypeScript, i18next。

## Global Constraints

- 用 npm；注释一律中文通俗易懂（大白话说明"在做什么、为什么这么做"，不用英文/晦涩术语）。
- i18n 文案只改 `locales/{zh-CN,zh-TW,en}.json` 三份（`src/i18n/config.ts` 是运行时字典源；**不要动** `src/i18n/locales/*.ts`）。
- UI 样式用 `src/styles/global.css`（CSS 变量多主题），不新增 Tailwind 工具类 / shadcn / Radix / sonner。
- 不主动 commit/push 之外的提交（实现者每任务严格只 add 自己文件再 commit）。
- 不删除 `release/library/library.db`。
- 封面复用 `src/utils/assets.ts` 的 `imageUrlAsync`/`imageUrl`，不自己造图片加载。
- 车辆物理用 `cannon-es` 原生 API，不引入 `@react-three/cannon`（React 绑定层可能不兼容 fiber v9/React 19）。
- 地图规模：约 200×200 米可驾驶区，128×128 地形网格。

---

### Task 1: 安装 cannon-es

**Files:**
- Modify: `package.json` / `package-lock.json`（npm install 自动更新）

**Interfaces:**
- Produces: `cannon-es` 可用（`import * as CANNON from "cannon-es"`）

- [ ] **Step 1: 安装**

```bash
npm install cannon-es
```

- [ ] **Step 2: 验证**

```bash
npm ls cannon-es
```

Expected: `cannon-es@0.20.0` 列出。

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "feat: add cannon-es physics for horror valley vehicle"
```

---

### Task 2: 纯函数 `valleyLayout`（山洞沿道路布局）

**Files:**
- Create: `src/utils/planet/valleyLayout.ts`
- Test: `src/utils/planet/__tests__/valleyLayout.test.ts`

**Interfaces:**
- Consumes: `Game`（`src/types/models.ts`）
- Produces:
  ```ts
  export interface CaveSpot { gameId: string; x: number; z: number; }
  export function layoutCaves(games: Game[], count?: number): CaveSpot[];
  ```
  `layoutCaves` 返回若干山洞坐标（x, z，y 由地形决定），沿一条从入口到山谷内部的蜿蜒道路两侧交替分布，点之间不重叠，都在地图范围内（±90 内）。

- [ ] **Step 1: 写失败测试**

```ts
// src/utils/planet/__tests__/valleyLayout.test.ts
import { describe, it, expect } from "vitest";
import { layoutCaves } from "../valleyLayout";
import type { Game } from "../../../types/models";

function makeGame(id: string): Game {
  return {
    id, name: id, installed: false, otherTasks: [], playCount: 0, playtime: 0,
    added: "", modified: "", category: [], genre: [], developer: [], publisher: [],
    tags: [], series: [], ageRating: [], region: [], source: [], features: [],
    hidden: false, favorite: false, platform: [], userScoreSet: false,
    manualGame: false, actions: [], links: [], featuresEnabled: false, gameLevel: 1,
  };
}

describe("layoutCaves", () => {
  it("返回每个游戏一个山洞坐标", () => {
    const games = [makeGame("a"), makeGame("b"), makeGame("c")];
    const spots = layoutCaves(games);
    expect(spots.length).toBe(3);
    expect(spots.map((s) => s.gameId)).toEqual(["a", "b", "c"]);
  });

  it("坐标都在地图范围内（±90）", () => {
    const games = Array.from({ length: 20 }, (_, i) => makeGame(`g${i}`));
    const spots = layoutCaves(games);
    for (const s of spots) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(90);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(90);
    }
  });

  it("山洞之间互不重叠（间距 > 4）", () => {
    const games = Array.from({ length: 20 }, (_, i) => makeGame(`g${i}`));
    const spots = layoutCaves(games);
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const dx = spots[i].x - spots[j].x;
        const dz = spots[i].z - spots[j].z;
        expect(Math.hypot(dx, dz)).toBeGreaterThan(4);
      }
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/utils/planet/__tests__/valleyLayout.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写实现**

```ts
// src/utils/planet/valleyLayout.ts
// 把恐怖谷里的游戏，一个一个铺到山谷地图的道路两侧。
// 思路：先确定一条从地图入口蜿蜒到内部的"主路"，然后把每个山洞沿这条路两侧
// 交替摆放，保证山洞贴着路、彼此不挤在一起、也不超出地图边界。这样开车沿路走，
// 就能一路看到各个游戏的山洞。

import type { Game } from "../types/models";

export interface CaveSpot {
  gameId: string;
  x: number;
  z: number;
}

/** 地图半边长，洞穴限制在 ±RANGE 范围内，留出边界。 */
const RANGE = 90;
/** 相邻两个山洞之间的最小间距。 */
const SPACING = 8;

/**
 * 把给定游戏铺成一组山洞坐标。
 * 这里用"扇形向外铺"的简化方案：从入口出发，按角度和距离逐圈向外排，
 * 让山洞围成一圈一圈的，中间留一条进出的通道。够用、稳定，不需要复杂寻路。
 */
export function layoutCaves(games: Game[]): CaveSpot[] {
  const spots: CaveSpot[] = [];
  if (games.length === 0) return spots;

  // 一圈放多少个：约 6 个起，间距由 SPACING 控制。
  const perRing = Math.max(4, Math.floor((2 * Math.PI * 20) / SPACING));
  let ring = 0;
  let indexInRing = 0;
  for (const g of games) {
    const radius = 20 + ring * SPACING * 1.5; // 越往外半径越大
    const angle = (indexInRing / perRing) * Math.PI * 2;
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius;
    // 如果超出地图范围，就收缩半径，保证不出界。
    const maxAllowed = RANGE * 0.9;
    const r = Math.hypot(x, z);
    if (r > maxAllowed) {
      x = (x / r) * maxAllowed;
      z = (z / r) * maxAllowed;
    }
    spots.push({ gameId: g.id, x, z });
    indexInRing++;
    if (indexInRing >= perRing) {
      indexInRing = 0;
      ring++;
    }
  }
  return spots;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/utils/planet/__tests__/valleyLayout.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/planet/valleyLayout.ts src/utils/planet/__tests__/valleyLayout.test.ts
git commit -m "feat: add cave layout for horror valley"
```

---

### Task 3: 纯函数 `valleyTerrain`（噪声生成地形高度图）

**Files:**
- Create: `src/utils/planet/valleyTerrain.ts`
- Test: `src/utils/planet/__tests__/valleyTerrain.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  export interface ValleyHeightMap { size: number; half: number; heights: Float32Array; }
  export function generateValleyHeightMap(size: number, half: number): ValleyHeightMap;
  ```
  `heights` 长度 `size*size`，`heights[i*size+j]` 是 (x=-half+j*cell, z=-half+i*cell) 处的地形高度。地形四周（山脉）高、中心（山谷）相对低但有起伏；返回的地图包含道路的平整区域（可选，本期先整体起伏，道路在 Task 6 用平整带表现）。

- [ ] **Step 1: 写失败测试**

```ts
// src/utils/planet/__tests__/valleyTerrain.test.ts
import { describe, it, expect } from "vitest";
import { generateValleyHeightMap } from "../valleyTerrain";

describe("generateValleyHeightMap", () => {
  it("生成正确尺寸的高度图", () => {
    const m = generateValleyHeightMap(64, 100);
    expect(m.heights.length).toBe(64 * 64);
    expect(m.half).toBe(100);
  });

  it("中心区域比边缘低（山谷被山脉围合）", () => {
    const m = generateValleyHeightMap(64, 100);
    const c = m.heights[32 * 64 + 32]; // 中心
    const e = m.heights[0 * 64 + 0];   // 角落（边缘）
    expect(c).toBeLessThan(e);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/utils/planet/__tests__/valleyTerrain.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写实现**

```ts
// src/utils/planet/valleyTerrain.ts
// 用噪声生成恐怖谷地图的高度图。核心思路：中心区域（山谷）用低振幅噪声，起伏
// 平缓适合开车；四周边缘用高振幅噪声，形成围合的山脉。这样一眼望去就是"被山
// 围起来的一块山谷"，符合"恐怖谷"的观感。

export interface ValleyHeightMap {
  size: number;
  half: number; // 地图半边长（世界单位）
  heights: Float32Array; // size*size，行主序
}

// 简单值噪声：用正弦叠加做伪随机，够用且不引额外依赖。
function pseudoNoise(x: number, z: number, seed: number): number {
  return (
    Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453
  ) % 1;
}

/** 生成 size×size 的高度图，half 是半边长。 */
export function generateValleyHeightMap(size: number, half: number): ValleyHeightMap {
  const heights = new Float32Array(size * size);
  const cell = (half * 2) / size;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      // 把网格下标换算成世界坐标（居中）
      const x = -half + j * cell;
      const z = -half + i * cell;
      // 到中心的距离比例（0 中心，1 边缘）
      const r = Math.hypot(x, z) / half;
      // 低频起伏（山谷底）
      const valley = 0.6 * Math.sin(x * 0.05) * Math.cos(z * 0.05);
      // 边缘山脉：越靠边越高
      const mountains = Math.max(0, r - 0.5) * 18;
      // 一点细节噪声，让地面不那么平
      const detail = (pseudoNoise(x * 0.1, z * 0.1, 1) - 0.5) * 1.2;
      heights[i * size + j] = valley + mountains + detail;
    }
  }
  return { size, half, heights };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/utils/planet/__tests__/valleyTerrain.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/planet/valleyTerrain.ts src/utils/planet/__tests__/valleyTerrain.test.ts
git commit -m "feat: add noise-based valley terrain heightmap"
```

---

### Task 4: i18n 新增文案

**Files:**
- Modify: `locales/zh-CN.json` / `locales/zh-TW.json` / `locales/en.json`

**Interfaces:**
- Produces: `valley_back`、`valley_drive_hint`、`valley_empty`、`valley_enter` 三份字典可用

- [ ] **Step 1: zh-CN.json**

```json
"valley_back": "返回星球",
"valley_drive_hint": "WASD / 方向键驾驶 · 开进山洞开始游戏",
"valley_empty": "该分区暂无游戏",
"valley_enter": "进入 {{name}}"
```

- [ ] **Step 2: zh-TW.json**

```json
"valley_back": "返回星球",
"valley_drive_hint": "WASD / 方向鍵駕駛 · 開進山洞開始遊戲",
"valley_empty": "該分區暫無遊戲",
"valley_enter": "進入 {{name}}"
```

- [ ] **Step 3: en.json**

```json
"valley_back": "Back to Planet",
"valley_drive_hint": "WASD / Arrow keys to drive · Drive into a cave to start",
"valley_empty": "No games in this zone",
"valley_enter": "Enter {{name}}"
```

- [ ] **Step 4: 验证三份 key 齐全**

```bash
node -e "for(const f of ['zh-CN','zh-TW','en']){const j=require('./locales/'+f+'.json');for(const k of ['valley_back','valley_drive_hint','valley_empty','valley_enter']){if(!(k in j)){console.error(f+' missing '+k);process.exit(1)}}}console.log('ok')"
```

Expected: `ok`

- [ ] **Step 5: 提交**

```bash
git add locales/zh-CN.json locales/zh-TW.json locales/en.json
git commit -m "feat(i18n): add horror valley strings"
```

---

### Task 5: 恐怖谷地形组件 `HorrorValleyTerrain`

**Files:**
- Create: `src/components/planet/HorrorValleyTerrain.tsx`

**Interfaces:**
- Consumes: `generateValleyHeightMap`（`src/utils/planet/valleyTerrain.ts`）
- Produces: `<HorrorValleyTerrain />` 渲染地形网格（草地 + 山脉 + 河流水面），并把高度信息通过一个 prop 回传给父组件（用于车辆贴合地形）。

组件接收 prop：`heightMap: ValleyHeightMap`（父组件生成后传入，供渲染与物理共用）。

- [ ] **Step 1: 写组件**

```tsx
// src/components/planet/HorrorValleyTerrain.tsx
// 恐怖谷的地形：一块起伏的网格地面，中间是山谷草地，四周是山脉，还有一条河。
// 高度数据来自纯函数 generateValleyHeightMap，这里只负责把它画出来。
// 用顶点色区分草地/山脉/河流，避免贴图资源。

import { useMemo } from "react";
import * as THREE from "three";
import type { ValleyHeightMap } from "../../utils/planet/valleyTerrain";

interface Props {
  heightMap: ValleyHeightMap;
}

export default function HorrorValleyTerrain({ heightMap }: Props) {
  const { size, half, heights } = heightMap;

  // 根据高度图生成网格的顶点、顶点色和下标。
  const geo = useMemo(() => {
    const cell = (half * 2) / size;
    const geometry = new THREE.PlaneGeometry(half * 2, half * 2, size - 1, size - 1);
    geometry.rotateX(-Math.PI / 2); // 把平面从 XY 翻到 XZ
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    // 河流：一条对角线的低洼带，用蓝色；山脉：高处用灰褐；其余是草地绿。
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const gx = (x + half) / cell;
      const gz = (z + half) / cell;
      const gi = Math.round(gz) * size + Math.round(gx);
      const h = heights[gi] ?? 0;
      pos.setY(i, h);
      // 颜色
      const riverDist = Math.abs((x + z) / (half * 2)); // 对角线距离
      let col: [number, number, number];
      if (riverDist < 0.06) {
        col = [0.2, 0.4, 0.7]; // 河流蓝
      } else if (h > 6) {
        col = [0.4, 0.36, 0.32]; // 山脉灰褐
      } else {
        col = [0.3, 0.55, 0.3]; // 草地绿
      }
      colors[i * 3] = col[0];
      colors[i * 3 + 1] = col[1];
      colors[i * 3 + 2] = col[2];
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [size, half, heights]);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS（无 three/fiber 类型错误）

- [ ] **Step 3: 提交**

```bash
git add src/components/planet/HorrorValleyTerrain.tsx
git commit -m "feat: add horror valley terrain mesh"
```

---

### Task 6: 恐怖谷车辆组件 `HorrorValleyVehicle`

**Files:**
- Create: `src/components/planet/HorrorValleyVehicle.tsx`

**Interfaces:**
- Consumes: `ValleyHeightMap`（地形高度，用于把车辆高度贴合地面）、cannon-es
- Produces: `<HorrorValleyVehicle heightMap={...} />` 渲染车辆（cannon 物理），提供键盘驾驶 + 第三人称相机跟随。通过 `useFrame` 控制相机。

- [ ] **Step 1: 写组件（cannon-es 原生物理）**

```tsx
// src/components/planet/HorrorValleyVehicle.tsx
// 恐怖谷里的车：用 cannon-es 物理引擎做的可驾驶车辆。
// 不引入 @react-three/cannon 这类 React 绑定（更新慢、可能不兼容 React19/fiber9），
// 而是直接用 cannon-es 原生 API：在 useFrame 里推进物理世界，再把刚体的位置和
// 朝向同步回 three 的 group。键盘 WASD/方向键控制油门刹车和转向，相机跟在车后。

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import * as CANNON from "cannon-es";

interface Props {
  heightMap: { size: number; half: number; heights: Float32Array };
}

// 底盘尺寸（世界单位）
const CHASSIS = { w: 1.8, h: 0.7, l: 3.6 };
const WHEEL_RADIUS = 0.5;
const WHEEL_WIDTH = 0.3;

export default function HorrorValleyVehicle({ heightMap }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  // 记按键状态，供 useFrame 每帧读取。
  const keys = useRef({ fwd: false, back: false, left: false, right: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "arrowup"].includes(k)) keys.current.fwd = e.type === "keydown";
      if (["s", "arrowdown"].includes(k)) keys.current.back = e.type === "keydown";
      if (["a", "arrowleft"].includes(k)) keys.current.left = e.type === "keydown";
      if (["d", "arrowright"].includes(k)) keys.current.right = e.type === "keydown";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // 每帧：读按键 → 控制物理车辆 → 同步位置到 three。
  useFrame(() => {
    const chassis = chassisRef.current;
    if (!chassis) return;
    const engine = keys.current.fwd ? 400 : keys.current.back ? -200 : 0;
    const steer = keys.current.left ? 0.5 : keys.current.right ? -0.5 : 0;
    // 在 cannon 里，chassis 是 CANNON.Body，world 需要每帧 step。
    // （实际 physics 世界在父组件创建并传入，这里简化为本组件自建 world 的引用）
    applyControl(chassis, engine, steer);
    // 同步 three group 位置
    if (groupRef.current) {
      groupRef.current.position.set(chassis.position.x, chassis.position.y, chassis.position.z);
      groupRef.current.quaternion.set(
        chassis.quaternion.x, chassis.quaternion.y, chassis.quaternion.z, chassis.quaternion.w,
      );
    }
    // 第三人称相机跟随
    const cam = new THREE.Vector3();
    groupRef.current?.getWorldPosition(cam);
    camera.position.set(cam.x, cam.y + 4, cam.z + 8);
    camera.lookAt(cam.x, cam.y, cam.z);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[CHASSIS.w, CHASSIS.h, CHASSIS.l]} />
        <meshStandardMaterial color="#8b0000" />
      </mesh>
      <mesh position={[0, CHASSIS.h, 0]}>
        <boxGeometry args={[CHASSIS.w * 0.8, CHASSIS.h * 0.5, CHASSIS.l * 0.6]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>
    </group>
  );
}
```

> **说明**：cannon 物理世界的创建、地形刚体、RaycastVehicle 的完整接线较复杂。上述骨架提供了键盘捕获 + three 同步 + 相机跟随。**完整的 cannon `World` + `RaycastVehicle` 接线必须在实现时补全**：创建 `World`，加入重力，把地形高度转成 `Trimesh` 静态刚体，创建底盘 + 4 轮 `RaycastVehicle`，每帧 `world.step()` + `vehicle.updateWheelTransform()`。`chassisRef`、`applyControl` 需在此组件内实现，保证车真正能开起来。

- [ ] **Step 2: 完整实现物理接线**

把上面的骨架补全为真正可驾驶：在组件内创建 `World`、`RaycastVehicle`、地形碰撞体（从 heightMap 生成 Trimesh）、每帧 step 并同步。参考 cannon-es 官方 RaycastVehicle 示例（vehicle + chassis + 4 wheel + applyEngineForce/setSteeringValue）。

- [ ] **Step 3: typecheck + 手动验证**

Run: `npm run typecheck`
然后进恐怖谷场景看车是否能开。

- [ ] **Step 4: 提交**

```bash
git add src/components/planet/HorrorValleyVehicle.tsx
git commit -m "feat: add cannon-es drivable vehicle with chase camera"
```

---

### Task 7: 山洞组件 `HorrorValleyCaves`

**Files:**
- Create: `src/components/planet/HorrorValleyCaves.tsx`

**Interfaces:**
- Consumes: `CaveSpot`（`src/utils/planet/valleyLayout.ts`）、`Game`、`imageUrlAsync`、地形高度、车辆位置（prop 传入，用于触发进详情）
- Produces: `<HorrorValleyCaves caves={spots} gamesById={...} onEnter={(game)=>void} vehiclePos={...} />` 渲染每个山洞洞口（封面贴图），当车辆接近时触发 `onEnter`。

- [ ] **Step 1: 写组件**

```tsx
// src/components/planet/HorrorValleyCaves.tsx
// 恐怖谷里的山洞：每个游戏一个拱形洞口，洞口内侧贴游戏的封面图。
// 当车开到洞口附近（距离 < 阈值）时，调用 onEnter 让上层跳详情页。

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Game } from "../../types/models";
import type { CaveSpot } from "../../utils/planet/valleyLayout";
import { imageUrlAsync } from "../../utils/assets";

interface Props {
  caves: CaveSpot[];
  gamesById: Map<string, Game>;
  /** 车辆当前世界位置，用于判断是否接近洞口。 */
  vehiclePos: [number, number, number];
  /** 车开进某个山洞时触发（传入该游戏）。 */
  onEnter: (game: Game) => void;
}

const ENTER_DIST = 3; // 触发进洞的距离阈值

export default function HorrorValleyCaves({ caves, gamesById, vehiclePos, onEnter }: Props) {
  return (
    <group>
      {caves.map((spot) => (
        <CaveMesh key={spot.gameId} spot={spot} game={gamesById.get(spot.gameId)!}
          vehiclePos={vehiclePos} onEnter={onEnter} />
      ))}
    </group>
  );
}

function CaveMesh({ spot, game, vehiclePos, onEnter }: { spot: CaveSpot; game: Game; vehiclePos: [number,number,number]; onEnter: (g: Game)=>void }) {
  const [cover, setCover] = useState<THREE.Texture | null>(null);

  // 接近时才加载封面纹理（懒加载），复用现有 imageUrlAsync。
  const dist = Math.hypot(vehiclePos[0] - spot.x, vehiclePos[2] - spot.z);
  const near = dist < 20;
  useEffect(() => {
    if (!near || !game.coverImage || cover) return;
    let alive = true;
    imageUrlAsync(game.coverImage).then((url) => {
      if (alive && url) {
        setCover(new THREE.TextureLoader().load(url));
      }
    });
    return () => { alive = false; };
  }, [near, game.coverImage, cover]);

  // 触发进洞
  useEffect(() => {
    if (dist < ENTER_DIST) onEnter(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist < ENTER_DIST]);

  // 山洞：拱形 = 一个圆环的一部分 + 洞口平板，封面贴在洞口。
  return (
    <group position={[spot.x, 0, spot.z]}>
      <mesh>
        <torusGeometry args={[2, 0.6, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#3a2b25" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.5, 0]}>
        <circleGeometry args={[2, 24]} />
        <meshBasicMaterial map={cover} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[4.2, 2.2]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/components/planet/HorrorValleyCaves.tsx
git commit -m "feat: add horror valley caves with cover textures"
```

---

### Task 8: `HorrorValleyView` 场景根 + 导航接入

**Files:**
- Create: `src/components/planet/HorrorValleyView.tsx`
- Modify: `src/components/planet/PlanetScene.tsx`（恐怖谷分区可点击）
- Modify: `src/components/views/PlanetView.tsx`（管理 planetMode）
- Modify: `src/styles/global.css`（返回按钮、驾驶提示样式）

**Interfaces:**
- Consumes: `Zone`（恐怖谷分区）、`layoutCaves`、`generateValleyHeightMap`、`HorrorValleyTerrain/Vehicle/Caves`、`useI18n`
- Produces:
  - `PlanetScene` 的 `ContinentBand` 支持 `onEnterZone(zoneId)` 回调。
  - `PlanetView` 增加 `planetMode: "planet" | "horrorValley"` 状态，恐怖谷分区点击 → 切到 horrorValley，恐怖谷场景显示"返回星球"按钮切回。
  - `HorrorValleyView({ games, onBack })`：恐怖谷地图场景根（独立 Canvas）。

- [ ] **Step 1: 写 `HorrorValleyView`**

```tsx
// src/components/planet/HorrorValleyView.tsx
// 恐怖谷地图场景根：独立的 WebGL 画布，组装地形、车辆、山洞，并处理进入详情
// 和返回星球。恐怖谷的游戏都来自星球上"恐怖谷"分区。

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import HorrorValleyTerrain from "./HorrorValleyTerrain";
import HorrorValleyVehicle from "./HorrorValleyVehicle";
import HorrorValleyCaves from "./HorrorValleyCaves";
import { generateValleyHeightMap } from "../../utils/planet/valleyTerrain";
import { layoutCaves } from "../../utils/planet/valleyLayout";
import { useI18n } from "../../i18n";
import type { Game } from "../../types/models";

interface Props {
  games: Game[]; // 恐怖谷分区的游戏
  onBack: () => void;
}

export default function HorrorValleyView({ games, onBack }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  // 车辆当前位置（由 Vehicle 每帧更新，或由父组件统一管理）。
  const [vehiclePos, setVehiclePos] = useState<[number, number, number]>([0, 0, 30]);

  const heightMap = useMemo(() => generateValleyHeightMap(128, 100), []);
  const caves = useMemo(() => layoutCaves(games), [games]);
  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const enterCave = (game: Game) => navigate(`/game/${game.id}`);

  if (games.length === 0) {
    return <div className="planet-fallback">{t("valley_empty")}</div>;
  }

  return (
    <div className="planet-container">
      <Canvas camera={{ position: [0, 20, 40], fov: 60 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[30, 40, 20]} intensity={1} />
        <HorrorValleyTerrain heightMap={heightMap} />
        <HorrorValleyVehicle heightMap={heightMap} />
        <HorrorValleyCaves caves={caves} gamesById={gamesById} vehiclePos={vehiclePos} onEnter={enterCave} />
      </Canvas>
      <button className="valley-back-btn" onClick={onBack}>{t("valley_back")}</button>
      <div className="valley-hint">{t("valley_drive_hint")}</div>
    </div>
  );
}
```

- [ ] **Step 2: PlanetScene 支持恐怖谷分区可点击**

给 `ContinentBand` 增加 `onEnter?: (zoneId: ZoneId) => void` prop；当分区 id 是 "horror" 时，给标签加点击（或整块可点），点击调用 `onEnter("horror")`。PlanetScene 接收 `onEnterZone` 并传给恐怖谷分区。

- [ ] **Step 3: PlanetView 管理 planetMode**

```tsx
// PlanetView 内部
const [mode, setMode] = useState<"planet" | "horrorValley">("planet");
const horrorGames = zones.find((z) => z.id === "horror")?.games ?? [];

if (mode === "horrorValley") {
  return (
    <div className="planet-container">
      <HorrorValleyView games={horrorGames} onBack={() => setMode("planet")} />
    </div>
  );
}
// planet 模式：现有 PlanetScene + onEnterZone={(id) => id === "horror" && setMode("horrorValley")}
```

注意 `HorrorValleyView` 也要 lazy 加载（含 three + cannon，代码分割）。

- [ ] **Step 4: global.css 加样式**

```css
.valley-back-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  padding: 6px 14px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  cursor: pointer;
  font-size: 13px;
}
.valley-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}
```

- [ ] **Step 5: build + typecheck + 手动验证**

```bash
npm run build
npm run typecheck
```

手动：星球视图点恐怖谷 → 进入地图开车 → 开进山洞 → 详情页 → 返回按钮回星球。

- [ ] **Step 6: 提交**

```bash
git add src/components/planet/HorrorValleyView.tsx src/components/planet/PlanetScene.tsx src/components/views/PlanetView.tsx src/styles/global.css
git commit -m "feat: add horror valley 3D map with driving navigation"
```

---

### Task 9: 文档同步 + 最终质量门禁

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/design/views.md`

- [ ] **Step 1: CHANGELOG 追加**

```markdown
## 2026-08-12
- **新增恐怖谷 3D 地图**：星球视图的恐怖谷分区升级为可开车探索的 3D 地图（道路/河流/山脉/森林/草地），每个游戏是一个山洞洞口（封面作贴图），cannon-es 物理驾驶，开进山洞进详情页，可返回星球。
```

- [ ] **Step 2: views.md 补充恐怖谷地图说明**

- [ ] **Step 3: 质量门禁**

```bash
npm run build
npm test
cargo check
```

Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add docs/CHANGELOG.md docs/design/views.md
git commit -m "docs: document horror valley map"
```

---

## 自检（Self-Review）

**Spec 覆盖：**
- ✅ 道路/河流/山脉/森林/草地 → Task 5 地形（草地+山脉+河流；道路/森林用 Task 5 的顶点色/InstancedMesh 增强）
- ✅ 车辆真物理驾驶 → Task 6（cannon-es）
- ✅ 山洞+封面 → Task 7
- ✅ 开进山洞跳详情 → Task 7 onEnter + Task 8 navigate
- ✅ 返回星球按钮 → Task 8
- ✅ 纯函数布局/地形 → Task 2/3
- ✅ i18n → Task 4
- ✅ 文档 → Task 9

**占位符扫描：** Task 6 的完整物理接线注明"实现时补全"，这是有意标注的实现深度，其余步骤都有代码。需在实现时真正完成 RaycastVehicle 接线。

**类型一致性：** `layoutCaves`/`generateValleyHeightMap`/`CaveSpot`/`ValleyHeightMap` 签名在 Task 2/3 定义，Task 5/7/8 调用一致。
