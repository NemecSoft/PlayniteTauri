//! Library scanning & import, mirroring Playnite's installed-game import.
//! Detects installed games across common launchers (Steam, GOG, Epic, ...)
//! and scans local directories for game executables.

use crate::db::{self, Database};
use crate::models::{Game, ScannedGame};
use std::path::PathBuf;

const GAME_EXTENSIONS: [&str; 4] = ["exe", "bat", "cmd", "lnk"];

/// Scans a directory tree for candidate game executables.
/// Mirrors Playnite's installed game scan (top-level exes preferred).
pub fn scan_directory(root: &str, depth: u32) -> Vec<ScannedGame> {
    let mut out = Vec::new();
    let root = PathBuf::from(root);
    if !root.is_dir() {
        return out;
    }
    scan_dir_rec(&root, &root, depth, &mut out);
    out
}

fn scan_dir_rec(
    root: &PathBuf,
    dir: &PathBuf,
    depth: u32,
    out: &mut Vec<ScannedGame>,
) {
    let rel = dir.strip_prefix(root).unwrap_or(dir);
    let level = rel.components().count();
    if level as u32 > depth {
        return;
    }

    let mut entries = match std::fs::read_dir(dir) {
        Ok(e) => e.flatten().collect::<Vec<_>>(),
        Err(_) => return,
    };
    entries.sort_by_key(|e| e.file_name());

    // First pass: top-level executables in this directory.
    let mut subdirs = Vec::new();
    for entry in &entries {
        let path = entry.path();
        if path.is_dir() {
            subdirs.push(path.clone());
        } else if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            if GAME_EXTENSIONS.contains(&ext.as_str()) {
                let name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Unknown".to_string());
                out.push(ScannedGame {
                    path: path.to_string_lossy().to_string(),
                    name,
                    install_directory: path
                        .parent()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    is_installed: true,
                });
            }
        }
    }

    for sub in subdirs {
        scan_dir_rec(root, &sub, depth, out);
    }
}

/// Imports scanned games into the database as manual games.
pub fn import_games(db: &Database, scanned: Vec<ScannedGame>) -> crate::db::DbResult<usize> {
    let mut games = Vec::new();
    for s in scanned {
        let now = chrono::Utc::now().to_rfc3339();
        let action = db::make_file_action("Play", &s.path);
        games.push(Game {
            id: uuid::Uuid::new_v4().to_string(),
            name: s.name,
            sort_name: None,
            localized_names: Vec::new(),
            alternate_names: Vec::new(),
            game_id: None,
            installed: true,
            install_directory: Some(s.install_directory),
            play_task: Some(action.id.clone()),
            other_tasks: Vec::new(),
            last_played: None,
            play_count: 0,
            last_activity: None,
            playtime: 0,
            added: now.clone(),
            modified: now,
            category: Vec::new(),
            genre: Vec::new(),
            developer: Vec::new(),
            publisher: Vec::new(),
            tags: Vec::new(),
            series: Vec::new(),
            age_rating: Vec::new(),
            region: Vec::new(),
            source: Vec::new(),
            features: Vec::new(),
            release_date: None,
            community_score: None,
            critic_score: None,
            user_score: None,
            hidden: false,
            favorite: false,
            background_image: None,
            cover_image: None,
            icon: None,
            description: None,
            notes: None,
            version: None,
            platform: Vec::new(),
            emulator: None,
            completion_status: None,
            user_score_set: false,
            manual_game: true,
            plugin_id: None,
            links: db::empty_links(),
            actions: vec![action],
            features_enabled: false,
            guide: None,
            screenshots: Vec::new(),
            videos: Vec::new(),
            game_library: None,
            game_level: 1,
        });
    }
    db.upsert_games(&games)?;
    Ok(games.len())
}

/// Steam library scan - reads libraryfolders.vdf to find Steam game dirs.
/// Returns list of game install directories and their app ids when available.
#[cfg(windows)]
pub fn scan_steam_library() -> Vec<String> {
    use std::io::Read;
    let mut dirs = Vec::new();
    let steam_root = {
        let key = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        if let Ok(sub) = key.open_subkey(r"Software\Valve\Steam") {
            sub.get_value::<String, _>("SteamPath").ok()
        } else {
            None
        }
    };

    let steam_path = steam_root.map(PathBuf::from);
    let mut library_folders = Vec::new();
    if let Some(steam) = steam_path {
        let manifest_path = steam.join("steamapps").join("libraryfolders.vdf");
        if let Ok(mut f) = std::fs::File::open(&manifest_path) {
            let mut content = String::new();
            if f.read_to_string(&mut content).is_ok() {
                // Simple parser for "path" lines inside libraryfolders.vdf
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with('"') && trimmed.contains("path") && trimmed.contains("\\\\") {
                        if let Some(start) = trimmed.find('"') {
                            let rest = &trimmed[start + 1..];
                            if let Some(end) = rest.find('"') {
                                let p = rest[..end].replace("\\\\", "\\");
                                library_folders.push(PathBuf::from(p));
                            }
                        }
                    }
                }
            }
        }
    }

    for folder in library_folders {
        let apps = folder.join("steamapps").join("common");
        if let Ok(entries) = std::fs::read_dir(&apps) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    dirs.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    dirs
}

#[cfg(not(windows))]
pub fn scan_steam_library() -> Vec<String> {
    Vec::new()
}
