//! Application settings stored in `config.json` (next to the executable),
//! decoupled from the SQLite database. This keeps user preferences portable
//! and separate from game-library / user data.

use crate::models::AppSettings;
use crate::settings::AppPaths;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Simple wrapper so the JSON file has a stable top-level shape.
#[derive(Serialize, Deserialize)]
struct ConfigFile {
    settings: AppSettings,
}

fn config_file_path() -> PathBuf {
    AppPaths::config_path()
}

/// Load application settings from `config.json`. Returns defaults if the file
/// is missing or malformed.
pub fn load_app_settings() -> AppSettings {
    let path = config_file_path();
    if !path.exists() {
        return AppSettings::default();
    }
    let Ok(text) = std::fs::read_to_string(&path) else {
        return AppSettings::default();
    };
    serde_json::from_str::<ConfigFile>(&text)
        .map(|f| f.settings)
        .unwrap_or_default()
}

/// Persist application settings to `config.json` (pretty-printed).
pub fn save_app_settings(settings: &AppSettings) -> crate::Result<()> {
    let path = config_file_path();
    let text = serde_json::to_string_pretty(&ConfigFile {
        settings: settings.clone(),
    })
    .map_err(|e| crate::AppError::Other(format!("serialize config: {}", e)))?;
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, text)
        .map_err(|e| crate::AppError::Other(format!("write config: {}", e)))?;
    Ok(())
}
