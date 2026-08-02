# PlayniteTauri

用 **Tauri v2**（Rust 后端 + React + TypeScript + Vite 前端）对原版 Playnite 游戏库管理器进行的完整复刻。最终绿色可执行文件命名为 `Playnite.DesktopApp.exe`，与原版一致。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Tauri v2（WebView2 / Rust） |
| 后端 | Rust 1.95（MSVC 工具链） |
| 前端 | React 19（React Compiler）+ TypeScript 6 + Vite 8 |
| 状态管理 | Zustand 5（UI 状态）+ TanStack Query 5（服务端状态） |
| UI 组件 | shadcn/ui + Tailwind CSS 4 + Radix |
| 图标 | lucide-react |
| 存储 | SQLite（rusqlite） |
| 国际化 | 自研轻量 i18n（React Context），支持 English / 简体中文 / 繁體中文 |

## 已实现功能

- **游戏库管理**：游戏的增删改查、收藏、隐藏、安装状态、游玩时长
- **多名称**：一款游戏支持主名称 + 多语言本地化名称（localizedNames）+ 别名/俗称（alternateNames），改进原版 Playnite 单名称缺陷
- **拼音首字母搜索**：输入 `xjzb` 可搜到"星际争霸"，支持中文首字母与全拼
- **导入**：目录扫描（自动识别可执行文件）、Steam 库导入
- **三种视图**：网格视图（封面卡片）、列表视图、详情视图，支持分组与排序
- **筛选与搜索**：实时搜索、收藏/已安装筛选、隐藏游戏切换、按平台/类型分组
- **启动游戏**：文件 / URL 两类启动动作，进程追踪与游玩时长累计
- **插件系统**：从 `extensions/plugins` 发现库插件
- **设置界面**：通用 / 外观 / 主题 / 游戏库 / 插件 多分区设置
- **系统集成**：自定义标题栏、系统托盘、窗口最小化/关闭到托盘
- **多语言**：英语 / 简体中文 / 繁體中文，切换即时生效并持久化（设置 → 通用 → 语言）
- **双主题**：卡通风格 / 赛博朋克风格，即时切换（设置 → 主题）
- **登录系统**：可配置启动登录，支持微信扫码 / 账号密码两种方式（设置 → 登录）
- **公告页面**：最近新增游戏动态（侧边栏"最近新增"）
- **示例游戏**：首次启动自动播种示例游戏，开箱即可体验
- **完全绿色**：数据全存应用目录，不写注册表、不用 C 盘

> 📚 详细设计见 [docs/](./docs/README.md)（架构、数据模型、搜索、主题、i18n、绿色存储、构建等）。

## 目录结构

```
PlayniteTauri/
├─ src/                      # React 前端
│  ├─ api/                   # Tauri 命令调用封装
│  ├─ components/            # UI 组件（视图、设置、导入向导、右键菜单）
│  ├─ stores/                # Zustand 状态管理
│  ├─ styles/                # 全局样式（CSS 变量驱动多主题）
│  ├─ types/                 # TypeScript 数据模型
│  ├─ i18n/                  # 多语言（en / zh-CN / zh-TW）
│  └─ utils/                 # 分组、排序、选择逻辑 + 拼音搜索（search.ts）
├─ src-tauri/                # Rust 后端
│  ├─ src/
│  │  ├─ commands/           # Tauri 命令（游戏/库/设置/插件/系统）
│  │  ├─ db.rs               # SQLite 数据访问
│  │  ├─ library.rs          # 目录扫描与 Steam 导入
│  │  ├─ process.rs          # 进程启动与游玩追踪
│  │  ├─ plugins.rs          # 插件发现
│  │  ├─ settings.rs         # 绿色路径（exe 目录）
│  │  └─ lib.rs / main.rs    # Tauri 入口与状态
│  ├─ Cargo.toml             # 优化 release profile（thin-LTO + incremental）
│  ├─ .cargo/config.toml     # 并行编译
│  └─ tauri.conf.json        # productName = Playnite.DesktopApp
├─ docs/                     # 设计文档（每次修改同步更新）
├─ scripts/auto-build.mjs    # 自动构建监听脚本
├─ auto-build.bat            # 双击启动自动构建
├─ build.ps1                 # 构建脚本（sccache 加速，生成绿色 exe）
└─ release/                  # 构建产物（Playnite.DesktopApp.exe）
```

## 环境要求

- Windows 10/11（系统自带 WebView2 运行时）
- Rust 工具链，推荐 **MSVC** 目标（`x86_64-pc-windows-msvc`），已通过 `rust-toolchain.toml` 指定
- Node.js 18+

## 构建（绿色版）

### 自动构建（推荐，无需手动）

修改代码后**自动重新构建**绿色 exe，无需每次手动运行：

```powershell
# 双击 auto-build.bat 启动（最简单），或：
npm run auto-build
```

启动后脚本监听源码变化，防抖后自动执行完整构建并更新 `release\Playnite.DesktopApp.exe`。
按 `Ctrl+C` 停止。

### 手动构建

```powershell
# 优化 Release 版（默认，推荐分发）
.\build.ps1

# Debug 版（调试用）
.\build.ps1 -Debug
```

构建完成后，绿色可执行文件位于 `release\Playnite.DesktopApp.exe`，可直接双击运行，无需安装。

> **注意**：必须使用 `build.ps1` / `auto-build` / `cargo tauri build --no-bundle` 构建。
> 不要直接用 `cargo build`，因为它不会重新构建前端资源，生成的 exe 会尝试从 dev server
> （`localhost:1420`）加载界面，导致 "无法访问此页面 / 连接被拒绝" 错误。

## 开发

```powershell
npm install
npm run tauri dev
```

## 说明

- **完全绿色（便携）运行**：应用自身数据（数据库、图片缓存、插件目录）都存储在应用当前目录（exe 旁边），**不写入注册表，不使用 C 盘 / `%LOCALAPPDATA%`**。拷贝整个 `release` 文件夹即可随处运行。
  - `library/library.db` — 游戏库数据库
  - `library/images` — 封面/背景图片
  - `cache` — 元数据缓存
  - `extensions/plugins` — 插件目录
  - （注：WebView2 运行时用户数据由 Tauri 管理，详见 [green-storage](./docs/design/green-storage.md) 兼容性说明）
- 原版 Playnite 是一个约 1000+ 源文件的大型项目，此处复刻了其核心架构与主要功能（游戏库、导入、视图、启动、插件、设置），采用 Tauri 推荐的技术栈。
- 完整设计文档见 [docs/](./docs/README.md)；变更记录见 [docs/CHANGELOG.md](./docs/CHANGELOG.md)。
- AI 开发规范见 [AGENTS.md](./AGENTS.md)；CodeBuddy 项目级 skill 位于 `.codebuddy/skills/`（`init` / `check` / `cleanup` / `change-package-manager`）。
