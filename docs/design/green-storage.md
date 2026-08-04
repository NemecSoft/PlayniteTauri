# 绿色（便携）存储

## 目标

**完全绿色 / 便携运行**：
- 所有数据（数据库、配置、图片缓存、插件、WebView2 用户数据）存储在**应用当前目录**（exe 旁边）
- **不写注册表**
- **不使用 C 盘 / `%LOCALAPPDATA%`**
- 拷贝整个 `release` 文件夹即可随处运行

## 存储位置（`settings.rs`）

`AppPaths::config_root()` 通过 `std::env::current_exe()` 取 exe 所在目录作为数据根，**始终**使用，
无 `portable` 开关（永久绿色）。

```
release/
├─ Playnite.DesktopApp.exe   ← 主程序
├─ config.json               ← 应用设置（语言/主题/卡片等，见 config.rs）
├─ library/
│  ├─ library.db              ← 游戏库数据库（SQLite）
│  └─ images/                 ← 封面/背景图片
├─ CoverImages/               ← 用户放置的封面图库（按中文名自动匹配，见 covers.md）
├─ cache/                     ← 元数据缓存
├─ UserData/EBWebView         ← WebView2 运行时用户数据
└─ extensions/plugins/        ← 插件目录
```

> **设置与数据分离**：应用偏好（语言、主题、卡片大小、渲染模式、企业配置路径等）存 `config.json`
> （`config.rs`），不再存 SQLite。数据库只存游戏库、用户等业务数据。首次从旧版数据库自动迁移设置。

## 关键实现点

### 1. 数据库路径
`Database::open(AppPaths::database_path())` → exe 目录下 `library/library.db`，首次运行自动创建目录。

### 2. 移除会访问 `%LOCALAPPDATA%` 的组件
- **`tauri-plugin-store`**：已从 `lib.rs`、`Cargo.toml`、`package.json`、`capabilities` 全部移除。
  该未使用插件默认会访问 `%LOCALAPPDATA%`。
- **WebView2 用户数据**：通过 `WebviewWindowBuilder.data_directory(exe目录/UserData)` 重定向。
  详见下节"兼容性说明"。

### 3. 注册表
仅保留 `winreg` **只读**（读取 Steam 安装路径用于扫描库），**无任何写注册表操作**。

### 4. 托盘图标去重
任务栏（或系统托盘）出现**两个图标**的根本原因是托盘被**重复创建**：
- `tauri.conf.json` 的 `app.trayIcon` 配置会让 Tauri **自动创建**一个托盘图标。
- Rust 代码里的 `setup_tray()` 又**手动创建**一个托盘图标。

修复（Tauri 推荐做法）：**只保留一种托盘创建方式**。既然代码 `setup_tray` 提供完整菜单与事件
（显示主窗口 / 退出 / 左键单击显示），就**移除 `tauri.conf.json` 的 `trayIcon` 配置**，
避免自动 + 手动重复。

> 教训：不要同时使用 config 的 `trayIcon` 和代码 `TrayIconBuilder`，两者会各自创建一个托盘图标。

## 兼容性说明（重要）

> **Tauri 2 限制**：`data_directory` 只对**手动创建的窗口**生效。若从 `tauri.conf.json` 的
> `app.windows` 自动创建窗口，Tauri 会强制把 WebView2 用户数据放到 `%LOCALAPPDATA%\<identifier>`。

本项目当前的取舍：
- **界面显示优先**：采用 `tauri.conf.json` 自动创建窗口（保证嵌入资源正确加载，避免 localhost 错误）。
- **应用自身数据完全绿色**：数据库 / 图片 / 缓存 / 插件全部在 exe 目录。
- **WebView2 UserData**：由 Tauri 运行时管理。若需也强制放到应用目录，需改用手动创建窗口
  （`WebviewWindowBuilder` + `data_directory`），但这可能引入资源加载问题，需权衡。

> 曾尝试手动创建窗口以把 WebView2 数据也放到应用目录，但因 Tauri 2 在 Windows 使用
> `http://<scheme>.localhost` 假协议加载嵌入资源，手动窗口在某些环境下出现
> `ERR_CONNECTION_REFUSED`。故回退到自动窗口以保证可用性。

## 清理残留

`build.ps1` 构建时自动删除旧版本可能残留的 `%LOCALAPPDATA%\Playnite`，保证持续绿色。
