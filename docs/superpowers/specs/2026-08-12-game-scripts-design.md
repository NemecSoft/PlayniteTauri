# 游戏启动前/启动后/退出后脚本功能设计

日期：2026-08-12
状态：设计定稿，待评审

## 一、目标

为每个游戏增加"启动游戏前"、"启动游戏后"、"退出游戏后"三段**可执行脚本**，
参考 Playnite 的全局脚本功能。典型用途：启动前跑 `config.exe` 做配置、写注册表、
准备存档；退出后保存状态、清理进程等。

已确认的三个关键决策：
1. **脚本执行方式**：按行解析，每行一条命令（`exe 参数...`），用 `std::process::Command`
   逐行执行。跨平台、支持任意可执行文件（exe/bat/cmd/脚本）。
2. **支持变量展开**：`{InstallDir}` → 游戏安装目录、`{GameName}` → 游戏名等，自动替换。
3. **完整管理端 UI**：3 个多行文本框 + 启用开关 + "测试脚本"按钮。

## 二、数据模型（Rust `Game` + TS `Game`）

在 `Game` struct 加 6 个 `#[serde(default)]` 字段（db 用 JSON 整体存储，加字段天然兼容旧数据）：

```rust
/// 启动游戏前执行的脚本（多行，每行一条命令），enabled 表示是否启用。
#[serde(default)]
pub pre_launch_script: Option<String>,
#[serde(default)]
pub pre_launch_enabled: bool,
/// 启动游戏后执行的脚本。
#[serde(default)]
pub post_launch_script: Option<String>,
#[serde(default)]
pub post_launch_enabled: bool,
/// 退出游戏后执行的脚本。
#[serde(default)]
pub post_exit_script: Option<String>,
#[serde(default)]
pub post_exit_enabled: bool,
```

TS 端 `src/types/models.ts` 的 `Game` 同步加同名字段（camelCase）。

## 三、变量展开（`scripts.rs` 纯函数）

新增 `src/.../scripts.rs`（Rust）或独立模块，提供变量替换。变量映射：

| 变量 | 含义 |
| --- | --- |
| `{InstallDir}` | 游戏安装目录（`game.install_directory`），不存在则留空 |
| `{GameName}` | 游戏名（`game.name`） |
| `{GameId}` | 游戏 ID |
| `{LibraryName}` | 游戏所属库名（已有 `game_library` 字段） |
| `{ExeDir}` | 主启动 exe 所在目录（若有 play action 时） |
| `{AppDir}` | 应用自身目录（`config_root`） |

实现：读入脚本字符串，逐行 `replace` 变量为实际值（大小写不敏感、可选）。空/缺失变量替换为空字符串。

**注意**：已有 `process.rs` 的 `{LibraryName}` 占位符解析是独立的，本功能在**执行前**先做统一的变量展开，替换成绝对路径后再交给命令执行。

## 四、脚本执行引擎（`script_runner.rs`）

核心函数：

```rust
/// 执行一段多行脚本。每行非空、非注释（# 开头）的命令，用 Command 执行。
/// 逐行独立执行，单行失败不影响后续行（返回失败行号列表用于提示）。
/// 所有变量在传入前已由 expand_variables 展开。
pub fn run_script(
    script: &str,
    cwd: Option<&Path>,
    game_libraries: &[GameLibrary],
) -> Result<Vec<ScriptLineResult>, AppError>;
```

- **逐行解析**：按 `\n` 分列；去掉空行和以 `#` 开头的注释行。
- **每行命令**：用空格（或引号感知）切分为 `program + args`。用 `Command::new(program)`。
- **变量已展开**：`{InstallDir}` 等已被替换成绝对路径。
- **工作目录**：默认用游戏安装目录（`{InstallDir}`）或应用目录；脚本行可写 `cd /d path` 引导（简单起见：默认 cwd = 游戏安装目录）。
- **返回值**：每行的执行结果（成功/失败 + 错误信息），前端可展示。
- **同步 vs 异步**：
  - 启动前脚本：**同步等待**（`cmd.status()`）——必须在游戏启动前执行完。
  - 启动后脚本：**异步 spawn**（不等待）——启动后立即跑。
  - 退出后脚本：游戏进程退出后执行（**同步等待**结果）。

## 五、启动/退出时机（接入现有链路）

### 5.1 启动前 + 启动后（改 `launch_game`）

现有 `launch_game`（`commands/games.rs`）流程：
1. 权限检查 → 找到 play action → `process.launch()` + `start_tracking()`

在 `launch_game` 里，于 `launch()` 之前插入：

```rust
// 1) 启动前脚本（同步执行完才启动游戏）
if game.pre_launch_enabled {
    if let Some(s) = &game.pre_launch_script {
        let expanded = expand_variables(s, game, ...);
        run_script(&expanded, install_dir_cwd, ...)?;
    }
}
// 2) 启动游戏（现有逻辑）
let ok = launch...;
// 3) 启动后脚本（游戏进程已拉起，异步执行）
if ok && game.post_launch_enabled {
    if let Some(s) = &game.post_launch_script {
        spawn_script(expand_variables(s, game, ...), ...);
    }
}
```

### 5.2 退出后（改 `process.rs` 的进程退出回调 / 停止追踪）

现有 `stop_tracking`（`commands/games.rs`）在游戏进程退出/手动停止时被调用。在停止追踪前执行退出后脚本：

```rust
// stop_game_tracking 里，已拿到 game 引用时：
if game.post_exit_enabled {
    if let Some(s) = &game.post_exit_script {
        run_script(expand_variables(s, game, ...), ...)?;
    }
}
```

注意：`stop_tracking` 目前只传 game_id，需要能取回 `Game`（从 db 查）才能拿脚本字段。

## 六、命令注册（Tauri commands）

在 `commands/scripts.rs` 新增（或并入 games.rs）：

- `test_script(script: String, game_id: Option<String>) -> Vec<ScriptLineResult>`
  —— 管理端"测试脚本"按钮用：不启动游戏，只执行并返回每行结果。
- 变量展开辅助命令（可选）：`expand_script_variables(script, game_id)`。

## 七、管理端 UI（`admin/src/App.tsx`）

在游戏编辑面板新增"脚本"区（参考 Playnite 截图），三段并列：

```
启动游戏前执行（多行文本 + 启用勾选 + 测试按钮）
启动游戏后执行（多行文本 + 启用勾选 + 测试按钮）
退出游戏后执行（多行文本 + 启用勾选 + 测试按钮）
```

- 每个区：`<textarea>`（多行）+ `<input type="checkbox">`（启用）+ `<button>`（测试脚本）。
- 测试按钮调用 `test_script`，结果显示在一个小弹窗/下方列表（每行 ✓/✗）。
- 保存时把 6 个字段一并写回 Game（走现有 `save_game` 链路，`upsert_game` 整体序列化）。

## 八、错误处理

- 变量缺失：替换为空字符串，不报错。
- 脚本行命令不存在：记录该行失败，继续后续行。
- 启动前脚本失败：**可选策略**——默认继续启动游戏（只记日志），避免脚本问题导致游戏无法启动。
- 测试脚本：无论成败都返回每行结果，UI 展示。

## 九、国际化

新增 key（三份 locale）：
- `script_pre_launch`（启动游戏前执行）
- `script_post_launch`（启动游戏后执行）
- `script_post_exit`（退出游戏后执行）
- `script_enable`（启用）
- `script_test`（测试脚本）
- `script_result_ok`（成功）/ `script_result_fail`（失败）
- `script_hint`（提示：每行一条命令，支持 {InstallDir} 等变量）

## 十、范围与排除

**本期做**：3 段脚本 + 变量展开 + 完整管理端 UI + 测试按钮 + 后端执行链路。
**本期不做**：
- 应用级（全局）脚本——先做每游戏，全局可后续。
- 脚本权限 / 提权（run as admin）——可后续。
- 完整的引号解析（复杂参数）——用简单 split + 引号感知，够用。

## 十一、测试

- `script_runner` 单测：空行/注释忽略；多行逐条执行；失败行返回错误；成功返回成功。
- 变量展开单测：`{InstallDir}`、`{GameName}` 替换正确；缺失变量替换为空。
- 管理端手动：填脚本 → 测试 → 保存 → 启动游戏验证前/后脚本执行。

## 十二、文档同步

完成后更新 `docs/CHANGELOG.md`、`docs/design/views.md`（或相关数据模型文档）。
