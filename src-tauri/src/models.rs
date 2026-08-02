//! Core domain models mirroring Playnite's SDK data model.
//! These are serialized to JSON and consumed by the React frontend.

use serde::{Deserialize, Serialize};

/// The platform a game runs on (e.g. PC, Steam, PS4, Switch...).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Platform {
    pub id: String,
    pub name: String,
    pub specification_id: Option<String>,
    pub icon: Option<String>,
}

/// A launch action that runs a game executable.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameAction {
    pub id: String,
    pub name: String,
    pub r#type: String, // "File" | "URL"
    pub path: Option<String>,
    pub working_dir: Option<String>,
    pub arguments: Option<String>,
    pub is_play_action: bool,
    pub track_game: bool,
}

/// A localized / alternate name for a game, tagged with a language code.
/// This extends the original Playnite model which only had a single `name`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameName {
    /// BCP-47-ish language tag, e.g. "en", "zh-CN", "zh-TW", "ja", "ko".
    pub language: String,
    /// The localized name in that language.
    pub name: String,
}

/// The main game entity. Extends Playnite.SDK.Models.Game with multi-name
/// support (`localized_names` + `alternate_names`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    /// Primary display name (usually the original English title).
    pub name: String,
    /// Optional alternate/sort title.
    pub sort_name: Option<String>,
    /// Localized names across languages (zh-CN, zh-TW, ja, ko, ...).
    #[serde(default)]
    pub localized_names: Vec<GameName>,
    /// Unofficial nicknames / colloquial aliases without a language tag
    /// (e.g. "三男一狗", "车枪大战").
    #[serde(default)]
    pub alternate_names: Vec<String>,
    pub game_id: Option<String>,
    pub installed: bool,
    pub install_directory: Option<String>,
    pub play_task: Option<String>,
    pub other_tasks: Vec<String>,
    pub last_played: Option<String>,
    pub play_count: u32,
    pub last_activity: Option<String>,
    pub playtime: u64,
    pub added: String,
    pub modified: String,
    pub category: Vec<String>,
    pub genre: Vec<String>,
    pub developer: Vec<String>,
    pub publisher: Vec<String>,
    pub tags: Vec<String>,
    pub series: Vec<String>,
    pub age_rating: Vec<String>,
    pub region: Vec<String>,
    pub source: Vec<String>,
    pub features: Vec<String>,
    pub release_date: Option<String>,
    pub community_score: Option<i32>,
    pub critic_score: Option<i32>,
    pub user_score: Option<i32>,
    pub hidden: bool,
    pub favorite: bool,
    pub background_image: Option<String>,
    pub cover_image: Option<String>,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub version: Option<String>,
    pub platform: Vec<String>,
    pub emulator: Option<String>,
    pub completion_status: Option<String>,
    pub user_score_set: bool,
    pub manual_game: bool,
    pub plugin_id: Option<String>,
    pub links: Vec<GameLink>,
    pub actions: Vec<GameAction>,
    pub features_enabled: bool,
}

/// A game link (website, store page, ...).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameLink {
    pub name: String,
    pub url: String,
}

/// Settings that mirror Playnite's settings model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub startup_behavior: String,        // "StartMinimized" | "StartMinimizedTray" | "StartNormal"
    pub enable_tray: bool,
    pub minimize_to_tray: bool,
    pub close_to_tray: bool,
    pub theme: String,
    pub language: String,
    pub first_time_wizard_complete: bool,
    pub database_path: Option<String>,
    pub auto_backup_enabled: bool,
    pub grid_view_image: String,          // "Cover" | "Background" | "Icon"
    pub details_view_image: String,       // "Cover" | "Background" | "Icon"
    pub list_view_image: String,          // "Cover" | "Background" | "Icon"
    pub show_installed_only: bool,
    pub show_hidden: bool,
    pub show_favorites: bool,
    pub sort_order: String,
    pub sort_direction: String,
    pub fullscreen_mode: bool,
    pub controller_support: bool,
    /// Whether the login screen is shown on startup.
    #[serde(default)]
    pub login_enabled: bool,
    /// Login method: "wechat" (QR scan) or "account" (username/password).
    #[serde(default)]
    pub login_type: String,
    /// Whether the current session is logged in.
    #[serde(default)]
    pub logged_in: bool,
    /// Logged-in username (for account login).
    #[serde(default)]
    pub username: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            startup_behavior: "StartNormal".into(),
            enable_tray: true,
            minimize_to_tray: false,
            close_to_tray: false,
            theme: "Default".into(),
            language: "en-US".into(),
            first_time_wizard_complete: false,
            database_path: None,
            auto_backup_enabled: true,
            grid_view_image: "Cover".into(),
            details_view_image: "Background".into(),
            list_view_image: "Icon".into(),
            show_installed_only: false,
            show_hidden: false,
            show_favorites: false,
            sort_order: "Name".into(),
            sort_direction: "Ascending".into(),
            fullscreen_mode: false,
            controller_support: false,
            login_enabled: false,
            login_type: "wechat".into(),
            logged_in: false,
            username: None,
        }
    }
}

/// Aggregated library statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub total_games: u64,
    pub installed_games: u64,
    pub installed_pct: f64,
    pub total_playtime: u64,
    pub total_size: u64,
    pub favorite_games: u64,
    pub hidden_games: u64,
    pub platform_breakdown: Vec<PlatformCount>,
    pub genre_breakdown: Vec<PlatformCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCount {
    pub name: String,
    pub count: u64,
}

/// A library plugin registration (mirrors Playnite library plugin concept).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPluginInfo {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub enabled: bool,
}

/// Describes a discovered executable in the import scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedGame {
    pub path: String,
    pub name: String,
    pub install_directory: String,
    pub is_installed: bool,
}
