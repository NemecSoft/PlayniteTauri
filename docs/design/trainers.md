# 修改器（Trainer / Mods）整合设计

## 目标

为每款游戏提供**修改器（Cheat Trainer）**与**游戏 Mod** 的整合入口。用户能为游戏添加/关联修改器，
并从应用内直接下载或启动。设计上保持**完全离线可控**（与 `CoverImages` 一致的哲学），
并预留在线源扩展。

## 现状

- `Game` 模型目前**没有**任何修改器字段。
- 原版 Playnite 通过 `GameMenu` / `Generic` 插件扩展修改器（如 FLiNG、风灵月影）。
- 本项目已具备 `PluginManifest`（`plugin_type` 含 `"GameMenu"` / `"Generic"`），
  可作为修改器插件的承载机制。

## 数据模型扩展

在 `Game` 上新增一个可选结构，存放该游戏的修改器条目：

```rust
/// A trainer / cheat / mod entry linked to a game.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameTrainer {
    pub id: String,
    /// Display name, e.g. "风灵月影 2026.02.10".
    pub name: String,
    /// Where it comes from: "local" (user-provided) or "fling" / "web" source.
    #[serde(default)]
    pub source: String,
    /// For local trainers: absolute path to the executable/script.
    #[serde(default)]
    pub path: Option<String>,
    /// For online trainers: the download page / API URL.
    #[serde(default)]
    pub url: Option<String>,
    /// Version of the trainer (if known).
    #[serde(default)]
    pub version: Option<String>,
    /// Trainer executable arguments (when launched locally).
    #[serde(default)]
    pub arguments: Option<String>,
    /// Whether the trainer's exe needs admin elevation.
    #[serde(default)]
    pub run_as_admin: bool,
    /// Arbitrary metadata / notes (hotkeys, warnings).
    #[serde(default)]
    pub notes: Option<String>,
}

// In Game:
#[serde(default)]
pub trainers: Vec<GameTrainer>,
```

> `#[serde(default)]` 保证旧库记录反序列化为空数组，**无需数据库迁移**。

## 目录约定（绿色存储）

修改器文件放在应用目录下，便于整体便携拷贝：

```
release/
├─ trainers/
│  ├─ <gameId>/
│  │  ├─ trainer.exe          ← 本机修改器
│  │  ├─ readme.txt           ← 说明/热键
│  │  └─ manifest.json        ← 可选：版本、作者、来源
│  └─ ...
```

- `AppPaths::trainers_dir()` = `config_root()/trainers`
- 每个游戏一个子目录，命名用 `game_id`（稳定且可含任意字符）

## 后端命令

| 命令 | 作用 |
| --- | --- |
| `list_trainers(game_id) -> Vec<GameTrainer>` | 扫描该游戏的 `trainers/<gameId>/` 目录 + DB 里的 URL 条目 |
| `add_trainer(game_id, name, path/url, ...)` | 关联一个修改器（本地路径或在线 URL），写入 DB |
| `remove_trainer(id)` | 移除修改器条目（可同时删除本地文件） |
| `launch_trainer(id)` | 启动本地修改器（可请求管理员权限），与游戏启动分开、互不干扰 |
| `import_trainers_from_folder()` | 批量扫描 `trainers/` 目录，自动按目录名关联到游戏 |

### 修改器启动

复用 `process.rs` 的进程启动能力，但**不纳入游玩时长统计**（`track_game` 为 false）。
管理员权限通过 Windows UAC 提示请求（`runas`）。

## 前端 UI

### 详情页（`GameDetailPage`）

在"开始游戏 / 操作指南 / 截图 / 视频"之外新增 **"修改器"** 分区：

- 列出该游戏所有修改器条目（名称 + 来源/版本徽标）
- 每个条目：
  - 本地 → **"启动"** 按钮（直接运行 trainer.exe）
  - 在线 → **"打开下载页"** 按钮（跳转 URL）
  - 删除按钮
- 顶部 "+" 添加按钮：弹窗选择"本地文件"或"在线链接"，填写名称/路径/URL

### 侧边栏 / 分组

可选：`Game` 增加 `has_trainers` 快捷标记，用于侧边栏"有修改器"筛选视图。

## 效率与可控性

1. **懒加载**：`list_trainers` 只在进入详情页或显式打开修改器分区时调用，不随 `get_games` 批量加载。
2. **目录扫描缓存**：`trainers/<gameId>` 目录结果按 mtime 缓存（与 `covers.rs` 的索引缓存同思路）。
3. **完全离线可用**：本地修改器不依赖网络；在线条目仅作链接跳转，数据仍由用户掌控。
4. **扩展点**：预留 `source` 字段，未来可接入 FLiNG / 风灵月影的在线 API 自动抓取，只需新增一个抓取器后端命令，UI 复用同一数据结构。
