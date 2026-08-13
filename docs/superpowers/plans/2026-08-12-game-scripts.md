# 游戏启动/退出脚本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个游戏增加"启动前/启动后/退出后"三段可执行脚本（每行一条命令），支持变量展开（{InstallDir} 等），管理端提供 3 个多行文本框 + 启用开关 + 测试按钮。

**Architecture:** Rust `Game` 模型加 6 个字段（3 段脚本 + 3 个启用开关，`#[serde(default)]` 兼容旧数据）。新增 `script_runner` 模块（按行解析 + 变量展开 + 逐行执行）。在 `launch_game` 里启动前同步执行、启动后异步执行；在 `stop_game_tracking` 里退出后执行。管理端 `admin/App.tsx` 加"脚本"编辑区。新增 `test_script` 命令供管理端测试。

**Tech Stack:** Rust（std::process）、Tauri commands、React 管理端、serde、i18next。

## Global Constraints

- 注释一律中文通俗易懂（大白话说明"在做什么、为什么这么做"）。
- 变量展开在 `{InstallDir}`、`{GameName}`、`{GameId}`、`{LibraryName}`、`{ExeDir}`、`{AppDir}` 六种。
- db 用 JSON 整体存储 Game（`upsert_game`），加 `#[serde(default)]` 字段即可兼容。
- 启动前脚本**同步等待**、失败**继续启动**（只记日志）；启动后**异步**；退出后**同步**。
- 脚本每行一条命令，忽略空行和 `#` 开头注释行。
- 管理端每个脚本区：多行文本框 + 启用勾选 + "测试脚本"按钮。
- 不主动 commit/push（除非用户要求）。

---

### Task 1: 后端 `Game` 模型加脚本字段

**Files:**
- Modify: `crates/yungame-core/src/models.rs`（`Game` struct）
- Modify: `src/types/models.ts`（TS `Game`）

**Interfaces:**
- Produces: Rust `Game` + TS `Game` 都有 `preLaunchScript`/`preLaunchEnabled`/`postLaunchScript`/`postLaunchEnabled`/`postExitScript`/`postExitEnabled`（camelCase）。

- [ ] **Step 1: Rust `Game` 加字段**

在 `crates/yungame-core/src/models.rs` 的 `Game` struct（`game_level` 前，第 145-150 行附近）加：

```rust
    /// 启动游戏前执行的脚本（多行，每行一条命令）。
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

- [ ] **Step 2: TS `Game` 加同名字段**

在 `src/types/models.ts` 的 `Game`（`gameLevel` 附近）加：

```ts
  /** 启动游戏前执行的脚本（多行，每行一条命令）。 */
  preLaunchScript?: string;
  preLaunchEnabled: boolean;
  /** 启动游戏后执行的脚本。 */
  postLaunchScript?: string;
  postLaunchEnabled: boolean;
  /** 退出游戏后执行的脚本。 */
  postExitScript?: string;
  postExitEnabled: boolean;
```

- [ ] **Step 3: 验证**

```bash
cargo check --manifest-path crates/yungame-core/Cargo.toml
npm run typecheck
```

Expected: 均通过（注意：其它地方构造 `Game` 的地方可能因缺新字段报错，需要补默认值）。

- [ ] **Step 4: 提交**

```bash
git add crates/yungame-core/src/models.rs src/types/models.ts
git commit -m "feat: add pre/post launch and exit script fields to Game model"
```

---

### Task 2: 新增 `script_runner` 模块（变量展开 + 逐行执行）

**Files:**
- Create: `crates/yungame-core/src/script_runner.rs`

**Interfaces:**
- Consumes: `Game`、`GameLibrary`、`crate::settings::AppPaths`
- Produces:
  ```rust
  pub struct ScriptLineResult { pub line: String, pub ok: bool, pub error: Option<String> }
  pub fn expand_variables(script: &str, game: &Game) -> String;
  pub fn run_script(script: &str, cwd: Option<&Path>) -> Vec<ScriptLineResult>;
  ```
  `expand_variables` 做 `{InstallDir}`/`{GameName}`/`{GameId}`/`{LibraryName}`/`{AppDir}` 替换（用 `game.install_directory` 等）。`run_script` 逐行解析执行，返回每行结果。

- [ ] **Step 1: 写模块**

```rust
//! 游戏脚本执行：变量展开 + 按行解析逐条执行。
//! 参考 Playnite 的全局脚本，但用更简单的"每行一条命令"方式，跨平台。

use crate::models::Game;
use crate::settings::AppPaths;
use std::path::Path;
use std::process::Command;

/// 单行脚本的执行结果。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLineResult {
    pub line: String,
    pub ok: bool,
    pub error: Option<String>,
}

/// 把脚本里的变量替换成实际值。
/// 支持：{InstallDir} {GameName} {GameId} {LibraryName} {AppDir}。
/// 缺失/为空的变量替换成空字符串，不报错。
pub fn expand_variables(script: &str, game: &Game) -> String {
    let install_dir = game.install_directory.clone().unwrap_or_default();
    let lib = game.game_library.clone().unwrap_or_default();
    let app_dir = AppPaths::config_root().to_string_lossy().to_string();
    let mut out = script.to_string();
    // 先替换占位符（注意：路径里的反斜杠需小心，这里做整体字符串替换）
    out = out.replace("{InstallDir}", &install_dir)
        .replace("{installdir}", &install_dir)
        .replace("{GameName}", &game.name)
        .replace("{gamename}", &game.name)
        .replace("{GameId}", &game.id)
        .replace("{gameid}", &game.id)
        .replace("{LibraryName}", &lib)
        .replace("{libraryname}", &lib)
        .replace("{AppDir}", &app_dir)
        .replace("{appdir}", &app_dir);
    out
}

/// 执行一段多行脚本。每行非空、非 # 注释，解析成 "program args..." 执行。
/// 逐行独立，单行失败不影响后续行。返回每行结果。
pub fn run_script(script: &str, cwd: Option<&Path>) -> Vec<ScriptLineResult> {
    let mut results = Vec::new();
    for raw in script.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue; // 跳过空行和注释
        }
        // 解析第一段为程序，其余为参数（简单按空白切分）
        let mut parts = line.split_whitespace();
        let program = parts.next().unwrap_or_default();
        let args: Vec<&str> = parts.collect();
        let mut cmd = Command::new(program);
        cmd.args(args);
        if let Some(c) = cwd {
            cmd.current_dir(c);
        }
        match cmd.output() {
            Ok(_) => results.push(ScriptLineResult { line: line.to_string(), ok: true, error: None }),
            Err(e) => results.push(ScriptLineResult { line: line.to_string(), ok: false, error: Some(e.to_string()) }),
        }
    }
    results
}
```

- [ ] **Step 2: 注册模块**

在 `crates/yungame-core/src/lib.rs` 加 `pub mod script_runner;`（找到其它 `pub mod` 声明一起加）。

- [ ] **Step 3: 验证**

```bash
cargo check --manifest-path crates/yungame-core/Cargo.toml
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add crates/yungame-core/src/script_runner.rs crates/yungame-core/src/lib.rs
git commit -m "feat: add script runner with variable expansion"
```

---

### Task 3: 在 `launch_game` 接入启动前/启动后脚本

**Files:**
- Modify: `crates/yungame-core/src/commands/games.rs`（`launch_game`）

**Interfaces:**
- Consumes: `script_runner::{expand_variables, run_script}`
- Produces: `launch_game` 在启动 exe 前执行启动前脚本（同步），启动后执行启动后脚本（异步）。

- [ ] **Step 1: 改 `launch_game`**

在 `launch_game` 里，`let launched = ...` 之前插入启动前脚本；在 `launched` 计算后、`Ok(launched)` 前插入启动后脚本。

具体：在 `// Whether to record play time` 之后、`let launched = ...` 之前加：

```rust
    // 启动前脚本：先同步执行完（成功与否都继续启动，避免脚本问题阻止游戏）。
    if game.pre_launch_enabled {
        if let Some(s) = &game.pre_launch_script {
            if !s.trim().is_empty() {
                let expanded = crate::script_runner::expand_variables(s, &game);
                let cwd = game.install_directory.as_deref().map(std::path::Path::new);
                let _ = crate::script_runner::run_script(&expanded, cwd);
            }
        }
    }
```

在 `Ok(launched)` 前加（launched 为 true 才跑启动后脚本，异步 spawn 不等待）：

```rust
    // 启动后脚本：游戏进程已拉起，异步执行（不阻塞）。
    if launched && game.post_launch_enabled {
        if let Some(s) = &game.post_launch_script {
            if !s.trim().is_empty() {
                let expanded = crate::script_runner::expand_variables(s, &game);
                let cwd = game.install_directory.as_deref().map(std::path::Path::new);
                // 异步：放到后台线程，避免阻塞命令返回。
                std::thread::spawn(move || {
                    let _ = crate::script_runner::run_script(&expanded, cwd);
                });
            }
        }
    }
```

- [ ] **Step 2: 验证**

```bash
cargo check --manifest-path crates/yungame-core/Cargo.toml
```

Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add crates/yungame-core/src/commands/games.rs
git commit -m "feat: run pre/post launch scripts in launch_game"
```

---

### Task 4: 在 `stop_game_tracking` 接入退出后脚本

**Files:**
- Modify: `crates/yungame-core/src/commands/games.rs`（`stop_game_tracking`）

**Interfaces:**
- Consumes: `script_runner`
- Produces: 停止追踪（游戏退出）时执行退出后脚本。

- [ ] **Step 1: 看 `stop_game_tracking` 现有实现并接入**

找到 `stop_game_tracking`（在 games.rs 第 148 行附近）。它先 `db.get_game(&id)` 拿 game，然后 `process.stop_tracking(&id)`。在拿到 game 后、返回前执行退出后脚本：

```rust
    // 退出后脚本：游戏已退出，执行清理脚本（同步，不阻塞太久）。
    if let Some(g) = &game {
        if g.post_exit_enabled {
            if let Some(s) = &g.post_exit_script {
                if !s.trim().is_empty() {
                    let expanded = crate::script_runner::expand_variables(s, g);
                    let cwd = g.install_directory.as_deref().map(std::path::Path::new);
                    let _ = crate::script_runner::run_script(&expanded, cwd);
                }
            }
        }
    }
```

- [ ] **Step 2: 验证**

```bash
cargo check --manifest-path crates/yungame-core/Cargo.toml
```

Expected: 通过（若 `stop_game_tracking` 没有 `game` 引用，先补 `db.get_game`）。

- [ ] **Step 3: 提交**

```bash
git add crates/yungame-core/src/commands/games.rs
git commit -m "feat: run post-exit script when game stops tracking"
```

---

### Task 5: 新增 `test_script` Tauri 命令

**Files:**
- Modify: `crates/yungame-core/src/commands/games.rs`（或新增 commands/scripts.rs）
- Modify: 命令注册（`lib.rs` 或 `commands/mod.rs`）

**Interfaces:**
- Consumes: `script_runner`
- Produces: `test_script(script: String, game_id: Option<String>) -> Vec<ScriptLineResult>`，管理端测试用，不启动游戏。

- [ ] **Step 1: 写命令**

```rust
/// 管理端"测试脚本"：不启动游戏，只执行传入的脚本并返回每行结果。
#[tauri::command]
pub fn test_script(state: State<AppState>, script: String, game_id: Option<String>) -> crate::Result<Vec<ScriptLineResult>> {
    let cwd = if let Some(id) = &game_id {
        let db = state.db.lock().unwrap();
        db.get_game(id)?.and_then(|g| g.install_directory)
            .map(std::path::PathBuf::from)
    } else {
        None
    };
    let results = crate::script_runner::run_script(&script, cwd.as_deref());
    Ok(results)
}
```

- [ ] **Step 2: 注册命令**

在命令注册处（`lib.rs` 里 `generate_handler!` 或 `.invoke_handler`）加 `commands::games::test_script`。确认 `ScriptLineResult` 导出。

- [ ] **Step 3: 验证**

```bash
cargo check --manifest-path crates/yungame-core/Cargo.toml
```

- [ ] **Step 4: 提交**

```bash
git add crates/yungame-core/src/commands/games.rs crates/yungame-core/src/lib.rs
git commit -m "feat: add test_script command for admin testing"
```

---

### Task 6: 前端 API 加 `testScript`

**Files:**
- Modify: `src/api/client.ts`

**Interfaces:**
- Produces: `testScript(script, gameId?)` 前端方法。

- [ ] **Step 1: 加方法**

在 `src/api/client.ts` 加：

```ts
testScript: (script: string, gameId?: string) =>
  call<{ line: string; ok: boolean; error?: string }[]>("test_script", { script, gameId: gameId ?? null }),
```

- [ ] **Step 2: 验证**

```bash
npm run typecheck
```

- [ ] **Step 3: 提交**

```bash
git add src/api/client.ts
git commit -m "feat: add testScript API"
```

---

### Task 7: 管理端游戏编辑加"脚本"区

**Files:**
- Modify: `admin/src/App.tsx`

**Interfaces:**
- Consumes: 游戏编辑表单的 `Game` 对象、`testScript` API
- Produces: 编辑面板新增"脚本"区：3 个多行文本框 + 启用勾选 + 测试按钮。

- [ ] **Step 1: 在管理端游戏编辑表单加脚本区**

在 `admin/src/App.tsx` 游戏编辑表单里，找到编辑游戏的地方，新增一个"脚本"折叠/区块，包含三段：

```tsx
// 每个脚本区一个小组件：
function ScriptEditor({ label, value, enabled, onValue, onEnabled, onTest }) {
  return (
    <div className="script-editor">
      <label className="script-label">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabled(e.target.checked)} />
        {label}
      </label>
      <textarea
        value={value || ""}
        placeholder="每行一条命令，支持 {InstallDir} {GameName} 等变量"
        rows={3}
        onChange={(e) => onValue(e.target.value)}
      />
      <button type="button" onClick={onTest}>测试脚本</button>
    </div>
  );
}
```

在编辑游戏的状态里，绑定 6 个字段：`preLaunchScript/preLaunchEnabled/postLaunchScript/postLaunchEnabled/postExitScript/postExitEnabled`。

测试按钮调用 `testScript(script, game.id)`，结果（每行 ✓/✗）显示在下方。

- [ ] **Step 2: 验证**

```bash
npm run build:admin
npm run typecheck
```

Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add admin/src/App.tsx
git commit -m "feat: add script editor section to admin game edit"
```

---

### Task 8: i18n 新增脚本相关文案

**Files:**
- Modify: `locales/zh-CN.json` / `locales/zh-TW.json` / `locales/en.json`

**Interfaces:**
- Produces: `script_pre_launch`/`script_post_launch`/`script_post_exit`/`script_enable`/`script_test`/`script_result_ok`/`script_result_fail`/`script_hint` 三份字典可用。

- [ ] **Step 1: 三份 locale 加 key**

```json
"script_pre_launch": "启动游戏前执行",
"script_post_launch": "启动游戏后执行",
"script_post_exit": "退出游戏后执行",
"script_enable": "启用",
"script_test": "测试脚本",
"script_result_ok": "成功",
"script_result_fail": "失败",
"script_hint": "每行一条命令，支持 {InstallDir} {GameName} {AppDir} 等变量"
```

- [ ] **Step 2: 验证**

```bash
node -e "for(const f of ['zh-CN','zh-TW','en']){const j=require('./locales/'+f+'.json');for(const k of ['script_pre_launch','script_post_launch','script_post_exit','script_enable','script_test','script_result_ok','script_result_fail','script_hint']){if(!(k in j)){console.error(f+' missing '+k);process.exit(1)}}}console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: 提交**

```bash
git add locales/zh-CN.json locales/zh-TW.json locales/en.json
git commit -m "feat(i18n): add script editor strings"
```

---

### Task 9: 文档同步 + 质量门禁

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: CHANGELOG 追加**

```markdown
## 2026-08-12
- **新增游戏启动/退出脚本**：每个游戏可配置"启动前/启动后/退出后"三段脚本（每行一条命令），支持 {InstallDir}/{GameName} 等变量展开。启动前同步执行、启动后异步、退出后同步。管理端游戏编辑新增"脚本"区（多行文本框 + 启用勾选 + 测试脚本按钮），新增 test_script 命令。
```

- [ ] **Step 2: 质量门禁**

```bash
cargo check --manifest-path crates/yungame-core/Cargo.toml
npm run typecheck
npm test
```

Expected: 全部通过。

- [ ] **Step 3: 提交**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: document game scripts feature"
```

---

## 自检（Self-Review）

**Spec 覆盖：**
- ✅ 数据模型 6 字段 → Task 1
- ✅ 变量展开 + 逐行执行 → Task 2
- ✅ 启动前/启动后 → Task 3
- ✅ 退出后 → Task 4
- ✅ 测试命令 → Task 5
- ✅ 前端 API → Task 6
- ✅ 管理端 UI（3 文本框 + 启用勾选 + 测试按钮）→ Task 7
- ✅ i18n → Task 8
- ✅ 文档 → Task 9

**占位符扫描：** 无 TBD；每步有代码。

**类型一致性：** `expand_variables(script, game)` / `run_script(script, cwd)` / `test_script(script, game_id)` / `ScriptLineResult` 在 Task 2/5 定义，Task 3/4/6 调用一致。
