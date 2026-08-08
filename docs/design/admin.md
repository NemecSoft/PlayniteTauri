# 管理端（Playnite.Admin.exe）

管理端是与客户端**独立的绿色可执行程序**，负责管理游戏与用户，与客户端共享同一套数据模型和
绿色数据库（`library/library.db`）。

## 项目结构（Monorepo）

管理端是 Cargo workspace 中的一个独立 Tauri 应用（`apps/admin`），复用共享核心库
（`crates/yungame-core`）的数据模型、db、auth 与命令：

- `apps/admin/src/main.rs` → `yungame_core::run_admin(tauri::generate_context!())`
- `apps/admin/tauri.conf.json`：`productName = Playnite.Admin`，`frontendDist = ../../dist-admin`
- 前端：`admin/src/`（独立 React 应用，构建到 `dist-admin/`）

管理端与客户端**各自只嵌入各自前端**（客户端 `dist/`，管理端 `dist-admin/`），互不干扰。

## 与客户端的关系

| 维度 | 客户端 `Playnite.DesktopApp.exe` | 管理端 `Playnite.Admin.exe` |
| --- | --- | --- |
| 前端 | `src/` → `dist/` | `admin/src/` → `dist-admin/` |
| 共享 | `crates/yungame-core` | `crates/yungame-core` |
| 数据库 | `release/library/library.db` | 同（exe 同目录时共享） |
| 分发 | ✅ 随发布 | ❌ 不发布，仅本地管理 |

**同库访问**：管理端要与客户端操作同一数据库时，把 `Playnite.Admin.exe`（及 `WebView2Loader.dll`）
放到客户端 exe 同目录运行即可（绿色存储按 exe 所在目录定位）。

## 权限管理（用户等级 × 游戏等级）

- 游戏等级与用户等级均为 **1 / 2 / 3**；用户等级 N 可玩所有游戏等级 ≤ N 的游戏。
- 无权限游戏正常显示，点"开始游戏"时提示"用户等级不够，不可用"。
- **个人用户**：管理员在管理端手动创建（账号 + 密码 + 等级）。
- **企业用户**：配置文件路径可配置（默认 `D:/1.json`），用本机 IP 匹配 JSON 的
  `UserIpAddress` 字段确定 `UserLevel`。

## 功能

### 游戏管理
- 添加 / 修改 / 删除游戏。
- 设置：版本（`version`）、标签（`tags`）、封面（`coverImage`）、启动项（`actions`：
  File/URL、路径、工作目录、参数）、详细介绍（HTML，`description`）。
- 启动项路径**优先相对路径**：游戏一般与 exe 同盘，可用 `.` / `..` 从 exe 目录定位
  （如 `.\Game\Game.exe`、`..\Games\Game\Game.exe`）。后端 `process.rs` 启动时会相对 exe
  目录归一化为绝对路径。

#### 游戏编辑器（多标签页）
游戏编辑弹窗分为两个子标签页：

- **通用**：游戏名称、访问等级、开发者 / 类型 / 平台 / 分类、
  **版本 / 发行商 / 系列 / 发行日期 / 收藏 / 隐藏**、
  **所属游戏库**（单选下拉，每个游戏只属于一个游戏库——管理 / 筛选用）、
  **标签选择器**（从全库收集所有唯一标签，chip 点选 + 自定义添加）、
  **简介 / 描述**、**HTML 攻略 / 玩法指南**、**备注**（内部使用，不出现在客户端）。
- **指令**：支持为单个游戏配置**多条启动项**（原版 / MOD / DX11 / DX12 等）。每条启动项包含：
  - 名称（如「原版」「MOD」「DX11」「DX12」）；
  - 类型：**文件**（启动程序）或 **URL**（打开链接）；
  - 路径 / URL：文件类型支持 `{GamelibraryN}` 占位符（见下）与 `.` / `..` 相对路径；
  - 工作目录（可选，默认程序所在目录，支持文件选择对话框）；
  - 启动参数（可选，如 `--windowed`）；
  - 是否作为启动指令（全局唯一，勾选一条自动取消其它）；
  - 是否追踪游玩时间；
  - 操作：**添加 / 上移 / 下移 / 移除**。
  - 路径 / 工作目录旁的"浏览…"调用 Tauri 文件选择对话框（`@tauri-apps/plugin-dialog`）。
  - **工作目录（默认 = 游戏所在目录）**：工作目录自动派生自 `path`——
  - 若 `path` 以可执行扩展名结尾（`.exe/.bat/.cmd/.lnk/.com`）→ 工作目录 = 该文件所在目录；
  - 否则 `path` 本身即目录 → 工作目录 = `path`。
  - 例：`{Gamelibrary2}\X\Sephiria\Sephiria.exe` → `{Gamelibrary2}\X\Sephiria`；
    `{Gamelibrary2}\X\Sephiria`（目录）→ 本身；`...\bin\game.exe` → `...\bin`。
  - 打开编辑时自动回填派生值（旧数据错误值会被修正）；输入 `path` 时若工作目录未手动改过则
    自动同步；用户手动编辑工作目录后不再自动覆盖（支持 `\bin` 等子目录）。
  - "用 exe 所在目录"按钮：调用 `admin_validate_action` 解析 exe 实际路径后取其父目录填入。
  - 工作目录字段**通栏显示**（占满整行宽度，输入框不被挤压），placeholder 给具体示例。
  - **可执行性真实校验**：路径右侧有"**校验**"按钮（**手动触发**，不阻塞保存，因为开发环境
    与实际部署环境路径不同）。点击调用 `admin_validate_action` 对**真实文件系统**校验——
    解析 `{LibraryName}` 占位符 → 得到绝对路径 → 检查文件存在、非目录、扩展名为
    `.exe/.bat/.cmd/.lnk/.com`。下方显示"✓ 可执行 / ✕ 文件不存在"及解析后的实际路径。
    URL 类型不校验。
  - **此启动项引用的游戏库（只读）**：标签页底部自动从所有 actions 的 path / workingDir 提取
    `{库名}` 占位符并展示为 chip；只读，不允许在此修改游戏库（库增删改在顶层"游戏库管理"）。
  - **迁移旧路径（一次性）**：调用 `admin_migrate_gamelibrary_placeholder`，批量将所有游戏
    的 `path` / `workingDir` 从旧 `.\Gamelibrary\...` 升级为 `{Gamelibrary1}\...`。
- **游戏库**：一个游戏库 = **id + 名称 + 路径** 三条记录的集合。名称可修改
  （如"库1"、"库2"、"Gamelibrary1"），路径是游戏所在根目录（如 `D:\Games`）。
  启动项路径用 `{名称}` 占位符引用游戏库。
  - 游戏库本身（名称 + 路径）的**增删改**只在**顶层"游戏库管理"标签页**进行。
  - 游戏编辑器的**"通用"**标签页有"**所属游戏库**"单选下拉框，绑定一个库（每个游戏只
    属于一个库），`Game.gameLibrary: Option<String>` 存库名（仅用于组织管理与按库筛选；
    启动路径解析仍按 `{名称}` 占位符独立工作）。
  - 指令标签页底部"此启动项引用的游戏库（只读）"展示当前 actions 实际引用的 `{库名}`，只读。

#### 游戏库数据模型（`GameLibrary`）
```rust
pub struct GameLibrary {
    pub id: String,   // 唯一 id（新增时由后端生成 lib-<uuid>；旧数据自动补 lib-legacy-N）
    pub name: String, // 用户可编辑名称，作为 {name} 占位符 token
    pub path: String, // 游戏根目录（绝对路径）
}
```
- 存储于 `config.json` 的 `AppSettings::game_libraries: Vec<GameLibrary>`。
- **兼容旧数据**：旧配置中 `game_libraries` 为纯字符串数组 `["D:\Games"]`，反序列化时
  自动升级为 `{ id: "lib-legacy-N", name: "GamelibraryN", path }`。

#### 顶层"游戏库管理"标签页（完整 CRUD，同游戏管理）
管理端导航栏提供**独立的"游戏库管理"标签页**，以**表格**列出所有游戏库：
- 表格列：**ID**、**名称**（`{名称}` 占位符）、**路径**、**操作**。
- **新增**：点"新增游戏库"弹出编辑框，填名称 + 路径（路径可用 Tauri 文件选择对话框），
  后端分配 id。
- **修改**：点行内"编辑"弹出编辑框，可改名称 / 路径。
- **删除**：点行内"删除"，二次确认后移除。
- 已有的游戏库在列表中原样显示，重启后保持（持久化在 config.json）。

启动项路径示例：
```
{库1}\Cyberpunk2077\bin\x64\Cyberpunk2077.exe   （库1 -> D:\Games）
{库2}\SomeGame\Game.exe
```
后端 `process.rs` 的 `launch` 会先按**名称**匹配 `{名称}` 占位符（不区分大小写，替换为
对应游戏库根目录），再对剩余部分做绝对 / 相对路径归一化。

游戏列表中的"启动项"列改名为**"安装目录"**列。

#### 桌面端启动路径拼接（客户端运行时）
客户端启动游戏时，由共享命令 `launch_game` → `ProcessManager::launch` 完成路径解析：

1. 数据库里的启动项路径是**模板**（`{库1}\Y\Helldivers`），客户端读取 `config.json` 的
   `game_libraries`（管理端配置），按**名称**匹配占位符（`{库1}` → `库1` 的 `path`）。
2. 得到游戏库根目录后，拼接剩余相对子路径，再做绝对路径归一化：
   `D:\Games\Y\Helldivers.exe`。
3. 其它情形：
   - 绝对路径 → 直接使用；
   - 相对路径（`. \` / `..\`）→ 相对客户端 exe 目录归一化。
4. 解析工作目录（未填则默认程序所在目录），携带启动参数，`Command::spawn` 启动。
5. URL 类型 → `cmd /C start <url>` 打开链接。

#### 后端命令
- `admin_get_game_libraries`：返回全部游戏库列表（`Vec<GameLibrary>`）。
- `admin_save_game_library`：新增（id 为空）或更新（按 id）单个游戏库。
- `admin_delete_game_library`：按 id 删除单个游戏库。
- `save_game`：保存含多条 `actions` 的游戏（后端将整个 `Game` JSON 持久化到数据库）。

### 用户管理
- 添加 / 修改 / 删除用户。
- **用户类别**（`kind`）：**个人用户**（personal，账号+密码登录）或**企业用户**
  （enterprise，由本机 IP 匹配）。新增/编辑用户时可选择类别。
- 用户字段：账号、名称、类别、等级（1/2/3）、密码。
- 表格列：**ID / 账号 / 名称 / 类别 / 等级 / 操作**（与游戏、游戏库管理一致，均展示 ID）。
- 回写数据库（`users` 表）。

### 弹窗关闭保护（基本规则）
所有编辑弹窗（游戏 / 游戏库 / 用户）：
- **点击弹窗外部（遮罩）一律不关闭**——无论有无未保存改动，都只通过明确的按钮
  （保存 / 取消）关闭，避免误点击外部丢失已编辑内容。
- **点"取消"按钮**时，若表单有未保存修改，弹出"有未保存的修改，确定要放弃并关闭吗？"
  确认框，确认后才关闭（打开时对表单做 JSON 快照，关闭时对比判断改动）。
- 参考 Playnite / Steam / VS Code 等桌面应用的弹窗惯例：模态框点击外部不关闭。

### 客户端：启动游戏后自动跳转到详情页
**客户端**点"开始游戏"（launch_game 成功后）会自动跳转到该游戏的**详情页**
（`/game/:id`），让用户一边玩游戏一边查看详情页的**攻略（guide）、联机方式、教程视频**。
实现：`gamesStore.launchGame` 成功后设置 `lastLaunchedId`，`App.tsx` 的 `AppShell`
（HashRouter 内部）用 `useEffect` 监听并 `navigate('/game/:id')`，然后清除标记。
（Playnite 式行为：游戏启动后跳详情页，方便边玩边看教程。）
（Steam 模式则不跳转——本项目按 Playnite 模式实现。）

### 删除确认与撤销（游戏 / 用户 / 游戏库通用）
- **删除一律弹出自定义确认框**（不使用 `window.confirm`——在 WebView2 中不可靠），
  确认后才执行。
- **删除后底部弹出撤销条（Undo Bar）**，显示"已删除 XX [撤销]"：
  - **用户删除采用软删除**：`users` 表新增 `deleted_at` 列（迁移时自动补列），
    `admin_delete_user` 只置 `deleted_at` 不物理删除；`admin_restore_user` 清除标记恢复。
    已删除用户不参与登录校验、不在列表展示。
  - **游戏 / 游戏库删除**：物理删除后在撤销条内保留被删对象，点撤销调用 `save_game` /
    `admin_save_game_library` 恢复。

### 企业配置
- 配置企业用户 JSON 路径。
- 预览 IP 匹配到的等级。

## 后端命令

管理端通过共享核心库注册了一组 `admin_*` 命令：

```
admin_list_users / admin_save_user / admin_delete_user / admin_restore_user
admin_get_settings / admin_set_enterprise_config / admin_preview_enterprise
admin_set_game_level
admin_get_game_libraries / admin_save_game_library / admin_delete_game_library
admin_migrate_gamelibrary_placeholder
admin_validate_action
admin_import_enterprise_users / admin_list_enterprise_users / admin_delete_enterprise_user
```

以及读取/保存游戏、读取设置、封面扫描、系统窗口控制等命令。

## 开发与构建

- **开发**：双击 `dev-admin.bat`（`tauri dev`，前端 HMR + 后端增量，Vite 端口 1421）。
- **构建**：`.\build.ps1`（或 `-AdminOnly`），产物 `admin_release/Playnite.Admin.exe`。
