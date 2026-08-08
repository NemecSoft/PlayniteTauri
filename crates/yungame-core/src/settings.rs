//! Paths & settings helpers.
//!
//! Data directory resolution: by default the app reads/writes everything from
//! the executable's own directory (fully portable / green). A custom data
//! directory can be set in the Windows registry:
//!
//!   `HKEY_CURRENT_USER\Software\YunGame`  ->  value `DataDir` (REG_SZ path)
//!
//! When that value exists and is non-empty, it overrides the default root for
//! ALL data (database, config.json, CoverImages, etc.). This lets an admin
//! relocate the data store without moving the exe (e.g. point it to a shared
//! network folder or a specific drive).

use std::path::PathBuf;

/// Application paths rooted at the (configurable) data directory.
pub struct AppPaths;

impl AppPaths {
    /// Windows registry key used to override the data directory.
    pub const REG_KEY: &'static str = r"Software\YunGame";
    /// Windows registry value holding the custom data directory path.
    pub const REG_VALUE: &'static str = "DataDir";

    /// The root configuration / data directory.
    ///
    /// Resolution order:
    ///   1. `HKCU\Software\YunGame\DataDir` (if set & non-empty) — admin override.
    ///   2. Otherwise the directory containing the executable (green / portable).
    ///
    /// In **debug** builds (i.e. `tauri dev` / `cargo build --debug`) the
    /// binary lives under `target/debug`, but we want dev mode to read/write
    /// the SAME data as the shipped client (the project's `release/` folder).
    /// So debug builds pin the default root to `<project>/release` unless a
    /// registry override is present.
    pub fn config_root() -> PathBuf {
        if let Some(dir) = Self::registry_data_dir() {
            return dir;
        }

        #[cfg(debug_assertions)]
        {
            let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR")); // e.g. .../src-tauri
            if let Some(parent) = manifest.parent() {
                return parent.join("release");
            }
        }
        std::env::current_exe()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()).ok_or(std::io::Error::new(
                std::io::ErrorKind::Other,
                "no parent",
            )))
            .unwrap_or_else(|_| PathBuf::from("."))
    }

    /// Reads the custom data directory from the Windows registry, if set.
    fn registry_data_dir() -> Option<PathBuf> {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu.open_subkey(Self::REG_KEY).ok()?;
        let value: String = key.get_value(Self::REG_VALUE).ok()?;
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return None;
        }
        let path = PathBuf::from(trimmed);
        // Only accept absolute paths to avoid surprising relative resolution.
        if path.is_absolute() {
            Some(path)
        } else {
            None
        }
    }

    /// Full path to the SQLite database file (next to the executable).
    pub fn database_path() -> PathBuf {
        Self::config_root().join("library").join("library.db")
    }

    /// Full path to the application config file (JSON, next to the exe).
    pub fn config_path() -> PathBuf {
        Self::config_root().join("config.json")
    }

    /// Directory for game cover/background images (next to the executable).
    pub fn images_dir() -> PathBuf {
        Self::config_root().join("library").join("images")
    }

    /// Directory where users drop cover images named after the game's Chinese
    /// name. Auto-matched to games on load (see `covers.rs`).
    pub fn cover_images_dir() -> PathBuf {
        Self::config_root().join("CoverImages")
    }

    /// Directory where scanned/imported metadata is cached.
    pub fn cache_dir() -> PathBuf {
        Self::config_root().join("cache")
    }

    /// Directory for plugins / extensions.
    pub fn plugins_dir() -> PathBuf {
        Self::config_root().join("extensions").join("plugins")
    }

    /// Directory for announcement HTML files (read at startup).
    pub fn announcements_dir() -> PathBuf {
        Self::config_root().join("announcements")
    }

    /// Root directory that stores per-game static detail pages, one sub-folder
    /// per game named after the game's display name (e.g.
    /// `Game_Details/赛菲莉娅-网吧联机版/index.html` with `css/` and `js/`).
    pub fn games_html_dir() -> PathBuf {
        Self::config_root().join("Game_Details")
    }

    /// Full path to the startup announcement file.
    pub fn announcement_file() -> PathBuf {
        Self::announcements_dir().join("announcement.html")
    }
}
