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
pub struct ProcessManager {
    running: Arc<Mutex<HashMap<String, RunningGame>>>,
    started_at: Arc<Mutex<HashMap<String, Instant>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(HashMap::new())),
            started_at: Arc::new(Mutex::new(HashMap::new())),
        }
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
    ) -> std::io::Result<()> {
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
        cmd.spawn()?;
        Ok(())
    }

    pub fn start_tracking(&self, game: &Game) {
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

    /// Stops tracking a game and returns the accumulated playtime in seconds.
    pub fn stop_tracking(&self, game_id: &str) -> u64 {
        let mut running = self.running.lock().unwrap();
        let mut started = self.started_at.lock().unwrap();
        let mut played = 0;
        if let Some(start) = started.remove(game_id) {
            played = start.elapsed().as_secs();
        }
        running.remove(game_id);
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
