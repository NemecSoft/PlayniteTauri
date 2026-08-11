# 视图系统

## 顶层标签页（`TabsBar`）

主界面采用**顶部标签栏**导航，由 `uiStore.activeTab` 控制（默认 `home`）：

| 标签 | 组件 | 说明 |
| --- | --- | --- |
| 主页 | `MainContent`（现有库视图） | 工具栏 + 网格/列表/详情视图，或"最近新增"（`activePage === "news"`） |
| 视频 | `VideosView` | 展示游戏库中各游戏关联的 `videos` 字段 |
| 额外工具 | `ToolsView` | 占位工具卡片（屏幕录制 / 游戏加速 / 游戏增强），功能后续实现 |

- `TabsBar` 渲染在 `app-body`（侧边栏 + 主内容）上方。
- `MainContent` 依据 `activeTab` 决定渲染哪个视图；`home` 标签内部继续沿用原有的
  `activePage`（`library` / `news`）机制。
- 视频播放：`videos.type === "youtube"` 时转换为 `https://www.youtube.com/embed/<id>`
  内嵌 iframe；`file` / `url` 类型作为外链卡片展示。

## 四种视图

| 视图 | 组件 | 说明 |
| --- | --- | --- |
| 网格视图 | `GridView` | 封面卡片，支持收藏角标、已安装圆点、双击启动、右键菜单 |
| 列表视图 | `ListView` | 表格，可排序（名称/平台/时长/最近游玩），状态图标 |
| 详情视图 | `DetailsView` | 展示首个选中游戏的完整元数据 + 开始游戏按钮 |
| 星球视图 | `PlanetView`（3D） | 把游戏按 7 个分区渲染到自转 3D 星球，悬停放大封面、点击进详情 |

## 星球视图（`PlanetView`）

- 基于 `three.js` + `@react-three/fiber` + `@react-three/drei`，工具栏切换。
- 分区归类：`src/utils/planet/zoneMapper.ts`（固定 7 类 + genre/名称关键词映射）。
- 球面分布：`src/utils/planet/fibonacciSphere.ts`（Fibonacci 均匀分布，按纬度带分区）。
- 封面懒加载：只有悬停某游戏点时才 `imageUrlAsync` 加载封面纹理，避免 1000+ 封面拖垮主线程。
- 代码分割：`PlanetView` 用 `React.lazy` 懒加载，three.js 只在切到星球视图时按需加载。
- WebGL 不可用时自动降级，提示用户使用网格视图。

## 分组与排序（`src/utils/selectors.ts`）

- `filterGames(games, opts)`：按可见性（隐藏/仅已安装/收藏）、平台/分类/类型/开发商过滤器、
  搜索词（调用 `matchSearch`，见 [搜索系统](./search.md)）过滤。
- `sortGames(games, key, dir)`：按名称 / 平台 / 时长 / 最近游玩排序。
- `groupGames(games, groupBy, labels?)`：按 平台 / 分类 / 类型 / 开发商 / 来源 / 收藏 分组。
  特殊分组标签（全部游戏 / 未知 / 未分类 / 收藏 / 其他）支持多语言，通过 `labels` 参数注入翻译。

## 选择与交互

- 单选 / 多选（Ctrl/Cmd 点击）。
- 右键菜单（`GameContextMenu`）：开始游戏、加入/取消收藏、隐藏/取消隐藏、编辑、复制路径、删除。
- 双击网格卡片 / 列表行 → 启动游戏。

## 启动逻辑

- `launchGame` 在 Rust 后端执行：解析 `play_actions` 中 `isPlayAction` 的动作，
  按类型 `File`（进程）或 `URL`（打开浏览器）启动，并开始游玩时长追踪。
- **模拟器已移除**：`GameAction` 类型仅 `File` / `URL`。
