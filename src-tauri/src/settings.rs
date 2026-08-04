//! Paths & settings helpers.
//!
//! Fully portable (green) build: all data is stored in the application's own
//! directory (next to Playnite.DesktopApp.exe). Nothing is written to
//! %LOCALAPPDATA%, the registry, or anywhere on the C drive.

use std::path::PathBuf;

/// Application paths rooted at the executable's own directory.
pub struct AppPaths;

impl AppPaths {
    /// The root configuration directory = the directory containing the
    /// executable. This keeps the app 100% portable / green.
    pub fn config_root() -> PathBuf {
        std::env::current_exe()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()).ok_or(std::io::Error::new(
                std::io::ErrorKind::Other,
                "no parent",
            )))
            .unwrap_or_else(|_| PathBuf::from("."))
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

    /// Full path to the startup announcement file.
    pub fn announcement_file() -> PathBuf {
        Self::announcements_dir().join("announcement.html")
    }
}
