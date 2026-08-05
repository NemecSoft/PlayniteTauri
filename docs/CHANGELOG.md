# 变更记录

## 2026-08-05

- **重构为 Cargo workspace monorepo（多项目结构，类似 .NET 解决方案）**：
  - 目录布局改为 **共享核心库 + 多个 Tauri 应用**：
    ```
    crates/yungame-core/   共享库：数据模型、db、auth、process、settings、covers、commands
    apps/desktop/          客户端 Tauri 应用（Playnite.DesktopApp.exe，frontendDist = ./dist）
    apps/admin/            管理端 Tauri 应用（Playnite.Admin.exe，frontendDist = ./dist-admin）
    ```
  - 每个 app 拥有**完全独立的 tauri.conf.json / build.rs / capabilities / icons / frontendDist**，
    各自 `tauri::generate_context!()` 只嵌入各自前端——彻底解决此前"管理端误加载客户端前端
    报 `library_stats not found`"、双窗口、cdylib GNU 链接失败等系列问题。
  - 共享业务代码集中在 `crates/yungame-core`（`run_client` / `run_admin` 工厂 + 全部命令）。
  - 新增根 `Cargo.toml` workspace（共享 release profile：thin-LTO + 16 codegen units + incremental）。
  - 前端：客户端 `vite.config.ts → dist/`，管理端 `vite.admin.config.ts → dist-admin/`（各自独立目录）。
  - `build.ps1` 支持 `-ClientOnly` / `-AdminOnly` / `-Debug`；`dev-client.bat` / `dev-admin.bat`
    提供前端 HMR + 后端增量编译的快速验证。
  - 移除旧的 `src-tauri/` 与 `src-tauri-admin/` 单 crate 结构。

- **修复：管理端窗口错误加载客户端前端导致 `library_stats not found`**：
  Tauri v2 的 `tauri.conf.json` `windows[].url` 字段在 `generate_context!`
  编译时不被用于设置窗口 URL，admin bin 默认从 frontendDist 加载 `index.html`
  （客户端），从而触发未注册命令。改为在 `run_admin()` 的 setup 中用
  `WebviewWindowBuilder` 动态创建 admin 窗口并加载 `admin/index.html`。

- **管理端独立可执行程序（Playnite.Admin.exe）**：
  - 管理端与客户端共用同一套数据模型与后端命令，但作为**独立 Tauri 程序**构建，
    输出到独立的 `admin_release/` 目录，**不随客户端发布**。
  - 新增第二个 `[[bin]] name = "admin_app"`（`src/bin_admin.rs`）、`lib.rs::run_admin()`
    与独立配置 `tauri.admin.conf.json`（productName = `Playnite.Admin`，窗口加载
    `admin/index.html`）。
  - 新增 `capabilities/admin.json`（admin 窗口权限）。
  - `package.json` 新增 `build:admin` / `dev:admin` 脚本。
  - `build.ps1` 同时构建客户端与管理端；客户端输出 `release/Playnite.DesktopApp.exe`，
    管理端输出 `admin_release/Playnite.Admin.exe`（分开目录，仅客户端随发布分发）。
  - 绿色存储定位仍按 exe 所在目录：管理端运行时放到客户端同目录即可管理同一游戏库。
  - exe 文件名保留 Playnite 字样（遗留要求），内部代码/配置/UI 统一为 YunGame 无 Playnite。

- **管理端游戏管理：支持配置启动 Action**：
  - admin 前端游戏编辑弹窗新增"启动配置"区块（类型 File/URL、路径、工作目录、参数），
    优先支持**相对路径**（游戏与 YunGame.exe 同盘，用 `.` / `..` 定位）。
  - 游戏表格新增"启动路径"列，展示每个游戏的 play action。
  - `admin/lib.ts` `Game` 增加 `actions: GameAction[]`。
  - 后端 `process.rs` `launch` 增加相对路径解析：非绝对路径以 exe 所在目录为基准
    归一化（`normalize_path`），working_dir 为空时默认取 exe 的父目录。
  - `lib.rs` 注册 admin 业务命令（admin_list_users / admin_save_user / admin_delete_user /
    admin_get_settings / admin_set_enterprise_config / admin_preview_enterprise /
    admin_set_game_level），打通 admin 前端与共享后端。

- **品牌更名 Playnite → YunGame**：去除启动页 "Playnite loading" 字样；所有用户可见名称
  （窗口标题、托盘 tooltip、菜单、公告、应用名）统一为 `YunGame`。
  - Cargo/bin/lib/package 名改为 `yungame`；绿色可执行文件输出为 `YunGame.exe`。
  - `identifier` 改为 `yungame.desktop`；`auth.rs` 的密码盐前缀 `playnite-salt::` 保留以兼容既有用户数据。
  - 更新 `index.html`、`main.tsx`、`announcement.*`、`system.rs`、`lib.rs`、`tauri.conf.json`、`build.ps1`。
  - **公告秒加载优化**：公告 HTML 改为 Vite `?raw` 静态内联进前端 bundle，弹窗打开即同步渲染，
    消除 "Loading announcement..." 中间状态（不再依赖 IPC + 文件 I/O）。

- **标签页模式界面**：主界面改为顶部标签栏导航（主页 / 视频 / 额外工具）。
  - `uiStore` 新增 `activeTab` 状态（`home` / `videos` / `tools`）与 `setTab`。
  - 新增 `TabsBar` 顶部标签栏组件；`AppBody` 在主内容区上方渲染标签栏。
  - **视频页 `VideosView`**：遍历游戏库，展示各游戏关联的 `videos` 字段（`youtube` 转为可内嵌 iframe，`file`/`url` 显示外链卡片）。
  - **额外工具页 `ToolsView`**：占位工具卡片（屏幕录制 / 游戏加速 / 游戏增强），带启用开关，功能后续逐步实现。
  - `MainContent` 按 `activeTab` 渲染对应视图；新增 i18n 三语文案。
  （[views](./design/views.md)）

## 2026-08-04

- **图片懒加载与 UI 性能优化**（千级游戏库专项）：解决启动卡死、滚动卡顿。
  - 后端新增 `read_images_batch` **一次 IPC 批量读取**多张图片 + **进程级图片缓存**
    （`OnceLock<Mutex<HashMap>>`，重复路径零读盘）+ `spawn_blocking` 后台 I/O
    （`read_image`/`read_images_batch` 改 async，文件读取不在主线程阻塞）。
  - 前端移除启动时 `preloadGameImages` **全量预加载**（`gamesStore.load` 不再预加载图片，
    主界面秒开）；`imageUrl()` 改为纯同步、不主动加载。
  - **IntersectionObserver 渐进懒加载**（`useLazyImage`，rootMargin 600px + `requestIdleCallback`
    空闲调度）→ 滚动时图片**逐张淡入**；前端 LRU blob URL 池（上限 220，超限 revoke）+ 单图并发限制。
  - 封面 `<img>` 加 `loading="lazy"`/`decoding="async"` + 淡入动画（`cover-fade-in 0.35s`）。
  - 效果：启动秒开、滚动流畅、图片逐渐出现、双缓存复用零成本。
  （[image-loading-performance](./design/image-loading-performance.md)、[covers](./design/covers.md)）
- **设置迁移到 `config.json`**：应用偏好（语言、主题、卡片大小/间距、渲染模式、企业配置路径等）
  不再存 SQLite，改为 `config.rs` 读写应用目录下的 `config.json`（漂亮的 JSON，用户可直接编辑）。
  数据库只存游戏库、用户等业务数据。首次启动自动把旧数据库设置迁移到 `config.json`。
  （[green-storage](./design/green-storage.md)）

## 2026-08-03

- **新增三份设计文档**（规划阶段，未实现代码）：
  - [修改器整合](./design/trainers.md) — `GameTrainer` 模型、`trainers/` 目录、启动/导入命令
  - [备份游戏存档（Backup Saves）](./design/backup-save.md) — `SaveBackupConfig`、本地 + 多种云途径（WebDAV/SFTP/OneDrive/Google Drive 等）存档备份/恢复
  - [图文/视频攻略整合](./design/guides.md) — `GuideSection` 章节化、`guides/` 本地库、内嵌视频

本文件按时间记录每次功能变更。格式：`日期 - 变更内容（相关文档）`。

---

## 2026-08-03

- **封面图库（CoverImages）自动匹配**：在应用目录的 `CoverImages` 目录放入图片，文件名与
  游戏中文名一致即可自动设置为封面。后端新增 `covers.rs`：扫描目录建立规范化文件名索引，
  按游戏的中文名/多名称/别名/原名多候选匹配，只填充空封面、不覆盖手动设置的封面；
  `get_games` 时自动应用并持久化。**本地图片加载改为后端 `read_image` 命令**（读取字节 +
  MIME 返回），前端用 `URL.createObjectURL(blob)` 生成 blob URL 并缓存每个文件只读一次，
  `get_games` 后批量预加载所有本地封面/背景/图标/截图。原 asset 协议方案在 Windows 绿色版
  上对绝对路径的 glob 匹配不稳定（不同 Tauri 2 patch 版本行为差异），故改为后端读取。
  新增 `imageUrl()` 统一处理本地/远程图片；设置→外观新增"封面图库"面板（目录、文件数、
  重新扫描）。**效率优化**：文件名索引缓存（目录 mtime 变化才重建）+ HashMap O(1) 查找。 **格式优先级**：同名多格式封面按 `APNG > webp > gif > jpg > png` 自动选，动画优先。
- **侧边栏自动隐藏 + 标签筛选（多选 checkbox）**：侧边栏默认收起，
  鼠标悬停左侧手柄滑出；`onMouseLeave` 自动收起（可点折叠按钮关闭）。
  标签分区用 checkbox 多选（`#第一人称 (342)` 样式），多选语义为 **AND**（游戏需同时
  包含所有选中标签才显示）；标题栏有"清空"按钮与搜索框（>6 个标签时显示）。
  （[data-models](./design/data-models.md)、[green-storage](./design/green-storage.md)、[covers](./design/covers.md)）

## 2026-08-03

- **新增 5 种界面风格**：在原有"卡通 / 赛博朋克"基础上，新增 **孟菲斯、新拟态、美国漫画、
  吉卜力、中国风** 5 套主题。均以 CSS 变量驱动（`data-theme` + `global.css` 变量块 + 各主题
  专属打磨样式，如新拟态内嵌投影、美漫粗描边、孟菲斯圆点底纹、中国风纸墨肌理等）。
  `theme.ts` 改为通用 i18n key 驱动（`labelKey`/`descKey`），`ThemesSection` 不再硬编码
  卡通/赛博朋克，预览色块与强调色可配置。切换即时生效并持久化。
  （[theming](./design/theming.md)）

## 2026-08-03

- **卡片间距设置**：`AppSettings` 新增 `cardGap`（0–20px，默认 8）。图片区域保持 **16:9** 比例
  （`grid-card .cover` 的 `aspect-ratio: 16 / 9`，图片 `object-fit: cover`），设置界面新增
  "卡片间距"滑块，实时应用到网格视图的 `gap`。（[data-models](./design/data-models.md)、[views](./design/views.md)）

## 2026-08-03

- **i18n 迁移到 i18next**：将自研轻量 i18n（React Context）迁移为 **i18next + react-i18next**，
  与 tauri-template 对齐。字典由 TS 转为 `locales/*.json`（三语 en-US / zh-CN / zh-TW），
  保留兼容的 `useI18n()` 门面（底层为 i18next），现有组件无需改动。
  （[architecture](./design/architecture.md)、[i18n](./design/i18n.md)）

- **技术栈升级**：React 18 → 19（启用 React Compiler）、Vite 5 → 8、TypeScript 5 → 6、
  Zustand 4 → 5，并引入 Tailwind CSS 4 + shadcn/ui（Radix + CVA + tailwind-merge）与
  TanStack Query 5。前端现有功能在新技术栈下编译运行正常。
  （[architecture](./design/architecture.md)）

## 2026-08-03

- **引入 AI 开发规范（CodeBuddy skills + AGENTS.md）**：借鉴 `tauri-template` 的工程体系，
  改造成适配 PlayniteTauri 的 CodeBuddy 项目级 skill（`.codebuddy/skills/`）：
  `init`（上手）、`check`（质量检查）、`cleanup`（清理）、`change-package-manager`（切包管理）。
  并新增 `AGENTS.md`（AI 助手开发规则，涵盖架构/数据模型/i18n/主题/绿色存储约定）。
  （[docs/README](./README.md)）

## 2026-08-03

- **任务栏图标去重（根治）**：任务栏出现两个图标的**真正根因**是 `tauri.conf.json` 的
  `app.trayIcon` 配置（Tauri 自动创建托盘）与 Rust 代码 `setup_tray`（手动创建托盘）**重复创建**
  了两个系统托盘图标。移除 `tauri.conf.json` 的 `trayIcon` 配置，只保留代码 `setup_tray`
  （带完整菜单与事件），即 Tauri 推荐做法——**只保留一种托盘创建方式**。
  （[green-storage](./design/green-storage.md)）

## 2026-08-03

- **自动构建**：新增 `scripts/auto-build.mjs` 监听脚本 + `auto-build.bat` 双击启动。
  源码变化后自动防抖触发完整构建并更新绿色 exe，无需手动运行。
  （[build-script](./design/build-script.md)）

## 2026-08-03

- **示例游戏**：首次启动且库为空时播种 7 款示例游戏（GTA V / 星际争霸II / 赛博朋克2077 /
  巫师3 / 艾尔登法环 / 蔚蓝 / 哈迪斯），含多名称与 URL 启动动作，便于体验搜索与视图。
  （[sample-data](./design/sample-data.md)）
- **登录系统**：启动可显示登录界面，支持微信扫码（qrcode.react）与账号密码两种方式，
  可配置是否启用、选择方式，登录状态持久化。（[login](./design/login.md)）
- **公告页面（最近新增）**：侧边栏新增"最近新增"入口，按加入时间倒序展示新增游戏动态。
  （[news](./design/news.md)）

## 2026-08-03

- **编译加速**：release profile 改为 thin-LTO + 16 codegen-units + incremental，
  依赖 opt-level=2；引入 sccache 编译缓存；`build.ps1` 自动启用并显示耗时。
  增量编译从 3 分钟+ 降至 ~49 秒。（[build-acceleration](./design/build-acceleration.md)、[build-script](./design/build-script.md)）

## 2026-08-03

- **拼音首字母搜索**：引入 `pinyin-pro`，为每个游戏构建含名称变体 + 中文首字母 + 全拼 + 元数据的
  搜索索引。输入 `xjzb` 可搜到"星际争霸"。（[search](./design/search.md)）

## 2026-08-03

- **多名称支持**：`Game` 新增 `localized_names`（带语言标签的本地化名称，如 zh-CN/zh-TW/ja/ko）
  与 `alternate_names`（无语言标注的别名/俗称，如"三男一狗""车枪大战"），改进原版 Playnite
  单名称缺陷。编辑弹窗支持录入多名称。（[data-models](./design/data-models.md)）

## 2026-08-02 ~ 2026-08-03

- **设计文档体系建立**：新增 `docs/`，含架构、数据模型、搜索、视图、主题、i18n、绿色存储、
  构建加速、构建脚本等设计文档 + 文档同步约定 + 变更记录。
  （[docs/README](./README.md)、[CONTRIBUTING](./CONTRIBUTING.md)）

## 2026-08-02

- **绿色（便携）存储**：所有数据（数据库/图片/缓存/插件）改存应用当前目录，
  不写注册表、不使用 C 盘。移除会访问 `%LOCALAPPDATA%` 的 `tauri-plugin-store`。
  窗口回退到 config 自动创建以保证前端资源加载。（[green-storage](./design/green-storage.md)）

## 2026-08-02

- **多语言**：英语 / 简体中文 / 繁體中文，切换即时生效并持久化。
  自研轻量 i18n（React Context + 三语字典）。（[i18n](./design/i18n.md)）

## 2026-08-02

- **双主题**：卡通风格 / 赛博朋克风格，CSS 变量驱动，切换即时应用并持久化。
  （[theming](./design/theming.md)）

## 2026-08-02

- **移除模拟器**：删除模拟器相关后端模块、命令、前端 UI 与数据模型。
  `GameAction` 类型仅保留 `File` / `URL`。

## 2026-08-02（项目初期）

- **项目骨架建立**：Tauri v2 + React + TypeScript + Vite + Zustand + SQLite。
  实现游戏库管理、导入（目录/Steam）、三种视图、筛选搜索、启动游戏、插件系统、
  设置界面、系统托盘。（[architecture](./design/architecture.md)）
