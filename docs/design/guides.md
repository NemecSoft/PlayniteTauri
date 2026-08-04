# 图文 / 视频攻略（Guides & Walkthroughs）整合设计

## 目标

在游戏详情页整合**攻略内容**，覆盖两类：
1. **图文攻略**：文字说明 + 配图（支持本地图片、远程图片、GIF）
2. **视频攻略**：内嵌视频（YouTube / 本地文件 / 通用视频 URL）播放

让用户在同一个页面看完攻略，无需切换浏览器。

## 现状与基础

`Game` 已具备与攻略相关的**部分字段**：

```rust
pub guide: Option<String>,       // HTML 图文攻略（详情页已渲染）
pub screenshots: Vec<String>,    // 截图/图库（支持 gif/png/jpg）
pub videos: Vec<GameVideo>,      // 视频（youtube / file / url 三态）
pub links: Vec<GameLink>,        // 外部链接
```

`GameVideo` 已支持三种来源：
- `type = "youtube"` → YouTube 嵌入播放
- `type = "file"`   → 本地/远程视频文件（`<video>` 标签）
- `type = "url"`    → 通用视频 URL

因此**图文攻略（guide HTML + screenshots）与视频攻略（videos）的基础能力已存在**，
本设计聚焦于：**结构化组织**、**数据来源整合**（含本机攻略文件库）、**更完善的多媒体编辑入口**。

## 现状缺口

1. `guide` 是**单一 HTML 字符串**，无法表达"攻略集"（多个章节/分页）。
2. 图片来源分散（screenshots 是平铺数组，无"配图到具体步骤"的结构）。
3. 视频与图文攻略之间无关联（各自独立）。
4. 没有"从本地攻略目录自动导入"的能力。

## 设计扩展

### A. 结构化攻略集（`guide` → 多章节）

将单一 `guide` 升级为**可选的章节化攻略集**（向后兼容，`guide` 字段保留作为"总览 HTML"）：

```rust
/// One guide chapter (e.g. "主线第三章", "全收集").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GuideSection {
    pub id: String,
    pub title: String,              // 章节标题
    /// Rich text (markdown or HTML) of this section.
    pub content: String,
    /// Inline images referenced in this section (relative to guide asset dir).
    #[serde(default)]
    pub images: Vec<String>,
    /// Videos embedded in this section.
    #[serde(default)]
    pub videos: Vec<GameVideo>,
    /// Where it came from: "local" or a source site name.
    #[serde(default)]
    pub source: String,
}

// In Game:
#[serde(default)]
pub guide_sections: Vec<GuideSection>,   // 章节化图文+视频攻略
```

- `guide`（总览 HTML）+ `guide_sections`（章节数组）**并存**，均渲染于详情页"攻略"分区
- 章节支持折叠/侧边目录导航

### B. 本地攻略文件库（绿色存储，复用 CoverImages 哲学）

```
release/
├─ guides/
│  ├─ <gameId>/
│  │  ├─ section1.md            ← 纯文本/ Markdown 攻略
│  │  ├─ section2.md
│  │  ├─ images/
│  │  │  ├─ boss01.png          ← 配图（本地图片）
│  │  │  └─ step03.gif
│  │  └─ videos/
│  │     ├─ guide1.mp4          ← 本地视频攻略
│  │     └─ ...
│  └─ ...
```

- `AppPaths::guides_dir()` = `config_root()/guides/<gameId>/`
- 用户可直接放入 `.md` 攻略与 `images/`、`videos/` 目录
- 后端 `import_guides(game_id)` 扫描该目录，自动解析成 `GuideSection[]` 写入 DB
- 本地图片/视频通过已有的 `read_image` / 新增 `read_video` 命令以 blob URL 渲染

### C. 在线攻略导入（可选扩展）

预留"从攻略网站/API 导入"扩展点：
- 后端新增抓取命令（如 BiliBili / Steam Guides / 攻略站），解析标题、正文、配图 URL
- 写入 `guide_sections`，图片走 HTTP URL（前端已支持远程图片）
- `source` 字段标记来源，UI 显示"来自 XXX"

## 后端命令

| 命令 | 作用 |
| --- | --- |
| `get_guide(game_id)` | 返回该游戏 `guide` + `guide_sections` |
| `save_guide(game_id, guide, sections)` | 保存图文/视频攻略 |
| `import_guides_from_folder(game_id)` | 扫描 `guides/<gameId>/` 目录自动导入 `.md` + 图片 + 视频 |
| `read_video(path)` | 返回本地视频字节 + MIME（或支持 range 请求便于拖动播放） |
| `delete_guide_section(game_id, section_id)` | 删除某个攻略章节 |

### 视频播放实现

- **YouTube**：iframe 嵌入（现有 `GameVideo` 已支持）
- **本地视频**：后端 `read_video` 提供流式/分段读取，前端 `<video controls src=blobUrl>` 播放
- **远程视频**：直接 `<video controls src="https://...">`

## 前端 UI（详情页 "攻略" 分区）

- **总览**：渲染 `guide` HTML（现有能力）
- **章节导航**：左侧列出 `guide_sections` 标题，点击切换；右侧渲染章节内容
- **图文混排**：章节内 `content`（markdown/HTML）+ 内联 `images`（blob/远程 URL，支持 GIF）
- **视频嵌入**：章节内的 `videos` 或独立"视频攻略"子区，内嵌播放器
- **编辑**：提供攻略编辑器（标题 + 内容 + 添加配图/视频），本地图片经文件选择器导入
- **导入**：详情页提供"从攻略目录导入"按钮，调用 `import_guides_from_folder`

## 效率与安全

1. **懒加载**：`get_guide` 只在进入详情页时调用，不随 `get_games` 批量返回。
2. **本地资源复用 blob 缓存**：图片复用 `read_image` + blob URL 缓存；视频用流式读取避免整文件载入内存。
3. **本地文件库完全离线可控**：不依赖任何在线攻略站，数据由用户掌控（与 CoverImages / trainers 一致）。
4. **来源可追溯**：`guide_sections` 可选记录 `source`（本地/在线站点），便于管理。
