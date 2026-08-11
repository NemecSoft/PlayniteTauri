# 3D 虚拟星球视图设计文档

日期：2026-08-12
状态：设计定稿，待评审

## 一、目标

在主页新增一种 **3D 虚拟星球视图**，把当前 1000+ 个游戏渲染到一颗可自转的 3D 星球上。
游戏按类型分到几个"大陆/板块"，每个板块一个主题名（恐怖谷、射击场、赛车场……）。

已确认的两个关键决策：

1. **分区依据**：固定 6-8 个分区 + 关键词映射，复用 `autotags.rs` 现有中英文关键词做游戏归类。可控、观感统一。
2. **互动深度**：轻量交互——鼠标悬停放大显示封面，点击跳转到现有详情页。

## 二、技术选型（方案 A）

用 **three.js** 做真实 3D 星球。React 侧用官方封装：

| 依赖 | 用途 |
| --- | --- |
| `three` | 3D 渲染内核 |
| `@react-three/fiber` | 把 three 场景接进 React 声明式组件树 |
| `@react-three/drei` | 常用辅助（Html 悬浮标签、轨道控制 OrbitControls 等） |

不用 `react-three-fiber` 之外的自造引擎，遵循项目"基础设施复用成熟方案"的准则。

## 三、架构与组件拆分

按"单一职责、清晰接口"原则拆成几个独立单元，每个都可独立理解和测试：

```
PlanetView（视图容器，接 GamesView 分支）
  └─ PlanetScene（3D 场景根节点：Canvas + 摄像机 + 灯光 + 星球 + 游戏点）
       ├─ PlanetMesh（3D 星球本体：球体 + 表面纹理 + 自转）
       ├─ ContinentBand（一个分区的大陆带：弧形区域 + 分类名悬浮标签）
       └─ GameMarker（单个游戏光点/微缩封面）
```

### 3.1 数据流

```
GamesView 的 groups（已过滤+排序的游戏列表）
  → useMemo 用 zoneMapper 把 Game[] 归类为 Zone[]（每区含游戏列表）
  → PlanetView 拿到 zones
  → PlanetScene 用球面分布算法把每个游戏放到星球表面坐标
```

- 分区归类是**纯函数**（`zoneMapper.ts`），可单测。
- 球面坐标是**纯函数**（`fibonacciSphere.ts`），可单测。
- 星球只渲染 `zones`，不直接依赖 store，接口清晰。

### 3.2 新增文件

| 文件 | 职责 |
| --- | --- |
| `src/components/views/PlanetView.tsx` | 视图容器，接收 zones，渲染 `<PlanetScene>` |
| `src/components/planet/PlanetScene.tsx` | 3D 场景根：Canvas、摄像机、OrbitControls、灯光、挂 PlanetMesh + 分区 |
| `src/components/planet/PlanetMesh.tsx` | 星球球体本体 + 自转动画 |
| `src/components/planet/ContinentBand.tsx` | 一个分区的弧带 + 分类悬浮标签（drei Html） |
| `src/components/planet/GameMarker.tsx` | 单个游戏光点，悬停放大封面 + 点击进详情 |
| `src/utils/planet/zoneMapper.ts` | 纯函数：Game[] → Zone[]（固定分区 + 关键词映射） |
| `src/utils/planet/fibonacciSphere.ts` | 纯函数：把 N 个游戏均匀分布到球面坐标 |
| `src/utils/planet/types.ts` | Zone、GameMarkerData 等类型 |

### 3.3 修改文件

| 文件 | 改动 |
| --- | --- |
| `src/stores/gamesStore.ts` | `ViewMode` 增加 `"planet"` |
| `src/components/views/GamesView.tsx` | 按 `viewMode` 分支：grid → GridView，planet → PlanetView |
| `src/components/Toolbar.tsx` | 搜索框旁加"网格/星球"视图切换按钮 |
| `src/styles/global.css` | 星球视图容器样式 + 切换按钮样式 |
| `locales/{zh-CN,zh-TW,en}.json` | 新增分区名 + 切换按钮 + 视图相关文案 |
| `src/i18n/locales/{zh-CN,zh-TW,en}.ts` | 同步上述文案（若此文件也是字典源） |

## 四、分区映射（zoneMapper）

固定 7 个分区，按 `genre` 字段 + 中文/英文关键词匹配（复用 `autotags.rs` 的映射思路，在前端 `zoneMapper.ts` 里做一份镜像）：

| 分区 | 中文名 | 匹配关键词（genre + 名称） |
| --- | --- | --- |
| horror | 恐怖谷 | 恐怖、horror、惊悚、僵尸、zombie、末日、血腥、scary |
| shooter | 射击场 | 射击、shooter、FPS、枪战、第一人称、第三人称 |
| racing | 赛车场 | 赛车、racing、竞速、driving、卡丁、GT |
| rpg | 角色扮演城 | RPG、角色扮演、ARPG、Open World、开放世界 |
| puzzle | 益智区 | 解谜、puzzle、益智、休闲、casual、音乐、节奏 |
| sports | 体育场 | 体育、sports、足球、篮球、FIFA、格斗、fighting |
| other | 未分类 | 都不命中时的兜底 |

匹配优先级：**从上到下，先命中先归属**（一个游戏只进一个分区）。
一个游戏同时属于多个分区（genre 数组）时，取第一个命中的分区。

命中顺序：先看 `genre` 数组，再看 `name` + 多名称。这样 `genre` 填得准的用 genre，填不准的靠名字关键词兜底。

## 五、球面分布（fibonacciSphere）

- 用 **Fibonacci 球面分布**算法，把 N 个游戏均匀铺满球面，避免两极密集、赤道稀疏。
- 每个分区内部按该算法独立分布到**该分区对应的弧带**上：
  - 把球面按分区数切成几段经度带（或纬度带），每区一段。
  - 区与区之间留出空隙（发光边界），看起来像"大陆板块"。
- 坐标为球面 `(lat, lon)`，转成 `(x,y,z)` 后作为 GameMarker 的挂载点。

## 六、封面渲染与性能（关键）

这是本方案最大风险点，必须复用项目现有的懒加载机制，避免重蹈"主线程被占满"的覆辙。

- **不预加载**：1000+ 封面绝不一次性加载。
- **可见性剔除**：只用"当前朝向摄像机、且在屏幕内"的半球的游戏点加载封面。
  - 用 raycast 或简单的"点积 > 0"判断哪些点朝前。
  - 每次旋转结束后，只给可见的点 `ensureImageLoaded(coverImage)`。
- **LOD（细节分级）**：
  - 远景（点很小）：只渲染**发光小点**（纯色 sprite，无纹理），成本极低。
  - 近景 / 悬停：才换成**封面纹理**的 billboard。
- **纹理内存**：封面走现有 LRU blob 缓存（上限 220），用 `imageUrl()` 拿已缓存的 blob URL，没有就先用占位色点，`ensureImageLoaded` 加载完换纹理。
- **实例化**：远景点用 three 的 `InstancedMesh` 一次性画几千个点，避免逐对象开销。
- **帧预算**：自转用 `useFrame`，但封面纹理切换用 `requestIdleCallback`/事件驱动，不占动画帧。

## 七、交互

- **悬停**：某个 GameMarker 放大（scale 变大 + 显示封面纹理 + 名称），其余不受影响。
- **点击**：`onClick` → `navigate('/game/:id')`，走现有详情页。
- **旋转**：OrbitControls 拖拽旋转 + 惯性；无人操作时星球缓慢自转。
- **分区分级**：每个 ContinentBand 的顶部悬浮分区名标签（drei Html，始终面向屏幕）。

## 八、错误处理

- 分区为空 / 无游戏：PlanetView 显示空状态提示。
- 封面加载失败：GameMarker 保持发光小点，不报错、不阻塞。
- WebGL 不可用：降级提示"当前环境不支持 3D 视图，请用网格视图"。
- three 场景初始化失败：catch 后显示占位提示，不影响其它视图。

## 九、国际化

新增 key（三份 JSON 同步）：
- 视图切换按钮：`view_planet`（星球视图）、`view_grid`（网格视图）
- 分区名：`planet_zone_horror` / `planet_zone_shooter` / `planet_zone_racing` / `planet_zone_rpg` / `planet_zone_puzzle` / `planet_zone_sports` / `planet_zone_other`
- 空状态：`planet_empty`
- 降级提示：`planet_webgl_unsupported`

## 十、测试

- `zoneMapper`：单测——已知 genre 的游戏归到正确分区；未命中归 other；多分区取第一个命中。
- `fibonacciSphere`：单测——N 个点均匀分布、落在正确弧带。
- 手动：1000+ 游戏切到星球视图，旋转流畅、悬停/点击正常、封面懒加载不卡顿。

## 十一、范围与排除

**本期不做**（YAGNI）：
- 聚焦动画（点游戏后星球飞到该游戏）——留待后续。
- 游戏微缩建筑/城市——太重，当前是光点 + 封面。
- 动态按 genre 自动生成分区——已定固定分区。

## 十二、文档同步

完成后更新：
- `docs/design/*.md`（若涉及数据模型/目录结构）
- `docs/CHANGELOG.md`（追加功能变更条目）
