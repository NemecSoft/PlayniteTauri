//! Game process launching and tracking, mirroring Playnite's GameController.

use crate::models::Game;
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
    pub fn launch(
        &self,
        exe: &str,
        args: Option<&str>,
        working_dir: Option<&str>,
    ) -> std::io::Result<()> {
        let mut cmd = std::process::Command::new(exe);
        if let Some(a) = args {
            // Simple whitespace split; play actions usually only need simple args.
            for part in a.split_whitespace() {
                cmd.arg(part);
            }
        }
        if let Some(wd) = working_dir {
            cmd.current_dir(wd);
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
