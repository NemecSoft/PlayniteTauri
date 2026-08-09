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

/// A game library: a named collection of games living under one root directory.
/// The `name` is user-editable (e.g. "库1", "库2", "Gamelibrary1") and is used
/// as the placeholder token in launch-action paths (`{name}\SomeGame\Game.exe`).
/// The `path` is the absolute root directory where those games are stored.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameLibrary {
    /// Unique id (UUID). Auto-assigned on creation; empty for legacy entries
    /// until the next save.
    #[serde(default)]
    pub id: String,
    /// User-editable display / placeholder name (e.g. "库1", "Gamelibrary1").
    #[serde(default)]
    pub name: String,
    /// Absolute root directory of the library (e.g. `D:\Games`).
    #[serde(default)]
    pub path: String,
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

/// A gameplay/live video attached to a game.
/// - `type = "youtube"` -> `url` is a YouTube watch URL (embedded as iframe).
/// - `type = "file"`    -> `url` is a local/remote video file path.
/// - `type = "url"`     -> `url` is a generic video URL (embedded via <video>).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameVideo {
    pub r#type: String, // "youtube" | "file" | "url"
    pub url: String,
    pub name: Option<String>,
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
    /// HTML guide / how-to-play instructions shown on the detail page.
    #[serde(default)]
    pub guide: Option<String>,
    /// Screenshot / gallery image URLs (supports gif/png/jpg/...).
    #[serde(default)]
    pub screenshots: Vec<String>,
    /// Gameplay / live videos (type: youtube / file / url).
    #[serde(default)]
    pub videos: Vec<GameVideo>,
    /// Name of the game library this game belongs to (each game belongs to at
    /// most one library). `None` means "uncategorized". Matches a `GameLibrary`
    /// by its `name` field (case-insensitive). Setting this is purely an
    /// organizational / filtering aid — launch paths still resolve against the
    /// `GameLibrary` list by `{name}` placeholder independently.
    #[serde(default)]
    pub game_library: Option<String>,
    /// Access level required to play this game: 1 | 2 | 3.
    /// A user with level N can play any game whose `game_level` <= N.
    #[serde(default = "default_game_level")]
    pub game_level: i32,
}

fn default_game_level() -> i32 {
    1
}

/// A game link (website, store page, ...).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameLink {
    pub name: String,
    pub url: String,
}

/// A unified user record. Both enterprise users (cafes, matched by public IP)
/// and personal users (login accounts) live in the same `users` table,
/// distinguished by `kind`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppUser {
    /// Auto-generated UUID.
    pub id: String,
    /// Login account name (enterprise users may use the IP as account).
    pub account: String,
    /// Password hash (see `auth.rs`). Empty for enterprise users.
    pub password_hash: String,
    /// Display name (e.g. "横贯电竞歪歪楼店").
    pub name: String,
    /// Access level: 1 | 2 | 3.
    pub level: i32,
    /// User category: "enterprise" | "personal".
    pub kind: String,
    /// Public IP address used to match enterprise users. Empty for personal.
    pub ip_address: String,
    /// When the account was created.
    pub created_at: String,
    /// Soft-delete marker: `Some(timestamp)` when the user was deleted but kept
    /// for undo/restore. `None` means active. Deleted users are hidden from
    /// listings and cannot log in.
    #[serde(default)]
    pub deleted_at: Option<String>,
}

/// The access level of the current session, determined at login time from
/// either the enterprise IP config or a personal account.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUser {
    /// "enterprise" | "personal".
    pub kind: String,
    /// Display name.
    pub name: String,
    /// Matched account / IP.
    pub account: String,
    /// Access level 1 | 2 | 3.
    pub level: i32,
}

/// Settings that mirror Playnite's settings model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub startup_behavior: String,        // "StartMinimized" | "StartMinimizedTray" | "StartNormal"
    pub enable_tray: bool,
    pub minimize_to_tray: bool,
    pub close_to_tray: bool,
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
    /// Whether to record play time when launching games.
    #[serde(default = "default_true")]
    pub track_playtime: bool,
    /// Grid card width in px. Range ~120..320.
    #[serde(default = "default_card_width")]
    pub card_width: i32,
    /// Gap between grid cards in px. Range 0..20.
    #[serde(default = "default_card_gap")]
    pub card_gap: i32,
    /// Left sidebar width in px (user-resizable). Range 160..600.
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: i32,
    /// Path to the enterprise user config JSON (default "D:/1.json").
    #[serde(default = "default_enterprise_config_path")]
    pub enterprise_config_path: String,
    /// Game libraries: each is a `{ name, path }` pair. The `name` is a
    /// user-editable placeholder token (e.g. "库1", "库2", "Gamelibrary1") and
    /// `path` is the absolute root directory where that library's games live.
    /// Launch-action paths reference a library via `{name}\SomeGame\Game.exe`,
    /// resolved at launch time by looking up the matching library name.
    ///
    /// Backward compatible: older configs stored `Vec<String>` (plain paths);
    /// those are migrated into `{ name: "GamelibraryN", path }` entries.
    #[serde(default, deserialize_with = "deserialize_game_libraries")]
    pub game_libraries: Vec<GameLibrary>,
    /// Current session user kind: "enterprise" | "personal" | "".
    #[serde(default)]
    pub current_user_kind: String,
    /// Current session user display name.
    #[serde(default)]
    pub current_user_name: String,
    /// Current session user level (1 | 2 | 3), default 3 = full access.
    #[serde(default = "default_user_level")]
    pub current_user_level: i32,
    /// User-selected UI font family. Empty = use the theme's default font.
    #[serde(default)]
    pub font_family: String,
}

fn default_enterprise_config_path() -> String {
    "D:/1.json".into()
}

fn default_user_level() -> i32 {
    3
}

fn default_card_width() -> i32 {
    180
}

/// Compatibility deserializer for `game_libraries`: accepts BOTH the current
/// `[{ "name", "path" }]` shape AND the legacy `["path", ...]` string-array
/// shape (which becomes `{ name: "GamelibraryN", path }` using 1-based names).
fn deserialize_game_libraries<'de, D>(d: D) -> Result<Vec<GameLibrary>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Entry {
        Str(String),
        Obj(GameLibrary),
    }
    let items = Vec::<Entry>::deserialize(d)?;
    Ok(items
        .into_iter()
        .enumerate()
        .map(|(i, e)| match e {
            Entry::Str(p) => GameLibrary {
                id: format!("lib-legacy-{}", i + 1),
                name: format!("Gamelibrary{}", i + 1),
                path: p,
            },
            Entry::Obj(mut l) => {
                if l.id.is_empty() {
                    l.id = format!("lib-legacy-{}", i + 1);
                }
                l
            }
        })
        .collect())
}

fn default_card_gap() -> i32 {
    8
}

fn default_sidebar_width() -> i32 {
    210
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            startup_behavior: "StartNormal".into(),
            enable_tray: true,
            minimize_to_tray: false,
            close_to_tray: false,
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
            track_playtime: true,
            card_width: 180,
            card_gap: 8,
            sidebar_width: 210,
            enterprise_config_path: "D:/1.json".into(),
            game_libraries: Vec::new(),
            current_user_kind: "".into(),
            current_user_name: "".into(),
            current_user_level: 3,
            font_family: "".into(),
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
