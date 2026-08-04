//! Playnite Tauri backend library.
//! Holds the shared application state and registers all Tauri commands.

pub mod auth;
pub mod autotags;
pub mod commands;
pub mod config;
pub mod covers;
pub mod db;
pub mod library;
pub mod models;
pub mod plugins;
pub mod process;
pub mod sample_data;
pub mod settings;
pub mod system;

use db::Database;
use plugins::PluginHost;
use process::ProcessManager;
use settings::AppPaths;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use thiserror::Error;

/// Application-wide error type, serialized to JSON for the frontend.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Db(#[from] db::DbError),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("launch failed: {0}")]
    Launch(String),
    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

/// Shared application state, managed by Tauri.
/// `db` and `plugins` are wrapped in a `Mutex` for interior mutability,
/// because `rusqlite::Connection` is `Send` but not `Sync`, and plugins are
/// mutated during discovery.
pub struct AppState {
    pub db: Mutex<Database>,
    pub process: ProcessManager,
    pub plugins: Mutex<PluginHost>,
    pub config_root: PathBuf,
}

/// One record in the game catalog JSON file
/// (`Gameid-InstallDirectory-GameName.json`). The legacy file uses PascalCase
/// keys (Gameid, InstallDirectory, GameName), so map snake_case fields to them.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct GameCatalogRecord {
    pub gameid: String,
    pub install_directory: String,
    pub game_name: String,
}

/// Performs a one-time migration of the game catalog from the temporary JSON
/// file (`Gameid-InstallDirectory-GameName.json`) into the real database.
///
/// The JSON is only a data source for the initial import: on the first launch
/// we clear the previous (sample) games and import the records, keeping each
/// `Gameid` as the database `id`. A flag in `settings` records that the import
/// has already run, so later launches read the database and never re-import —
/// the JSON file can then be deleted.
///
/// Returns the number of games imported (0 if skipped / file missing).
fn import_game_catalog(db: &Database) -> usize {
    // Already imported on a previous run -> do nothing.
    if db
        .get_setting("game_catalog_imported")
        .ok()
        .flatten()
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        return 0;
    }
    // The JSON is a temporary data source (may be deleted after import). Try to
    // read it at runtime from a few well-known locations; if it's missing we
    // simply skip (the import flag already set on a previous run prevents
    // clearing the database).
    let mut text = None;
    for p in [
        AppPaths::config_root().join("assets").join("Gameid-InstallDirectory-GameName.json"),
        AppPaths::config_root().join("Gameid-InstallDirectory-GameName.json"),
        std::path::PathBuf::from("assets/Gameid-InstallDirectory-GameName.json"),
    ] {
        if let Ok(t) = std::fs::read_to_string(&p) {
            text = Some(t);
            break;
        }
    }
    let Some(text) = text else {
        return 0;
    };
    let Ok(records) = serde_json::from_str::<Vec<GameCatalogRecord>>(&text) else {
        return 0;
    };
    let now = chrono::Utc::now().to_rfc3339();
    let mut games: Vec<models::Game> = Vec::new();
    for r in records {
        let id = r.gameid.trim().to_string();
        if id.is_empty() {
            continue;
        }
        let dir = r.install_directory.trim().to_string();
        let action = db::make_file_action("Play", &dir);
        games.push(models::Game {
            id,
            name: if r.game_name.trim().is_empty() {
                dir.clone()
            } else {
                r.game_name.trim().to_string()
            },
            sort_name: None,
            localized_names: Vec::new(),
            alternate_names: Vec::new(),
            game_id: None,
            installed: true,
            install_directory: Some(dir),
            play_task: Some(action.id.clone()),
            other_tasks: Vec::new(),
            last_played: None,
            play_count: 0,
            last_activity: None,
            playtime: 0,
            added: now.clone(),
            modified: now.clone(),
            category: Vec::new(),
            genre: Vec::new(),
            developer: Vec::new(),
            publisher: Vec::new(),
            tags: autotags::auto_tags_for(&r.game_name),
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
            game_level: 1,
        });
    }
    let n = games.len();
    if n == 0 {
        return 0;
    }
    // Clear previous (sample) games, then import the catalog. The flag makes
    // this run exactly once.
    let _ = db.clear_games();
    let _ = db.upsert_games(&games);
    let _ = db.set_setting("game_catalog_imported", "1");
    n
}

/// Backfills `tags` for every game in the database exactly once. Used at
/// startup to populate tags on libraries that were imported before the
/// auto-tagger existed (so the sidebar has real tags to filter by). Sets a
/// `tags_migrated` flag in `settings` so it never re-runs.
fn maybe_backfill_tags(db: &Database) {
    if db
        .get_setting("tags_migrated")
        .ok()
        .flatten()
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        return;
    }
    let Ok(games) = db.get_all_games() else {
        return;
    };
    if games.is_empty() {
        // Still mark migrated so we don't keep checking on empty DBs.
        let _ = db.set_setting("tags_migrated", "1");
        return;
    }
    // Only backfill if EVERY game has empty tags — i.e. the legacy import.
    if games.iter().any(|g| !g.tags.is_empty()) {
        // Some tags already exist (e.g. user ran regenerate_tags manually).
        let _ = db.set_setting("tags_migrated", "1");
        return;
    }
    let mut updated = 0usize;
    for g in games.iter() {
        let new_tags = crate::autotags::auto_tags_for(&g.name);
        if new_tags.is_empty() {
            continue;
        }
        let mut g2 = g.clone();
        g2.tags = new_tags;
        g2.modified = chrono::Utc::now().to_rfc3339();
        let _ = db.upsert_game(&g2);
        updated += 1;
    }
    let _ = db.set_setting("tags_migrated", "1");
    let _ = updated;
}

/// Import enterprise users into the unified `users` table from a JSON file, if
/// there are currently no enterprise users. Returns the number imported
/// (0 if nothing was done).
fn import_enterprise_if_empty(db: &Database, path: &str) -> usize {
    let has_enterprise = db
        .get_all_users()
        .unwrap_or_default()
        .iter()
        .any(|u| u.kind == "enterprise");
    if has_enterprise {
        return 0;
    }
    let Ok(text) = std::fs::read_to_string(path) else {
        return 0;
    };
    let Ok(records) = serde_json::from_str::<Vec<auth::EnterpriseRecord>>(&text) else {
        return 0;
    };
    let now = chrono::Utc::now().to_rfc3339();
    let mut users: Vec<models::AppUser> = Vec::new();
    for r in records {
        let ip = r.user_ip_address.trim().to_string();
        if ip.is_empty() {
            continue;
        }
        let name = if !r.user_name.trim().is_empty() {
            r.user_name.trim().to_string()
        } else if !r.user_account.trim().is_empty() {
            r.user_account.trim().to_string()
        } else {
            ip.clone()
        };
        let account = if !r.user_account.trim().is_empty() {
            r.user_account.trim().to_string()
        } else {
            ip.clone()
        };
        users.push(models::AppUser {
            id: uuid::Uuid::new_v4().to_string(),
            account,
            password_hash: String::new(),
            name,
            level: r.user_level.clamp(1, 3),
            kind: "enterprise".into(),
            ip_address: ip,
            created_at: now.clone(),
        });
    }
    let n = users.len();
    let _ = db.replace_enterprise_users(&users);
    n
}

/// Seed two demo personal users (kind = "personal") if none exist.
fn seed_demo_personal_users(db: &Database) {
    let has_personal = db
        .get_all_users()
        .unwrap_or_default()
        .iter()
        .any(|u| u.kind == "personal");
    if has_personal {
        return;
    }
    let now = chrono::Utc::now().to_rfc3339();
    let demos = [
        ("admin", "admin123", "管理员", 3),
        ("player", "player123", "玩家一", 1),
    ];
    for (account, password, name, level) in demos {
        let user = models::AppUser {
            id: uuid::Uuid::new_v4().to_string(),
            account: account.to_string(),
            password_hash: auth::hash_password(password),
            name: name.to_string(),
            level,
            kind: "personal".into(),
            ip_address: String::new(),
            created_at: now.clone(),
        };
        let _ = db.upsert_user(&user);
    }
}

/// Initialize the shared database: seed platforms + example games on first run,
/// and auto-import enterprise users from the configured JSON (if the table is
/// empty) so no admin app is needed for the first import.
fn init_app_db(app: &tauri::App) {
    let state = app.state::<AppState>();
    let db = state.db.lock().unwrap();
    for p in plugins::builtin_platforms() {
        let _ = db.upsert_platform(&p);
    }
    // One-time game catalog import: the Gameid-InstallDirectory-GameName.json
    // is only a temporary data source. On first launch its records are imported
    // into the real database (keeping each `Gameid` as the database `id`) and a
    // flag is set so later launches read the database and never re-import — the
    // JSON can be deleted afterwards.
    let _ = import_game_catalog(&db);

    // One-time tag auto-generation migration: games imported before the
    // auto-tagger existed have empty `tags` fields, so the sidebar would show
    // "no tags". On startup, if every game has empty tags and no `tags_migrated`
    // flag is set, we backfill auto tags and record the flag.
    maybe_backfill_tags(&db);
    // Auto-import enterprise users if the table has none.
    if let Ok(settings) = db.load_settings() {
        let cfg = settings.enterprise_config_path.clone();
        if import_enterprise_if_empty(&db, &cfg) == 0 {
            // Fall back to the well-known legacy path.
            let _ = import_enterprise_if_empty(&db, "D:/user.json");
        }
    }
    // Seed two demo personal users if none exist.
    seed_demo_personal_users(&db);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_root = AppPaths::config_root();

    // Set up env_logger.
    #[cfg(not(debug_assertions))]
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Mutex::new(
                Database::open(AppPaths::database_path()).expect("failed to open database"),
            ),
            process: ProcessManager::new(),
            plugins: Mutex::new(PluginHost::new(AppPaths::plugins_dir())),
            config_root,
        })
        .setup(|app| {
            init_app_db(app);
            setup_tray(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // auth (client)
            commands::auth::get_current_user,
            commands::auth::resolve_enterprise,
            commands::auth::login_personal,
            commands::auth::logout,
            commands::auth::check_can_play,
            commands::auth::get_status_bar,
            // admin (enterprise user import — exposed for tooling; no client UI)
            commands::admin::admin_import_enterprise_users,
            commands::admin::admin_list_enterprise_users,
            commands::admin::admin_delete_enterprise_user,
            // announcement
            commands::announcement::get_announcement,
            // games
            commands::games::get_games,
            commands::games::get_game,
            commands::games::save_game,
            commands::games::delete_game,
            commands::games::launch_game,
            commands::games::stop_game_tracking,
            commands::games::running_games,
            // tags
            commands::tags::regenerate_tags,
            // library
            commands::library::scan_directory_command,
            commands::library::import_scanned_games,
            commands::library::scan_steam_command,
            commands::library::import_steam_games,
            commands::library::library_stats,
            // covers
            commands::covers::scan_covers,
            commands::covers::get_cover_dir_info,
            commands::covers::read_image,
            commands::covers::read_images_batch,
            commands::covers::clear_image_cache,
            // settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_platforms,
            commands::settings::get_builtin_platforms,
            commands::settings::save_platform,
            // plugins
            commands::plugins::discover_plugins,
            commands::plugins::get_plugin_games,
            commands::plugins::save_library_plugin,
            commands::plugins::delete_library_plugin,
            // system
            commands::system::get_app_info,
            commands::system::minimize_window,
            commands::system::maximize_window,
            commands::system::close_window,
            commands::system::hide_window,
            commands::system::show_window,
            commands::system::show_notification,
            commands::system::quit,
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Allow close -> handled by close_window command path; we keep
                // the window closable and rely on frontend wiring.
                let _ = api;
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::AppHandle) {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

    let show_i = MenuItem::with_id(app, "show", "Show Playnite", true, None::<&str>).unwrap();
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
    let separator = PredefinedMenuItem::separator(app).unwrap();
    let menu = Menu::with_items(app, &[&show_i, &separator, &quit_i]).unwrap();

    let icon = app.default_window_icon().cloned();

    let _tray = TrayIconBuilder::with_id("playnite-tray")
        .icon(icon.unwrap())
        .tooltip("Playnite")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app);
    let _ = _tray;
}
