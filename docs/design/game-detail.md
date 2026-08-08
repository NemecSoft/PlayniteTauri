# 游戏静态详情页（Game_Details 容器）

## 目标

在客户端详情页（`/game/:id`）提供一个**通用静态网站容器**——任何 `Game_Details/<游戏名>/index.html`
及其 `css/`、`js/`、`images/`、`videos/` 等子资源都能在 webview iframe 中**原样加载**，
无内联、无补丁。游戏方只管往目录里放一个标准 HTML 站点；客户端负责把它正确、完整地渲染出来。

## 设计原则：优先使用已有成熟方案

本功能在设计上遵循项目级准则（见 [CONTRIBUTING](../CONTRIBUTING.md) 与 [AGENTS.md](../../AGENTS.md)）：

> **优先使用已有的成熟方案**，不要为局部需求手写底层实现。

服务器、协议、文件 IO 等基础设施一律复用生态成熟 crate，自研代码只负责
**把成熟方案接到本项目的数据模型与目录约定**。这是项目开发准则（AI 助手及人类开发者都适用）。

历史教训：详情页容器最早手写了基于 `std::net::TcpListener` 的 HTTP/TLS/解析/响应（GET、HEAD、
MIME、Range、路由全部自实现），结果是边界情况多、缺 Range（视频无法 seek）、HEAD 返 405
导致前端 `XMLHttpRequest HEAD` 探测误判视频不存在——基本的能力短板。该手写实现**已全部删除**。

## 架构

```
┌──────────────────┐  invoke 'get_game_server_url' / 'get_game_html_page'  ┌────────────────────┐
│  GameDetailPage  │ ────────────────────────────────────────────────────▶ │ yungame-core      │
│  (React)         │ ◀──── base_url, {name, found} ──────────────────────  │   GameServer      │
└──────────────────┘                                                       │ ┌────────────────┐ │
         │                                                                  │ │ axum::serve    │ │
         │ iframe src = `${base}/games/<name>/index.html`                    │ │   └─ Router    │ │
         ▼                                                                  │ │       └─ nest  │ │
┌──────────────────┐   HTTP (GET/HEAD + Range)    ┌────────────────────┐   │ │           /games│ │
│  webview iframe  │ ────────────────────────────▶│  loopback HTTP     │◀──┤ │           ServeDir│ │
│  (任意 HTML 站)  │ ◀──── 200 / 206 Partial ──── │  127.0.0.1:<port>  │   │ │           (root:  │ │
└──────────────────┘                              └────────────────────┘   │ │            Game_  │ │
                                                                          │ │            Details)│ │
                                                                          │ └────────────────┘ │
                                                                          └────────────────────┘
```

- **`GameServer`**（`crates/yungame-core/src/game_server.rs`）启动一个**仅本机回环**
  的 HTTP 服务器，端口临时分配。
- 服务器**核心 = `tower_http::services::ServeDir`**（搭配 `axum::Router::nest_service`），
  直接挂载到 `/games`，物理根目录指向 `AppPaths::games_html_dir()`（即
  `config_root()/Game_Details`）。
- 前端 `GameDetailPage` 调用 `get_game_server_url` 拿到 `base_url`，
  把 `iframe.src = ${base_url}/games/${encodeURIComponent(game.name)}/index.html`
  —— **完全通用**，所有 `<link>`/`<script>`/`<img>`/`<video>` 的相对路径都由 ServeDir 自动解析。

## URL ↔ 目录映射

| URL | 文件 |
| --- | --- |
| `<base>/games/Kenshi剑士/` | `Game_Details/Kenshi剑士/index.html`（自动索引） |
| `<base>/games/Kenshi剑士/css/style.css` | `Game_Details/Kenshi剑士/css/style.css` |
| `<base>/games/Kenshi剑士/videos/实况1.mp4` | `Game_Details/Kenshi剑士/videos/实况1.mp4` |
| `<base>/games/Kenshi剑士/...` | `Game_Details/Kenshi剑士/...` |

`ServeDir` 负责 URL 百分号解码、路径穿越防护、目录索引（`append_index_html_on_directories`），
本项目**不重复造这些轮子**。

## 为什么是 `axum` + `tower-http::ServeDir`

对比过的成熟方案：

1. **`axum` + `tower-http::services::ServeDir`**（**采用**）——
   Rust 生态静态文件服务的**标准答案**。
   内置 **HTTP Range / 206 Partial Content**（视频播放与 seek 必需）、
   GET / HEAD、正确 MIME（含 `video/mp4`、`font/woff2`、`application/javascript` 等）、
   流式输出大文件（不读全文件到内存）、`If-Modified-Since` 缓存、路径穿越防护。
   `axum::Router::nest_service` 直接把它当作 `tower::Service` 挂载，零胶水。
2. 手写 `std::net::TcpListener` + 手写 HTTP 解析（**已弃用**）—— 缺 Range、HEAD 405、
   大文件整文件读内存；维护成本高，bug 多。
3. `hyper-staticfile`（hyper 系）—— 也支持 Range，但生态更新与文档不如 `tower-http`。
4. `actix-files` —— 仅 actix-web 可用，本项目不引 actix。
5. 完整 `axum` 路由 + 自实现 Range —— 与方案 1 相比无任何收益，徒增代码。

**选方案 1**：理由——这是 Rust 服务端目前**最成熟、最广泛使用**的静态文件栈；
Tauri 2 本身基于 tokio，无运行时冲突；实现只需 ~15 行核心代码（见 `game_server.rs`），
把所有 HTTP 边界情况交给已被生产检验过的 crate。

## 动态视频列表 API（`/api/videos`）

静态服务之外，还提供一个**动态 JSON API**，让详情页能"只把视频丢进 `videos/` 目录"就自动
渲染出播放列表（含子文件夹分栏），无需手写 `<video>` 标签。这复刻了早期用于测试的 Node
`server.js` 的行为，但用 axum 路由实现在同一个自包含服务器上。

### 请求

```
GET <base>/api/videos?dir=<游戏目录名>
```

- `dir`：定位 `Game_Details/` 下游戏目录的路径。详情页直接传自身
  `location.pathname` 去掉 `index.html` 后的部分（如 `/games/Kenshi剑士/`）；
  也兼容裸目录名（`Kenshi剑士`）。
- 支持多种形式：`/games/Kenshi剑士/`、`games/Kenshi剑士`、`/Kenshi剑士`、`Kenshi剑士`。

### 响应（`application/json`）

```json
{
  "root": ["攻略1.mp4", "实况2.mp4"],
  "dirs": [
    { "name": "01游览攻略1", "files": ["01游览攻略1/01.mp4", "01游览攻略1/02.mp4"] },
    { "name": "02测试2",     "files": ["02测试2/a.mp4"] }
  ]
}
```

- `root`：`videos/` 根目录下的视频文件。
- `dirs`：`videos/` 下含视频的子文件夹（`files` 为带前缀的相对路径）。
- **自然排序**：数字段按数值（`实况2` < `实况10`），ASCII 在前、中文在后。
- 视频扩展名：`.mp4` `.webm` `.ogv` `.mov` `.m4v` `.mkv` `.flv` `.avi`。
- 目录不存在 → 返回空列表（`{ "root": [], "dirs": [] }`）。

### 安全

- 只允许列出 `Game_Details/<dir>/videos/`；`..` 段 / 绝对路径 / 空 `dir` 一律
  **403**，确保不能越界读取 `Game_Details` 之外的目录。

### 实现

- `crates/yungame-core/src/game_server.rs` 的 `api_videos` axum handler：
  复用 `axum::extract::Query` 解析 `dir`，`std::fs::read_dir` 扫描，`serde_json::json!`
  构造响应。核心约 60 行，不引入新依赖。
- 路由与 `ServeDir` 共存于同一 `Router`：
  ```rust
  Router::new()
      .route("/api/videos", get(api_videos))   // 动态 API
      .nest_service("/games", ServeDir::new(root));  // 静态文件
  ```
- 前端消费示例（`Kenshi剑士/js/main.js`）：`fetch("/api/videos?dir=" + pageDir)` →
  渲染 `renderGroup()` + DPlayer。这是"任意静态站点容器"能力的自然延伸——动态能力
  与静态文件共用同一 URL 根，页面用相对路径即可访问。

## 关键能力（开箱即用，由 ServeDir 提供）

| 能力 | 用途 | 来源 |
| --- | --- | --- |
| `GET` / `HEAD` | 前端 HEAD 探测、本地浏览器外链 | `ServeDir` |
| **HTTP Range / 206 Partial Content** | `<video>` 播放 / seek / 拖动（DPlayer、原生 `<video>`） | `ServeDir` |
| MIME 探测（含 `video/mp4`） | `<source>`/`<video>`/`<link>` 自动识别 | `ServeDir` |
| 流式文件输出 | 大视频不爆内存、不阻塞 | `ServeDir`（底层用 `tokio::fs::File`） |
| 路径百分号解码（CJK） | `Kenshi剑士` 等中文目录名 | `ServeDir` |
| 路径穿越防护 | 防 `..` 越界读 `Game_Details` 之外的文件 | `ServeDir` |
| `If-Modified-Since` 304 | 减少重复下载 | `ServeDir` |
| `append_index_html_on_directories` | `/games/<名>/` 自动返 `index.html` | `ServeDir` |

## 运行模型

- `GameServer::start(root)` 在 `build_client` 里调用，绑定 `127.0.0.1:0`（随机端口），
  `set_nonblocking(true)` 后用 `tokio::net::TcpListener::from_std` 转 tokio listener。
- 在**独立 `std::thread`** 里跑**自建 `tokio` runtime**（不依赖 Tauri async_runtime 初始化时序），
  `block_on(axum::serve(listener, app))`。
- `base_url` 存入 `AppState.game_server`，通过 `get_game_server_url` 命令暴露给前端。
- 进程存活期由 `GameServer._handle: JoinHandle` 持有（结构体随 `AppState` 活到应用退出）。

## 用户添加资料的流程

1. 在数据目录 `Game_Details/<游戏名>/` 放任意标准 HTML 站点：
   ```
   Game_Details/Kenshi剑士/
   ├── index.html
   ├── css/style.css
   ├── js/main.js
   ├── images/hero.jpg
   └── videos/实况1.mp4
   ```
2. 客户端点开 Kenshi 详情 → `iframe` 自动通过 `http://127.0.0.1:<port>/games/Kenshi剑士/index.html` 加载；
   视频/图片/字体/脚本**按真实 HTTP 协议**加载（含 Range/MIME），行为与
   "浏览器打开同一 index.html"完全一致。

## 前端契约（`GameDetailPage.tsx`）

- `get_game_server_url()` → `base_url: string`（空字符串表示服务器未启动）。
- `get_game_html_page(name)` → `{ name, found }`（仅判断 `index.html` 是否存在；不读文件字节）。
- `iframe.src = ${baseUrl}/games/${encodeURIComponent(game.name)}/index.html`
- iframe 带 `allowFullScreen` + `allow="fullscreen; autoplay; encrypted-media; picture-in-picture"`，
  否则跨源 iframe 内的播放器（DPlayer / `<video>` / YouTube 嵌入）调用 `requestFullscreen()`
  会被浏览器拦截，导致**全屏按钮无效**。这是"任意静态站点"容器必须授予的权限。
- 三态：`loading`（转圈）/ `found`（返回按钮 + 全屏 iframe）/ `missing`（返回按钮 + 404）。

## 相关文件

- 后端：`crates/yungame-core/src/game_server.rs`（`ServeDir` 封装，约 70 行）
- 命令：`crates/yungame-core/src/commands/game_html.rs`（`get_game_html_page`、`get_game_server_url`）
- 前端：`src/pages/GameDetailPage.tsx`、`src/api/client.ts`
- 路径常量：`crates/yungame-core/src/settings.rs::AppPaths::games_html_dir`
- 资料页样例：`release/Game_Details/赛菲莉娅-网吧联机版/`、`release/Game_Details/GYLT/`、`release/Game_Details/Kenshi剑士/`