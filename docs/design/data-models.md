# 游戏数据模型

## 概述

`Game` 是核心实体，对应原版 Playnite 的 `Playnite.SDK.Models.Game`。本项目对原版做了关键改进，最核心的是**多名称支持**。

## `Game` 结构

```rust
pub struct Game {
    pub id: String,
    pub name: String,                       // 主名称（通常为英文原名）
    pub sort_name: Option<String>,          // 排序用标题
    pub localized_names: Vec<GameName>,     // ★ 多语言本地化名称
    pub alternate_names: Vec<String>,       // ★ 别名 / 俗称
    pub game_id: Option<String>,
    pub icon: Option<String>,
    pub cover_image: Option<String>,
    pub background_image: Option<String>,
    pub description: Option<String>,
    pub release_date: Option<String>,
    pub community_score: Option<i32>,
    pub critic_score: Option<i32>,
    pub installed: bool,
    pub favorite: bool,
    pub hidden: bool,
    pub playtime: i64,
    pub play_count: i64,
    pub last_played: Option<String>,
    pub install_directory: Option<String>,
    pub play_actions: Vec<GameAction>,
    pub links: Vec<GameLink>,
    pub genre: Vec<String>,
    pub tags: Vec<String>,
    pub developer: Vec<String>,
    pub publisher: Vec<String>,
    pub platform: Vec<String>,
    pub series: Vec<String>,
    pub category: Vec<String>,
    pub version: Option<String>,
    pub source: Vec<String>,
    pub modified: String,
}
```

## 多名称设计（对原版 Playnite 的改进）

> **背景**：原版 Playnite 的 `Game` 只有一个 `name` 字段。这导致一款游戏只能有一个标题，
> 无法表达它的多种名称——例如 GTA 5 英文名是 "Grand Theft Auto V"，中文圈俗称
> "三男一狗"、"车枪大战"，还有日文名、韩文名、港澳台地区的本地化译名等。

本项目引入**两套扩展字段**，采用行业通用的"主名 + 本地化名 + 别名"方案
（类似 IGDB / Steam / Wikipedia 的别名设计）：

### 1. `localized_names: Vec<GameName>` — 带语言标签的本地化名称

```rust
pub struct GameName {
    pub language: String,  // BCP-47 语言标签，如 "en", "zh-CN", "zh-TW", "ja", "ko"
    pub name: String,      // 该语言下的名称
}
```

用于存放**各语言的正式译名**：

| language | name |
| --- | --- |
| `en` | Grand Theft Auto V |
| `zh-CN` | 侠盗猎车手 V |
| `ja` | グランド・セフト・オートV |
| `ko` | 그랜드 테프트 오토 V |
| `zh-TW` | 俠盜獵車手 V |

### 2. `alternate_names: Vec<String>` — 无语言标注的别名 / 俗称

用于存放不绑定具体语言、但在玩家群体中广泛使用的**昵称、俗称、戏称**：

```
["三男一狗", "车枪大战", "GTA5", "GTAV"]
```

### 设计原则

1. **主名 `name` 不变**：始终是"默认展示名"（通常是英文原名），保证 UI 与现有逻辑不破坏。
2. **`localized_names` / `alternate_names` 均为可选扩展**：用 `#[serde(default)]` 标记，
   旧数据库记录（没有这两个字段）反序列化时自动得到空数组，**向后完全兼容**。
3. **搜索与展示分离**：`name` 用于界面默认展示；所有名称变体（主名 + 本地化名 + 别名）
   共同参与搜索（见 [搜索系统](./search.md)）。
4. **编辑入口**：游戏编辑弹窗（`GameEditModal`）提供本地化名称编辑器（语言 + 名称对，可增删）
   和别名输入框（逗号分隔）。

## 其他实体

- **`GameAction`**：启动动作。类型仅 `"File"` / `"URL"`（原版还有 `"Emulator"`，本项目已移除模拟器）。
  字段含 `path`、`arguments`、`isPlayAction`、`trackGame` 等。
- **`GameLink`**：游戏相关链接（如商店 / Wiki）。
- **`AppSettings`**：应用设置（语言、主题、启动行为、托盘、图片偏好、数据库路径等），`language` 为字符串（`en-US` / `zh-CN` / `zh-TW`）。
- **`Platform`**：平台（含 `specification_id`），内置平台在启动时播种。

## 存储

`Game` 以 JSON 形式存入 SQLite（单表）。字段变更通过 `#[serde(default)]` 保持兼容，
**无需数据库迁移**（新增字段自动以默认值读入）。
