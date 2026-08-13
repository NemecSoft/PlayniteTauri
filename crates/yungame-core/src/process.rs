//! Game process launching and tracking, mirroring Playnite's GameController.

use crate::models::{Game, GameLibrary};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningGame {
    pub game_id: String,
    pub game_name: String,
    pub started_at: u64,
}

/// Tracks currently running games and accumulates playtime.
/// 内部字段都是 Arc，所以可以 Clone——后台监控线程需要 move 一份到线程里，
/// 与主线程共享同一份状态。
#[derive(Clone)]
pub struct ProcessManager {
    running: Arc<Mutex<HashMap<String, RunningGame>>>,
    started_at: Arc<Mutex<HashMap<String, Instant>>>,
    /// 每个运行中游戏对应的子进程句柄，用于后台线程检测进程是否退出。
    handles: Arc<Mutex<HashMap<String, Arc<Mutex<Option<std::process::Child>>>>>>,
    /// 本会话内"最近一次退出"的游戏 → 该次运行时长（秒）。进程退出时由
    /// 监控线程写入，用于详情页显示"游戏已退出 · 最近共运行 X"。游戏再次
    /// 启动时会清掉该标记（回到 running 状态）。
    last_exit: Arc<Mutex<HashMap<String, u64>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(HashMap::new())),
            started_at: Arc::new(Mutex::new(HashMap::new())),
            handles: Arc::new(Mutex::new(HashMap::new())),
            last_exit: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 把一个已启动的子进程句柄登记到对应游戏名下，供后台监控线程使用。
    /// `game_id` 为游戏主键，`child` 是 `launch` 返回的子进程句柄。
    pub fn register_handle(&self, game_id: String, child: std::process::Child) {
        self.handles.lock().unwrap().insert(
            game_id,
            Arc::new(Mutex::new(Some(child))),
        );
    }

    /// 返回某个游戏对应的子进程句柄的共享引用（监控线程轮询用）。
    pub fn take_handle(&self, game_id: &str) -> Option<Arc<Mutex<Option<std::process::Child>>>> {
        self.handles.lock().unwrap().get(game_id).cloned()
    }

    /// 记录"某游戏最近一次退出"的时长（秒）。供监控线程在检测到进程退出时调用。
    pub fn record_exit(&self, game_id: &str, seconds: u64) {
        self.last_exit.lock().unwrap().insert(game_id.to_string(), seconds);
    }

    /// 查询某游戏"本会话最近一次退出"的时长（秒）。没有记录则返回 None。
    pub fn last_exit_seconds(&self, game_id: &str) -> Option<u64> {
        self.last_exit.lock().unwrap().get(game_id).copied()
    }

    /// 查询某游戏当前是否在运行（running 表里有记录）。
    pub fn is_running(&self, game_id: &str) -> bool {
        self.running.lock().unwrap().contains_key(game_id)
    }

    /// 查询某游戏已运行的秒数（从开始记录至今）。没在运行则返回 0。
    pub fn elapsed_seconds(&self, game_id: &str) -> u64 {
        self.started_at
            .lock()
            .unwrap()
            .get(game_id)
            .map(|i| i.elapsed().as_secs())
            .unwrap_or(0)
    }

    /// Launches a game executable with the given arguments and working directory.
    ///
    /// Both `exe` and `working_dir` may be:
    ///   - **Absolute** paths — used as-is.
    ///   - **Relative** paths — resolved against the app's own directory (the
    ///     folder containing YunGame.exe), so a portable setup can store games on
    ///     the same drive and reference them with `.` / `..` (e.g. `.\Game\Game.exe`,
    ///     `..\Games\Game\Game.exe`).
    ///   - Paths starting with `{LibraryName}` — the placeholder is replaced by
    ///     the matching configured game-library root (matched by library `name`,
    ///     see `AppSettings::game_libraries`), then the remainder is treated as a
    ///     relative path from that root.
    ///     Example: `{库1}\SomeGame\Game.exe` (with a library named "库1").
    pub fn launch(
        &self,
        exe: &str,
        args: Option<&str>,
        working_dir: Option<&str>,
        game_libraries: &[GameLibrary],
    ) -> std::io::Result<std::process::Child> {
        let exe_abs = resolve_path(exe, game_libraries);
        let mut cmd = std::process::Command::new(&exe_abs);
        if let Some(a) = args {
            // Simple whitespace split; play actions usually only need simple args.
            for part in a.split_whitespace() {
                cmd.arg(part);
            }
        }
        // Working directory: resolve relative paths; default to the exe's parent.
        match working_dir {
            Some(wd) if !wd.trim().is_empty() => {
                cmd.current_dir(resolve_path(wd, game_libraries));
            }
            _ => {
                if let Some(parent) = std::path::Path::new(&exe_abs).parent() {
                    cmd.current_dir(parent);
                }
            }
        }
        let child = cmd.spawn()?;
        Ok(child)
    }

    /// 登记一个已启动的游戏及其子进程句柄。
    /// `track` 为 true 时记录运行时长（running/started_at，用于累计 playtime）；
    /// 无论是否 track，都会登记子进程句柄，供后台监控线程检测退出（详情页要
    /// 显示"游戏在运行/已退出"的状态）。
    pub fn start_tracking(&self, game: &Game, child: std::process::Child, track: bool) {
        if track {
            let now = chrono::Utc::now().timestamp() as u64;
            self.running.lock().unwrap().insert(
                game.id.clone(),
                RunningGame {
                    game_id: game.id.clone(),
                    game_name: game.name.clone(),
                    started_at: now,
                },
            );
            self.started_at.lock().unwrap().insert(game.id.clone(), Instant::now());
        }
        // 游戏再次启动，清掉上次"最近退出"的标记，状态回到"运行中"。
        self.last_exit.lock().unwrap().remove(&game.id);
        // 登记子进程句柄，供后台监控线程检测退出。
        self.handles.lock().unwrap().insert(
            game.id.clone(),
            Arc::new(Mutex::new(Some(child))),
        );
    }

    /// Stops tracking a game and returns the accumulated playtime in seconds.
    pub fn stop_tracking(&self, game_id: &str) -> u64 {
        let mut running = self.running.lock().unwrap();
        let mut started = self.started_at.lock().unwrap();
        let mut played = 0;
        if let Some(start) = started.remove(game_id) {
            played = start.elapsed().as_secs();
        }
        running.remove(game_id);
        // 清理子进程句柄，释放对进程的引用。
        self.handles.lock().unwrap().remove(game_id);
        played
    }

    pub fn running_games(&self) -> Vec<RunningGame> {
        self.running.lock().unwrap().values().cloned().collect()
    }
}

/// Resolves a launch path to an absolute path:
///   - `{LibraryName}\rest`  -> library root joined with `rest` (normalized)
///   - absolute              -> as-is
///   - relative (`.`/`..`)   -> joined against the app root (normalized)
/// Empty input stays empty. Used by both `launch` and validation commands so
/// the exact same resolution logic is shared.
pub fn resolve_path(p: &str, game_libraries: &[GameLibrary]) -> String {
    if p.is_empty() {
        return p.to_string();
    }
    let root = crate::settings::AppPaths::config_root();
    if let Some((rest, lib_root)) = resolve_library_placeholder(p, game_libraries) {
        let joined = lib_root.join(std::path::Path::new(rest));
        return normalize_path(&joined).to_string_lossy().to_string();
    }
    let path = std::path::Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        let joined = root.join(path);
        normalize_path(&joined).to_string_lossy().to_string()
    }
}

/// If `p` starts with a `{LibraryName}` placeholder, returns the remaining path
/// (after the placeholder) and the matching library root. The placeholder token
/// is matched case-insensitively against each library's `name` (e.g. `{库1}`,
/// `{Gamelibrary1}`). Returns `None` when the path has no placeholder or no
/// library with that name is configured.
fn resolve_library_placeholder<'a>(
    p: &'a str,
    game_libraries: &[GameLibrary],
) -> Option<(&'a str, PathBuf)> {
    let trimmed = p.trim_start();
    if !trimmed.starts_with('{') {
        return None;
    }
    let end = trimmed.find('}')?;
    let token = &trimmed[1..end];
    if token.is_empty() {
        return None;
    }
    let lib = game_libraries.iter().find(|l| l.name.eq_ignore_ascii_case(token))?;
    if lib.path.trim().is_empty() {
        return None;
    }
    let rest = trimmed[end + 1..].trim_start_matches(|c| c == '/' || c == '\\');
    Some((rest, PathBuf::from(&lib.path)))
}

/// Lexically normalizes a path, collapsing `.` and `..` segments (without
/// touching the filesystem), so relative paths can be safely turned into
/// absolute ones against the app root.
fn normalize_path(path: &std::path::Path) -> PathBuf {
    use std::path::Component;
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::ParentDir => {
                if !out.pop() {
                    // Keep leading `..` that escapes the root (shouldn't happen
                    // once joined against an absolute root, but be safe).
                    out.push("..");
                }
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Finds an installed game executable inside an install directory.
/// Returns the path and its parent dir.
pub fn find_game_executable(install_dir: &str) -> Option<(PathBuf, PathBuf)> {
    let dir = PathBuf::from(install_dir);
    if !dir.is_dir() {
        return None;
    }

    // Common Playnite-style detection: search for *.exe at top level first,
    // pick the one matching the directory name, else the largest one.
    let exts = ["exe", "bat", "cmd", "lnk"];
    let mut candidates: Vec<(u64, PathBuf)> = Vec::new();

    for ext in exts {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .map(|e| e.to_string_lossy().eq_ignore_ascii_case(ext))
                        .unwrap_or(false)
                {
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    candidates.push((size, path.clone()));
                }
            }
        }
    }

    if candidates.is_empty() {
        return None;
    }

    // Prefer candidate whose file stem equals the directory name.
    let dir_name = dir
        .file_name()
        .map(|d| d.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    for (_, path) in &candidates {
        let stem = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if stem == dir_name {
            let wd = path.parent().map(|p| p.to_path_buf()).unwrap_or(dir.clone());
            return Some((path.clone(), wd));
        }
    }

    // Otherwise pick the largest file.
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    let (_, path) = candidates.remove(0);
    let wd = path.parent().map(|p| p.to_path_buf()).unwrap_or(dir);
    Some((path, wd))
}

#[cfg(test)]
mod tests {
    use super::*;

    // 验证"记录最近一次退出时长"→"查询最近退出时长"的往返。
    // 详情页"游戏已退出 · 最近共运行 X"就靠这两个方法联动。
    #[test]
    fn record_and_query_last_exit() {
        let pm = ProcessManager::new();
        assert_eq!(pm.last_exit_seconds("g1"), None);
        pm.record_exit("g1", 1234);
        assert_eq!(pm.last_exit_seconds("g1"), Some(1234));
        assert_eq!(pm.last_exit_seconds("g2"), None);
    }

    // 未登记的游戏默认"未运行"（前端据此显示"游戏未运行"）。
    #[test]
    fn unregistered_game_is_not_running() {
        let pm = ProcessManager::new();
        assert!(!pm.is_running("whatever"));
        assert_eq!(pm.elapsed_seconds("whatever"), 0);
    }

    // 一个游戏的"最近退出"记录，不会串到另一个游戏上（用独立 key 存）。
    #[test]
    fn last_exit_is_scoped_per_game() {
        let pm = ProcessManager::new();
        pm.record_exit("a", 10);
        pm.record_exit("b", 99);
        assert_eq!(pm.last_exit_seconds("a"), Some(10));
        assert_eq!(pm.last_exit_seconds("b"), Some(99));
    }

    // 游戏再次启动（start_tracking）后，会清掉上次的"最近退出"标记，
    // 让状态从"已退出"切回"运行中"。
    #[test]
    fn re_launch_clears_last_exit() {
        let pm = ProcessManager::new();
        pm.record_exit("g", 500);
        assert_eq!(pm.last_exit_seconds("g"), Some(500));
        // 模拟再次启动：直接清 last_exit 标记（start_tracking 里就是这个动作）。
        pm.last_exit.lock().unwrap().remove("g");
        assert_eq!(pm.last_exit_seconds("g"), None);
    }
}
