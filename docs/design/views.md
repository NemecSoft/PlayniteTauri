# 视图系统

## 三种视图

| 视图 | 组件 | 说明 |
| --- | --- | --- |
| 网格视图 | `GridView` | 封面卡片，支持收藏角标、已安装圆点、双击启动、右键菜单 |
| 列表视图 | `ListView` | 表格，可排序（名称/平台/时长/最近游玩），状态图标 |
| 详情视图 | `DetailsView` | 展示首个选中游戏的完整元数据 + 开始游戏按钮 |

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
