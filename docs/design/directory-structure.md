# 目录结构

```
PlayniteTauri/
├─ Cargo.toml                  # ★ Cargo workspace 根（共享 release profile：thin-LTO + 16 codegen + incremental）
├─ rust-toolchain.toml         # ★ MSVC 工具链（x86_64-pc-windows-msvc）
├─ .gitignore
│
├─ crates/                     # ★ 共享 Rust 库
│  └─ yungame-core/            #   核心库（数据模型 + 后端逻辑 + 全部命令）
│     ├─ Cargo.toml
│     └─ src/
│        ├─ lib.rs             #   AppState / run_client() / run_admin() Builder / 命令注册
│        ├─ models.rs          #   数据模型（Game / AppUser / AppSettings / Platform ...）
│        ├─ db.rs              #   SQLite 数据访问
│        ├─ auth.rs            #   登录 / 权限 / 企业用户解析
│        ├─ process.rs         #   进程启动（含相对路径）/ 游玩追踪
│        ├─ plugins.rs         #   插件发现
│        ├─ settings.rs        #   ★ 绿色路径（exe 目录）+ config.json
│        ├─ covers.rs          #   封面图库匹配 + 图片读取
│        ├─ autotags.rs        #   自动标签
│        ├─ sample_data.rs     #   示例游戏
│        ├─ config.rs          #   config.json 读写
│        ├─ system.rs          #   系统命令（窗口控制）
│        └─ commands/          #   Tauri 命令（games / auth / admin / covers / library / settings / plugins / system / tags / announcement）
│
├─ apps/                       # ★ 各 Tauri 应用（独立 tauri.conf.json + frontendDist）
│  ├─ desktop/                 #   客户端（Playnite.DesktopApp.exe）
│  │  ├─ Cargo.toml / build.rs
│  │  ├─ tauri.conf.json       #   productName = Playnite.DesktopApp，frontendDist = ../../dist
│  │  ├─ capabilities/  icons/
│  │  └─ src/main.rs           #   yungame_core::run_client(generate_context!())
│  └─ admin/                   #   管理端（Playnite.Admin.exe，不随客户端发布）
│     ├─ Cargo.toml / build.rs
│     ├─ tauri.conf.json       #   productName = Playnite.Admin，frontendDist = ../../dist-admin
│     ├─ capabilities/  icons/
│     └─ src/main.rs           #   yungame_core::run_admin(generate_context!())
│
├─ src/                        # ★ 客户端 React 前端
│  ├─ api/client.ts            #   Tauri 命令调用封装（invoke）
│  ├─ components/              #   UI 组件
│  │  ├─ views/                #     网格 / 列表 / 详情 / 最近新增 / 视频 / 工具
│  │  ├─ settings/             #     设置各分区
│  │  ├─ TopBar.tsx            #     浏览器风格顶部条（设置菜单 + 标签栏 + 版本标识 + 窗口控件）
│  │  ├─ Sidebar.tsx           #     侧边栏（标签筛选，仅主页）
│  │  ├─ Toolbar.tsx           #     工具栏（搜索框，自动聚焦 + 拼音搜索）
│  │  ├─ AnnouncementModal.tsx #     启动公告弹窗
│  │  └─ ...
│  ├─ pages/  hooks/  stores/  #   页面 / hooks（懒加载）/ Zustand 状态
│  ├─ styles/global.css        #   ★ 全局样式（CSS 变量驱动多主题）
│  ├─ i18n/                    #   i18next 配置 + 门面
│  ├─ types/models.ts          #   前端数据模型（与后端 models.rs 对应）
│  └─ utils/                   #   搜索（拼音）/ 选择器 / 主题 / 资源处理
│
├─ admin/                      # ★ 管理端 React 前端（独立，构建到 dist-admin/）
│  └─ src/                     #   App.tsx（游戏管理 / 用户管理 / 企业配置）
│
├─ locales/                    # ★ 客户端 i18n 三语字典（en.json / zh-CN.json / zh-TW.json）
├─ announcements/              #   公告内容（编译期内联）
│
├─ docs/                       # ★ 设计文档（每次修改功能必须同步更新）
│  ├─ README.md                #   文档索引
│  ├─ design/                  #   架构 / 目录 / 数据模型 / 搜索 / 主题 / i18n / 绿色存储 / 构建
│  ├─ CONTRIBUTING.md          #   文档同步约定
│  └─ CHANGELOG.md             #   变更记录
│
├─ scripts/auto-build.mjs      # 自动构建监听脚本（前端 src、admin/src、crates、apps）
├─ dev-client.bat              # ★ 客户端开发模式（tauri dev，前端 HMR + 后端增量）
├─ dev-admin.bat               # ★ 管理端开发模式（tauri dev，前端 HMR + 后端增量）
├─ auto-build.bat              # 双击启动自动构建
├─ build.ps1                   # 构建脚本（sccache 加速；-ClientOnly / -AdminOnly）
├─ vite.config.ts              # 客户端前端 Vite 配置（→ dist/，dev 端口 1420）
├─ vite.admin.config.ts        # 管理端前端 Vite 配置（→ dist-admin/，dev 端口 1421）
├─ dist/                       # 客户端前端构建产物
├─ dist-admin/                 # 管理端前端构建产物（独立 frontendDist）
├─ release/                    # 客户端构建产物（Playnite.DesktopApp.exe + 运行数据）
└─ admin_release/              # 管理端构建产物（Playnite.Admin.exe，不随客户端发布）
```
