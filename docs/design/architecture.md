# 整体架构设计

## 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 桌面框架 | **Tauri v2** | WebView2（Windows）承载前端，Rust 负责后端与系统能力 |
| 后端 | Rust 1.95（MSVC 工具链） | `x86_64-pc-windows-msvc`，由 `rust-toolchain.toml` 强制指定 |
| 前端 | React 19（React Compiler）+ TypeScript 6 + Vite 8 | 构建产物嵌入 Rust 二进制 |
| 状态管理 | Zustand 5（UI）+ TanStack Query 5（服务端） | 分工明确 |
| UI 组件 | shadcn/ui + Tailwind CSS 4 + Radix | 组件库基础 |
| 存储 | SQLite（rusqlite） | 游戏库 / 设置 / 平台 / 插件元数据 |
| 国际化 | i18next + react-i18next | 英语(en-US) / 简体中文(zh-CN) / 繁體中文(zh-TW) |
| 图标 | lucide-react | |

## 模块划分

### 后端（`src-tauri/src/`）

| 模块 | 职责 |
| --- | --- |
| `lib.rs` | Tauri 应用入口、`AppState`（共享状态：DB、进程管理、插件宿主）、窗口与托盘、命令注册 |
| `main.rs` | 二进制入口，调用 `lib::run()` |
| `models.rs` | 数据模型（`Game`、`GameName`、`GameAction`、`AppSettings`、`Platform` 等） |
| `db.rs` | SQLite 数据访问层（CRUD、序列化） |
| `library.rs` | 目录扫描（识别可执行文件）、Steam 库导入 |
| `process.rs` | 进程启动、游玩时长追踪 |
| `plugins.rs` | 插件发现与库插件元数据 |
| `settings.rs` | 应用路径（完全绿色，指向 exe 所在目录） |
| `system.rs` | 系统命令（窗口控制） |
| `commands/` | Tauri 命令模块（games / library / settings / plugins / system） |

### 前端（`src/`）

| 目录 | 职责 |
| --- | --- |
| `api/client.ts` | 封装所有 `invoke` Tauri 命令调用 |
| `stores/` | Zustand 状态（games / settings / library / ui） |
| `components/` | UI 组件（标题栏、侧边栏、工具栏、视图、设置、导入向导、右键菜单、编辑弹窗） |
| `utils/` | 纯逻辑：分组排序（selectors）、**搜索（search，含拼音）**、主题（theme） |
| `i18n/` | 国际化：`index.tsx`（Context + hook）+ `locales/` 三语字典 |
| `types/` | TypeScript 数据模型（与后端 `models.rs` 对应） |
| `styles/` | 全局样式，**CSS 变量驱动多主题** |

## 数据流

```
React UI (src/components)
    │  Tauri command (invoke)
    ▼
Rust command (commands/*.rs)
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
