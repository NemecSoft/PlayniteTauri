# 整体架构设计

## 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 桌面框架 | **Tauri v2** | WebView2（Windows）承载前端，Rust 负责后端与系统能力 |
| 后端 | Rust（MSVC 工具链） | `x86_64-pc-windows-msvc`，由根目录 `rust-toolchain.toml` 强制指定 |
| 前端 | React 19（React Compiler）+ TypeScript 6 + Vite 8 | 构建产物嵌入各 Tauri 应用二进制 |
| 状态管理 | Zustand 5（UI）+ TanStack Query 5（服务端） | 分工明确 |
| UI 样式 | **纯手写 CSS**（`global.css`，CSS 变量 + `[data-theme]` 多主题） | 不使用 Tailwind/shadcn |
| 存储 | SQLite（rusqlite） | 游戏库 / 用户 / 设置 / 平台 / 插件元数据 |
| 国际化 | i18next + react-i18next | 英语(en) / 简体中文(zh-CN) / 繁體中文(zh-TW) |
| 图标 | lucide-react | |

> **UI 栈说明**：早期曾用 shadcn/ui + Tailwind，后因 Tailwind 4 preflight 冲突导致黑屏，已全部移除
> （`package.json` 中的相关依赖也已彻底清除），改为 `global.css` 纯 CSS 变量驱动多主题。
> 不要新增 Tailwind 工具类、shadcn/Radix 组件或 sonner 依赖。

## 多项目（Monorepo）结构

项目采用 **Cargo workspace + 共享核心库 + 多个 Tauri 应用** 的 monorepo 布局（类似 .NET 解决方案）：

```
crates/yungame-core/   共享核心库（数据模型、db、auth、process、settings、covers、commands）
apps/desktop/          客户端 Tauri 应用（Playnite.DesktopApp.exe，嵌入 ./dist 前端）
apps/admin/            管理端 Tauri 应用（Playnite.Admin.exe，嵌入 ./dist-admin 前端）
```

- **共享代码**集中在 `crates/yungame-core`，提供 `run_client` / `run_admin` 两个 Builder 工厂。
- **每个应用有完全独立的 `tauri.conf.json` / `build.rs` / `capabilities` / `icons` / `frontendDist`**，
  各自调用 `tauri::generate_context!()`，**只嵌入各自的前端**。这从根本上避免"管理端误加载客户端前端"、
  双窗口、cdylib 链接失败等系列问题。
- 数据目录（绿色存储）：默认按 exe 所在目录定位；**debug 构建**（`tauri dev`）固定指向项目根 `release/`，
  使开发与发布访问同一份数据。

## 模块划分

### 共享核心库（`crates/yungame-core/src/`）

| 模块 | 职责 |
| --- | --- |
| `lib.rs` | `AppState`（DB、进程管理、插件宿主）、`run_client` / `run_admin` Builder 工厂、命令注册 |
| `models.rs` | 数据模型（`Game`、`GameName`、`GameAction`、`AppSettings`、`Platform` 等） |
| `db.rs` | SQLite 数据访问层（CRUD、序列化） |
| `auth.rs` | 登录 / 权限（用户等级）/ 企业用户解析 |
| `library.rs` | 目录扫描（识别可执行文件）、Steam 库导入 |
| `process.rs` | 进程启动（含相对路径解析）、游玩时长追踪 |
| `plugins.rs` | 插件发现与库插件元数据 |
| `settings.rs` | ★ 应用路径（绿色，指向 exe 所在目录） |
| `covers.rs` | 封面图库匹配 + 图片读取 |
| `game_server.rs` | 静态详情页容器（`axum` + `tower-http::ServeDir`，见 [game-detail](./game-detail.md)） |
| `autotags.rs` / `config.rs` / `sample_data.rs` / `system.rs` | 自动标签 / 配置 / 示例数据 / 系统命令 |
| `commands/` | Tauri 命令模块（games / auth / admin / covers / library / settings / plugins / system / tags / announcement / game_html） |

### 应用壳（`apps/desktop`、`apps/admin`）

每个 app 只有：
- `src/main.rs`：调用 `yungame_core::run_client(ctx)` 或 `run_admin(ctx)`（ctx 来自各 app 自己的 `generate_context!`）
- `tauri.conf.json`：productName、窗口、frontendDist（客户端 `../../dist`，管理端 `../../dist-admin`）
- `capabilities/` / `icons/` / `build.rs`

### 前端（`src/` 客户端、`admin/src/` 管理端）

| 目录 | 职责 |
| --- | --- |
| `src/api/client.ts` | 封装所有 `invoke` Tauri 命令调用 |
| `src/stores/` | Zustand 状态（games / settings / library / ui） |
| `src/components/` | UI 组件（顶部标签栏、侧边栏、工具栏、视图、设置、编辑弹窗等） |
| `src/utils/` | 纯逻辑：分组排序（selectors）、**搜索（search，含拼音）**、主题（theme） |
| `src/i18n/` | 国际化配置 + `locales/` 三语字典 |
| `src/types/` | TypeScript 数据模型（与后端 `models.rs` 对应） |
| `src/styles/` | 全局样式，**CSS 变量驱动多主题** |
| `admin/src/` | 管理端独立前端（游戏管理 / 用户管理 / 企业配置） |

## 数据流

```
React UI (src/components)
    │  Tauri command (invoke)
    ▼
Rust command (crates/yungame-core/src/commands/*.rs)
    │
    ▼
AppState (Mutex<Database>, ProcessManager, Mutex<PluginHost>)
    │
    ▼
SQLite (library/library.db)  /  进程启动  /  文件系统
```

前端不直接接触数据库；所有读写经 Tauri 命令走 Rust 后端。状态在 React 侧用 Zustand 维护，由命令返回结果驱动更新。

## 关键设计决策

1. **DB 用 `Mutex` 包裹**：`rusqlite::Connection` 是 `Send` 但非 `Sync`，放进 Tauri 共享状态需用 `Mutex` 提供内部可变性。
2. **插件宿主也用 `Mutex`**：`PluginHost::discover(&mut self)` 需要可变访问。
3. **完全绿色存储**：`settings.rs` 用 `std::env::current_exe()` 定位 exe 目录作为数据根，所有数据（DB/图片/缓存/插件/WebView2 用户数据）都存 exe 旁，不写 `%LOCALAPPDATA%`、不写注册表。
4. **窗口由 `tauri.conf.json` 自动创建**：保证嵌入前端资源（`frontendDist`）正确加载，避免手动创建窗口时 URL 选择错误导致的 `localhost` 问题。
5. **前端相对路径（`base: "./"`）**：管理端前端构建到独立目录 `dist-admin/`，用相对 `base`，保证资源在 `tauri://localhost` 下可解析。
6. **每个 Tauri 应用独立嵌入前端**：这是 monorepo 的核心价值——客户端/管理端各自只嵌入各自前端，彻底隔离。
