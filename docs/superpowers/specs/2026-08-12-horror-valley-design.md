# 恐怖谷地图设计文档（星球视图扩展）

日期：2026-08-12
状态：设计定稿，待评审

## 一、目标

在已实现的 3D 星球视图基础上，把**恐怖谷分区**从"球面上的一段光点带"升级为**一块可开车探索的 3D 地图**。

- 点击星球上的恐怖谷分区 → **以第三人称汽车驾驶**进入一块独立地图。
- 地图包含：**道路、河流、山脉、森林、草地**。
- 每个恐怖谷游戏是一个**山洞洞口**，游戏封面作为洞口的贴图。
- **开车进入山洞洞口 → 停住并跳转到该游戏详情页**。
- 地图里有"返回星球"按钮，随时回到星球视图。

已确认的三个关键决策：
1. **真物理驾驶**：用 `cannon-es` 物理引擎做车辆（加速/刹车/转向/悬挂），能翻越起伏地形。
2. **山洞触发**：车开到洞口停住，跳转该游戏详情页（和点击星球光点一致）。
3. **返回**：恐怖谷地图角落放"返回星球"UI 按钮。

## 二、技术选型

| 依赖 | 用途 | 说明 |
| --- | --- | --- |
| `cannon-es` | 车辆物理 + 地形碰撞 | 直接用原生 API，不经过 React 绑定（`@react-three/cannon` 更新不活跃，可能不兼容 fiber v9/React 19；原生 API 更可控） |
| three.js（已有） | 3D 渲染 | |
| @react-three/fiber/drei（已有） | React 声明式 3D + 辅助 | |

**物理集成方式**：用 `cannon-es` 的 `World` 创建独立物理世界，`useFrame` 里 `world.step()` 推进物理，再把物理体的位置/旋转同步回 three 对象。车辆用 `RaycastVehicle`（悬挂 + 车轮）。

## 三、架构与组件拆分

新增独立场景，与星球场景分离。每个场景一个 Canvas：

```
PlanetView（现有，星球场景）
  └─ 点击恐怖谷分区 → 通知上层切换

HorrorValleyView（新增，恐怖谷地图场景，独立 Canvas）
  ├─ HorrorValleyTerrain（地形：起伏网格 + 道路/河流/山脉/森林/草地）
  ├─ HorrorValleyVehicle（车辆：cannon 物理 + 键盘控制 + 第三人称相机）
  └─ HorrorValleyCaves（山洞：每个游戏一个洞口 + 封面贴图 + 触发进详情）
```

### 3.1 导航状态

用一个简单的状态切换，放在 PlanetView 上层（GamesView 或一个容器）：

```
planetMode: "planet" | "horrorValley"
```

- 在星球场景点击恐怖谷分区（ContinentBand id === "horror"）→ 切到 "horrorValley"。
- 恐怖谷地图的"返回星球"按钮 → 切回 "planet"。

### 3.2 数据流

```
Zone[]（恐怖谷分区包含该分区的游戏）
  → HorrorValleyView 只取 zone.id === "horror" 的 games
  → 每个游戏在山谷里生成一个山洞洞口（位置由布局算法决定）
```

- 布局算法是纯函数（`valleyLayout.ts`），把 N 个山洞沿道路两侧/沿线铺开，可单测。

### 3.3 新增文件

| 文件 | 职责 |
| --- | --- |
| `src/components/planet/HorrorValleyView.tsx` | 恐怖谷地图场景根：独立 Canvas + 地形 + 车辆 + 山洞 + 返回按钮 |
| `src/components/planet/HorrorValleyTerrain.tsx` | 地形网格 + 道路/河流/山脉/森林/草地生成 |
| `src/components/planet/HorrorValleyVehicle.tsx` | cannon 物理车辆 + 键盘控制 + 第三人称相机 |
| `src/components/planet/HorrorValleyCaves.tsx` | 山洞洞口（封面贴图）+ 触发进详情 |
| `src/utils/planet/valleyLayout.ts` | 纯函数：把 N 个山洞沿道路铺到地图坐标 |
| `src/utils/planet/valleyTerrain.ts` | 纯函数：噪声生成地形高度图 + 要素分类 |

### 3.4 修改文件

| 文件 | 改动 |
| --- | --- |
| `src/components/planet/PlanetScene.tsx` | 恐怖谷分区的 ContinentBand 可点击，回调进入地图 |
| `src/components/views/PlanetView.tsx` | 管理 planetMode 状态，切换渲染星球场景或恐怖谷场景 |
| `src/styles/global.css` | 恐怖谷返回按钮、驾驶提示、洞口触发提示样式 |
| `locales/*.json` | 新增"返回星球""驾驶提示"等文案 |

## 四、地形生成（valleyTerrain）

用 **Simplex/Perlin 噪声**生成一张高度图：

- 整体高度：低频噪声 → 丘陵起伏。
- 山脉：高频/高振幅噪声区域，集中在地图四周边缘，形成"山谷"围合。
- 河流：从地图一端到另一端的低洼曲线，比周围低 + 蓝色半透明水面。
- 草地：默认地面材质（绿色系，半透明高，适合驾驶）。
- 道路：一条从入口（地图边缘）蜿蜒到各山洞区域的平整带（高度几乎不变 + 深灰色路面）。

实现：一个 `PlaneGeometry`，按高度图设置每个顶点 y，分区赋材质（通过顶点色或贴图混合）。

## 五、车辆（cannon-es 真物理）

用 `cannon-es` 的 **`RaycastVehicle`**：

- 车辆 = 底盘 Box 刚体 + 4 个车轮约束（悬挂弹簧）。
- 地形也加入物理世界作为静态碰撞体（用 `Trimesh` 或简化凸包），车才能开在起伏地面上。
- 键盘控制（`useFrame` 里读取键盘状态）：
  - W / ↑：加速
  - S / ↓：刹车 / 倒车
  - A / D：转向
- 第三人称相机：跟随车辆后方一定距离，朝向车辆前方。
- 每帧 `world.step(fixedTimeStep)`，然后同步 body 的 position/quaternion 到 three 的 group。

## 六、山洞与触发

- 每个山洞 = 一个拱形洞口 mesh（圆拱门状），洞口内侧贴**游戏封面纹理**。
- 山洞沿道路两侧分布（`valleyLayout`）。
- 检测：车（body 位置）与某个山洞洞口的距离 < 阈值 → 车辆减速停住 → 显示"进入 X"提示 → 玩家点击 / 自动跳转详情页。

## 七、封面渲染与性能

- 复用现有 `imageUrlAsync` 懒加载：只有车接近某个山洞（或该山洞可见）才加载封面纹理，避免一次加载全部。
- 森林的树用 `InstancedMesh`（一次画几百上千棵树，低开销）。
- 地形单 mesh，低多边形数（如 128×128 顶点），兼顾起伏与性能。
- 恐怖谷地图同样是懒加载场景（沿用 `React.lazy` 代码分割思路，或与星球共用已分割的 chunk）。

## 八、错误处理

- 物理引擎初始化失败 / 无 WebGL：显示降级提示。
- 封面加载失败：山洞洞口显示占位色，不阻塞。
- 恐怖谷无游戏：显示"该分区暂无游戏"。
- 车开到地图边缘：加围栏/山体碰撞，防止掉出地图。

## 九、国际化

新增 key（三份 JSON 同步）：
- `valley_back`（返回星球）
- `valley_drive_hint`（驾驶提示：WASD/方向键驾驶，开进山洞开始游戏）
- `valley_empty`（该分区暂无游戏）
- `valley_enter`（进入 {{name}}）

## 十、范围与排除（YAGNI）

**本期不做**：
- 其它分区（射击场/赛车场等）的地图——只做恐怖谷。
- 车内视角 / 第一人称驾驶——先第三人称。
- 真实车模——用简单几何体（底盘+车厢）表示车。
- 音频、天气、昼夜循环。

## 十一、测试

- `valleyLayout`：单测——N 个山洞沿道路铺开、不重叠、都在道路附近。
- `valleyTerrain`：单测——高度图尺寸正确、山脉区域高、河流区域低。
- 手动：进入恐怖谷、开车漫游、进山洞跳详情、返回星球。

## 十二、文档同步

完成后更新 `docs/CHANGELOG.md`、`docs/design/views.md`。
