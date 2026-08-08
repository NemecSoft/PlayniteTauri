# PlayniteTauri

用 **Tauri v2**（Rust 后端 + React 19 前端）对原版 Playnite 游戏库管理器的完整复刻与再设计。

它并非原版的一比一复刻，而是参考 Playnite 等同类工具的理念，实现了大量自有设计与特性：多名称、拼音搜索、多语言、多主题、登录、公告、示例游戏、封面图库（CoverImages）、绿色（便携）存储、用户权限管理、自动构建等。

最终绿色可执行文件命名为 `Playnite.DesktopApp.exe`（客户端），免安装、可随处携带运行；
管理端为独立的 `Playnite.Admin.exe`，与客户端共享同一套数据模型与绿色数据库，但**不随客户端发布**。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | **Tauri v2**（Windows WebView2 / Rust） |
| 后端 | Rust（MSVC 工具链，`x86_64-pc-windows-msvc`，由 `rust-toolchain.toml` 强制指定） |
| 前端 | **React 19（React Compiler）** + **TypeScript 6** + **Vite 8** |
| 状态管理 | Zustand 5（UI 状态）+ TanStack Query 5（服务端状态） |
| UI 样式 | **纯手写 CSS**（`src/styles/global.css`，CSS 变量 + `[data-theme]` 驱动多主题） |
| 国际化 | **i18next + react-i18next**（`locales/*.json` 三语字典） |
| 搜索 | `pinyin-pro`（拼音首字母）+ `qrcode.react`（登录二维码） |
| 存储 | **SQLite**（rusqlite，游戏库 / 用户等业务数据）+ **`config.json`**（应用偏好） |
| 图标 | lucide-react |

> **UI 栈说明**：曾引入 shadcn/ui + Tailwind，因 Tailwind 4 preflight 冲突导致黑屏，已全部移除，
> 相关依赖也已彻底从 `package.json` 清除。请勿新增 Tailwind 工具类、shadcn/Radix 组件或 sonner 依赖，
> UI 继续使用 `global.css`（CSS 变量驱动多主题）。

---

## 已实现功能

### 游戏库
- **游戏管理**：游戏的增删改查、收藏、隐藏、安装状态、游玩时长累计
- **多名称**：一款游戏支持主名称 + 多语言本地化名称（`localizedNames`）+ 别名/俗称（`alternateNames`），改进原版 Playnite 单名称缺陷
- **导入**：目录扫描（自动识别可执行文件）、Steam 库导入
- **三种视图**：网格视图（封面卡片）、列表视图、详情视图，支持分组与排序
- **筛选与搜索**：实时搜索、收藏/已安装筛选、隐藏游戏切换、按平台/类型分组、标签多选过滤（AND 语义）
- **启动游戏**：文件 / URL 两类启动动作，进程追踪与游玩时长累计

### 搜索
- **拼音首字母搜索**：输入 `xjzb` 即可搜到"星际争霸"，支持中文首字母与全拼
- 搜索覆盖主名称 + 多名称 + 别名 + 元数据的完整索引

### 封面与媒体
- **封面图库（CoverImages）自动匹配**：在应用目录的 `CoverImages` 放入图片，文件名与游戏中文名一致即自动设置为封面；按中文名/多名称/别名/原名多候选匹配，只填充空封面；同名多格式按 `APNG > webp > gif > jpg > png` 优先级自动选（动画优先）
- **图片性能优化**（千级游戏库专项）：IPC 批量读取 + 进程级图片缓存 + `spawn_blocking` 后台 I/O + IntersectionObserver 渐进懒加载 + 前端 LRU blob URL 池 → 启动秒开、滚动流畅、图片逐张淡入

### 用户与权限
- **登录系统**：可配置启动登录，支持微信扫码 / 账号密码两种方式
- **权限管理系统**（管理端 + 客户端联动）：
  - 游戏等级与用户等级均为 **1 / 2 / 3**，用户等级 N 可玩所有游戏等级 ≤ N 的游戏
  - 无权限游戏正常显示，点"开始游戏"时提示"用户等级不够，不可用"
  - **个人用户**：由管理员在管理端手动创建（账号 + 密码 + 等级）
  - **企业用户**：配置文件路径可配置（默认 `D:/1.json`），用本机 IP 匹配 JSON 的 `UserIpAddress` 字段确定 `UserLevel`
- **管理端（YunGame Admin）**：独立界面，共享绿色数据库，管理游戏等级、个人用户账号、企业配置路径与匹配预览

### 界面与体验
- **七套主题**：卡通 / 赛博朋克 / 孟菲斯 / 新拟态 / 美国漫画 / 吉卜力 / 中国风，CSS 变量驱动，切换即时生效并持久化
- **卡片间距设置**：图片区域保持 16:9，间距 0–20px 可调
- **侧边栏自动隐藏 + 标签筛选**：鼠标悬停滑出，标签多选（AND 语义）
- **公告页面**：侧边栏"最近新增"入口，按加入时间倒序展示新增游戏动态
- **示例游戏**：首次启动且库为空时自动播种 7 款示例游戏，开箱即可体验
- **系统集成**：自定义标题栏、系统托盘、窗口最小化/关闭到托盘

### 规划中的功能（已出设计文档，未实现代码）
- [修改器整合](./docs/design/trainers.md)、[备份游戏存档](./docs/design/backup-save.md)、[图文/视频攻略整合](./docs/design/guides.md)

### 完全绿色（便携）运行
- 应用自身数据（数据库、图片缓存、插件目录、`config.json`）全部存储在应用当前目录（exe 旁边），**不写注册表、不使用 C 盘 / `%LOCALAPPDATA%`**
- 拷贝整个 `release` 文件夹即可随处运行

---

## 目录结构

```
PlayniteTauri/
├─ src/                        # React 前端（主客户端）
│  ├─ api/                     #   Tauri 命令调用封装（invoke）
│  ├─ components/              #   UI 组件
│  │  ├─ views/                #     网格 / 列表 / 详情 / 最近新增 / 空状态
│  │  ├─ settings/             #     设置各分区（通用 / 外观 / 主题 / 游戏库 / 插件 / 登录）
│  │  ├─ ui/                   #     通用 UI 原子组件
│  │  ├─ TitleBar.tsx          #     自定义标题栏
│  │  ├─ Sidebar.tsx           #     侧边栏（快捷筛选 + 标签过滤）
│  │  ├─ Toolbar.tsx           #     工具栏（搜索 / 视图切换 / 添加 / 设置 / 排序）
│  │  ├─ LoginScreen.tsx       #     登录界面
│  │  └─ GameContextMenu.tsx   #     游戏右键菜单
│  ├─ pages/                   #   页面（GameDetailPage）
│  ├─ hooks/                   #   React hooks（useLazyImage 懒加载）
│  ├─ stores/                  #   Zustand 状态（games / settings / library / ui）
│  ├─ styles/global.css        #   ★ 全局样式（CSS 变量驱动多主题）
│  ├─ i18n/                    #   i18next 配置（config.ts + index.tsx 门面）
│  ├─ types/models.ts          #   前端数据模型（与后端 models.rs 对应）
│  ├─ utils/                   #   搜索（拼音）/ 选择器 / 主题 / 资源处理 / 字体等
│  ├─ App.tsx                  #   根组件
│  └─ main.tsx                 #   入口（QueryClient + i18next 初始化）
│
├─ admin/                      # 管理端（YunGame Admin）独立前端
│  └─ src/                     #   App.tsx（游戏 / 用户 / 企业配置管理）
│
├─ Cargo.toml                  # ★ Cargo workspace 根（共享 release profile）
├─ crates/yungame-core/        # ★ 共享核心库（数据模型 + 后端逻辑）
│  └─ src/
│     ├─ lib.rs                #   AppState / run_client() / run_admin() / 命令注册
│     ├─ models.rs / db.rs / auth.rs / process.rs / settings.rs / covers.rs ...
│     └─ commands/             #   Tauri 命令（games / auth / admin / covers / library / settings / plugins / system / tags / announcement）
│
├─ apps/                       # ★ 各 Tauri 应用（各自独立 tauri.conf.json + frontendDist）
│  ├─ desktop/                 #   客户端（Playnite.DesktopApp.exe）
│  │  ├─ Cargo.toml / build.rs / tauri.conf.json / capabilities/ / icons/
│  │  └─ src/main.rs           #   yungame_core::run_client(generate_context!())，嵌入 ./dist
│  └─ admin/                   #   管理端（Playnite.Admin.exe）
│     ├─ Cargo.toml / build.rs / tauri.conf.json / capabilities/ / icons/
│     └─ src/main.rs           #   yungame_core::run_admin(generate_context!())，嵌入 ./dist-admin
│
├─ docs/                       # ★ 设计文档（每次修改功能必须同步更新）
│  ├─ README.md                #   文档索引
│  ├─ design/                  #   架构 / 数据模型 / 搜索 / 主题 / i18n / 绿色存储 / 构建等
│  ├─ CONTRIBUTING.md          #   文档同步约定
│  └─ CHANGELOG.md             #   变更记录
│
├─ locales/                    # ★ 主客户端 i18n 三语字典（en.json / zh-CN.json / zh-TW.json）
├─ announcements/              # 公告内容
├─ scripts/auto-build.mjs      # 自动构建监听脚本（源码变化自动重编译）
├─ auto-build.bat              # 双击启动自动构建
├─ dev-client.bat              # ★ 客户端开发模式（tauri dev，前端 HMR + 后端增量）
├─ dev-admin.bat               # ★ 管理端开发模式（tauri dev，前端 HMR + 后端增量）
├─ build.ps1                   # 构建脚本（sccache 加速，生成绿色 exe；-ClientOnly / -AdminOnly）
├─ vite.config.ts              # 客户端前端 Vite 配置（→ dist/）
├─ vite.admin.config.ts        # 管理端前端 Vite 配置（→ dist-admin/）
├─ dist/                       # 客户端前端构建产物
├─ dist-admin/                 # 管理端前端构建产物（独立 frontendDist）
├─ release/                    # 客户端构建产物（Playnite.DesktopApp.exe + 运行数据）
└─ admin_release/              # 管理端构建产物（Playnite.Admin.exe，不随客户端发布）
```

---

## 环境要求

- Windows 10/11（系统自带 WebView2 运行时）
- Rust 工具链，推荐 **MSVC** 目标（`x86_64-pc-windows-msvc`），已通过 `rust-toolchain.toml` 指定
- Node.js 18+

---

## 构建（绿色版）

### 自动构建（推荐）

修改代码后**自动重新构建**绿色 exe，无需手动运行：

```powershell
# 双击 auto-build.bat 启动（最简单），或：
npm run auto-build
```

脚本监听 `src/`（前端）与 `crates/`、`apps/`（后端）源码变化，防抖后自动执行完整构建并更新 `release\Playnite.DesktopApp.exe`。按 `Ctrl+C` 停止。

### 手动构建

```powershell
# 优化 Release 版（默认，推荐分发）
.\build.ps1

# Debug 版（调试用）
.\build.ps1 -Debug
```

`build.ps1` 会同时构建两个可执行程序：

- **客户端**（随发布分发）：`release\Playnite.DesktopApp.exe`
- **管理端**（仅本地管理用，不发布）：`admin_release\Playnite.Admin.exe`

两者均为绿色可执行文件，可直接双击运行。管理端要与客户端共享同一游戏库时，将
`Playnite.Admin.exe` 放到客户端 exe 同目录运行即可（绿色存储按 exe 所在目录定位）。

> **注意**：必须使用 `build.ps1` / `auto-build` / `cargo tauri build --no-bundle` 构建。
> **不要直接用 `cargo build`**，因为它不会重新构建前端资源，生成的 exe 会尝试从 dev server
> （`localhost:1420`）加载界面，导致 "无法访问此页面 / 连接被拒绝" 错误。

---

## 开发

```powershell
npm install
npm run tauri dev
```

---

## 数据存储

应用全部数据存于 exe 所在目录（绿色 / 便携）：

| 路径 | 内容 |
| --- | --- |
| `config.json` | 应用偏好（语言 / 主题 / 卡片大小与间距 / 渲染模式 / 企业配置路径等），JSON 可直接编辑 |
| `library/library.db` | 业务数据库（游戏库 / 用户 / 设置等） |
| `library/images` | 封面 / 背景图片 |
| `CoverImages/` | 封面图库（按文件名自动匹配封面） |
| `cache` | 元数据缓存 |
| `extensions/plugins` | 插件目录 |

> **注意**：`library/library.db` 保存了全部用户配置（语言、主题、卡片大小等）。调试时**不要随意删除该文件**，否则会重置所有用户设置。需要测试"首次建库自动导入"时应使用独立的测试数据库副本。

---

## 说明

- 原版 Playnite 是一个约 1000+ 源文件的大型项目，此处复刻了其核心架构与主要功能（游戏库、导入、视图、启动、插件、设置、权限管理），采用 Tauri 推荐的技术栈，并实现了大量自有特性。
- 完整设计文档见 [docs/](./docs/README.md)；变更记录见 [docs/CHANGELOG.md](./docs/CHANGELOG.md)。
- AI 开发规范见 [AGENTS.md](./AGENTS.md)；CodeBuddy 项目级 skill 位于 `.codebuddy/skills/`（`init` / `check` / `cleanup` / `change-package-manager`）。
- 构建脚本与自动构建细节见 [build-script](./docs/design/build-script.md)；构建加速见 [build-acceleration](./docs/design/build-acceleration.md)。
