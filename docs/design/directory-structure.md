# 目录结构

```
PlayniteTauri/
├─ src/                       # React 前端
│  ├─ api/client.ts           # Tauri 命令调用封装（invoke）
│  ├─ components/             # UI 组件
│  │  ├─ views/               #   三种视图（GridView / ListView / DetailsView / GamesView / EmptyState）
│  │  ├─ settings/            #   设置各分区（General / Appearance / Themes / Library / Plugins）
│  │  ├─ TitleBar.tsx         #   自定义标题栏（最小化/最大化/关闭）
│  │  ├─ Sidebar.tsx          #   侧边栏（快捷筛选 + 分面）
│  │  ├─ Toolbar.tsx          #   工具栏（搜索 / 视图切换 / 添加 / 设置 / 排序）
│  │  ├─ ImportWizard.tsx     #   添加游戏向导（扫描目录 / Steam）
│  │  ├─ GameEditModal.tsx    #   游戏编辑弹窗（含多名称编辑）
│  │  ├─ GameContextMenu.tsx  #   游戏右键菜单
│  │  └─ ToastContainer.tsx   #   轻提示
│  ├─ stores/                 # Zustand 状态
│  │  ├─ gamesStore.ts        #   游戏列表 / 筛选 / 排序 / 选择
│  │  ├─ settingsStore.ts     #   设置 / 平台
│  │  └─ libraryStore.ts      #   导入扫描 / 统计
│  ├─ styles/global.css       # 全局样式（CSS 变量驱动多主题）
│  ├─ i18n/                   # 国际化
│  │  ├─ index.tsx            #   Context + useI18n + t()
│  │  └─ locales/             #   en.ts / zh-CN.ts / zh-TW.ts
│  ├─ types/models.ts         # 数据模型（对应后端 models.rs）
│  ├─ utils/
│  │  ├─ selectors.ts         #   过滤 / 排序 / 分组
│  │  ├─ search.ts            #   ★ 搜索（含拼音首字母，pinyin-pro）
│  │  └─ theme.ts             #   主题定义与切换
│  ├─ App.tsx                 # 根组件（加载数据、同步语言/主题）
│  └─ main.tsx                # 入口（I18nProvider 包裹）
│
├─ src-tauri/                 # Rust 后端
│  ├─ src/
│  │  ├─ main.rs              # 二进制入口
│  │  ├─ lib.rs               # Tauri 入口 / AppState / 窗口与托盘 / 命令注册
│  │  ├─ models.rs            # 数据模型（Game / GameName / GameAction ...）
│  │  ├─ db.rs                # SQLite 数据访问
│  │  ├─ library.rs           # 目录扫描 / Steam 导入
│  │  ├─ process.rs           # 进程启动 / 游玩追踪
│  │  ├─ plugins.rs           # 插件发现
│  │  ├─ settings.rs          # ★ 绿色路径（exe 目录）
│  │  ├─ system.rs            # 系统命令（窗口控制）
│  │  └─ commands/            # Tauri 命令（games / library / settings / plugins / system）
│  ├─ capabilities/           # 权限（已移除 store）
│  ├─ Cargo.toml              # 依赖 + 优化 release profile
│  ├─ .cargo/config.toml      # 并行编译 / incremental
│  ├─ rust-toolchain.toml     # MSVC 工具链
│  └─ tauri.conf.json         # productName = Playnite.DesktopApp
│
├─ docs/                      # ★ 设计文档（每次修改同步更新）
│  ├─ README.md               #   索引
│  ├─ design/                 #   架构 / 数据模型 / 搜索 / 主题 / i18n / 绿色存储 / 构建
│  ├─ CONTRIBUTING.md         #   文档同步约定
│  └─ CHANGELOG.md            #   变更记录
│
├─ scripts/auto-build.mjs     # 自动构建监听脚本（源码变化自动重编译）
├─ auto-build.bat             # 双击启动自动构建
├─ build.ps1                  # 构建脚本（sccache 加速，生成绿色 exe）
├─ package.json
└─ release/                   # 构建产物（Playnite.DesktopApp.exe + 运行数据）
```
