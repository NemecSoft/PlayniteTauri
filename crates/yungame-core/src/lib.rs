//! YunGame shared core library.
//! Holds the shared application state, data models, db access, auth, process
//! launcher and all Tauri commands. The desktop client and the admin console
//! are thin Tauri apps that call `run_client` / `run_admin` here with their own
//! Tauri context (each embedding its own frontend).

pub mod auth;
pub mod autotags;
pub mod commands;
pub mod config;
pub mod game_server;
pub mod covers;
pub mod db;
pub mod models;
pub mod plugins;
pub mod process;
pub mod sample_data;
pub mod script_runner;
pub mod settings;
pub mod validation;
pub mod system;

use db::Database;
use plugins::PluginHost;
use process::ProcessManager;
use settings::AppPaths;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
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
pub struct AppState {
    // 用 Arc 包一层：后台监控线程（游戏进程退出检测）需要 clone 一份 db 引用，
    // 以便把"最近一次运行时长"写回数据库。
    pub db: Arc<Mutex<Database>>,
    pub process: ProcessManager,
    pub plugins: Mutex<PluginHost>,
    pub config_root: PathBuf,
    /// Local HTTP server serving `Game_Details/` static pages. Kept here so it
    /// lives for the whole app lifetime; the base URL is exposed via
    /// `get_game_server_url`.
    pub game_server: Option<Arc<game_server::GameServer>>,
}

/// One record in the game catalog JSON file.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct GameCatalogRecord {
    pub gameid: String,
    pub install_directory: String,
    pub game_name: String,
}

/// Performs a one-time migration of the game catalog from the temporary JSON
/// file into the real database. Returns the number of games imported (0 if
/// skipped / file missing).
fn import_game_catalog(db: &Database) -> usize {
    if db
        .get_setting("game_catalog_imported")
        .ok()
        .flatten()
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        return 0;
    }
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
            last_session_seconds: 0,
            last_session_ended_at: None,
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
            game_library: None,
            game_level: 1,
            pre_launch_script: None,
            pre_launch_enabled: false,
            post_launch_script: None,
            post_launch_enabled: false,
            post_exit_script: None,
            post_exit_enabled: false,
        });
    }
    let n = games.len();
    if n == 0 {
        return 0;
    }
    let _ = db.clear_games();
    let _ = db.upsert_games(&games);
    let _ = db.set_setting("game_catalog_imported", "1");
    n
}

/// Backfills `tags` for every game exactly once at startup.
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
        let _ = db.set_setting("tags_migrated", "1");
        return;
    }
    if games.iter().any(|g| !g.tags.is_empty()) {
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
/// there are currently no enterprise users. Returns the number imported.
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
            deleted_at: None,
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
            deleted_at: None,
        };
        let _ = db.upsert_user(&user);
    }
}

/// One-shot migration of launch-action paths/working-dirs from the old
/// relative form `.\Gamelibrary\...` (or `..\Gamelibrary\...`) to the new
/// placeholder form `{Gamelibrary1}\...`. Called automatically at startup
/// (guarded by the `gamelibrary_migrated` setting) and exposed to the admin
/// console as `admin_migrate_gamelibrary_placeholder`.
///
/// The placeholder is resolved **at launch time** by `process.rs` against the
/// configured game-library roots, so the DB always stores the template form.
/// Returns the number of games whose data was rewritten.
pub fn migrate_gamelibrary_paths(db: &Database) -> usize {
    let Ok(games) = db.get_all_games() else {
        return 0;
    };
    let mut updated = 0usize;
    for g in &games {
        let mut dirty = false;
        let new_actions: Vec<models::GameAction> = g
            .actions
            .iter()
            .map(|a| {
                let mut b = a.clone();
                if let Some(p) = b.path.as_ref() {
                    let np = migrate_path(p);
                    if &np != p {
                        b.path = Some(np);
                        dirty = true;
                    }
                }
                if let Some(w) = b.working_dir.as_ref() {
                    let nw = migrate_path(w);
                    if &nw != w {
                        b.working_dir = Some(nw);
                        dirty = true;
                    }
                }
                b
            })
            .collect();

        if dirty {
            let mut ng = g.clone();
            ng.actions = new_actions;
            ng.modified = chrono::Utc::now().to_rfc3339();
            if db.upsert_game(&ng).is_ok() {
                updated += 1;
            }
        }
    }
    // Mark migration as done so future startups don't re-run it.
    let _ = db.set_setting("gamelibrary_migrated", "1");
    updated
}

/// Replace a leading `Gamelibrary` relative prefix with the `{Gamelibrary1}`
/// placeholder. Handles `.\` / `..\` (and forward-slash) variants.
fn migrate_path(p: &str) -> String {
    let mut s = p.to_string();
    for prefix in [r".\Gamelibrary\", r"..\Gamelibrary\", r"./Gamelibrary/", r"../Gamelibrary/"] {
        if s.contains(prefix) {
            s = s.replace(prefix, r"{Gamelibrary1}\");
        }
    }
    s
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
    let _ = import_game_catalog(&db);
    maybe_backfill_tags(&db);
    // One-time migration of `.\Gamelibrary\...` -> `{Gamelibrary1}\...`
    // placeholder paths (only runs once, guarded by the setting).
    if db
        .get_setting("gamelibrary_migrated")
        .ok()
        .flatten()
        .map(|v| v == "1")
        .unwrap_or(false)
    {
        // already migrated
    } else {
        let _ = migrate_gamelibrary_paths(&db);
    }
    // 一次性回填：之前保存的游戏可能有 actions 但顶层 play_task / install_directory
    // 是空的（管理端 UI 没回填这两个字段），导致启动时 launch_game 找不到
    // 启动指令。这里从 actions 里挑出 is_play_action=true 那条自动回填到
    // 顶层字段。已回填的不会重复改。
    backfill_play_task_and_install_dir(&db);
    if let Ok(settings) = db.load_settings() {
        let cfg = settings.enterprise_config_path.clone();
        if import_enterprise_if_empty(&db, &cfg) == 0 {
            let _ = import_enterprise_if_empty(&db, "D:/user.json");
        }
    }
    seed_demo_personal_users(&db);
}

/// 一次性回填：扫描所有游戏，凡是 `play_task` 为空但 actions 里有
/// `is_play_action=true` 的，把对应的 action.id 写到 play_task；install_directory
/// 若为空，用该 action 的 working_dir（优先）或 path 兜底。仅在启动时跑一次，
/// 守卫键 `play_task_backfilled` 防止重复回填。
fn backfill_play_task_and_install_dir(db: &Database) {
    if db
        .get_setting("play_task_backfilled")
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
    let mut fixed = 0usize;
    for g in games {
        // 找 actions 里"作为启动指令"那条；找不到就用第一条；都没有就跳过。
        let play = g
            .actions
            .iter()
            .find(|a| a.is_play_action)
            .or_else(|| g.actions.first());
        let Some(play) = play else { continue };
        let mut ng = g.clone();
        let mut changed = false;
        if ng.play_task.as_deref().map(str::is_empty).unwrap_or(true) {
            ng.play_task = Some(play.id.clone());
            changed = true;
        }
        if ng.install_directory.as_deref().map(str::is_empty).unwrap_or(true) {
            let wd = play
                .working_dir
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());
            let p = play
                .path
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());
            let resolved = wd.or(p).map(|s| s.to_string());
            if resolved.is_some() {
                ng.install_directory = resolved;
                changed = true;
            }
        }
        if changed {
            if db.upsert_game(&ng).is_ok() {
                fixed += 1;
            }
        }
    }
    if fixed > 0 {
        // 回填完成（数量通过返回值传给调用方，本地不再打日志以免污染启动输出）。
    }
    let _ = db.set_setting("play_task_backfilled", "1");
}

/// Entry point for the **client** app (`Playnite.DesktopApp.exe`). The client
/// binary passes its own `tauri::generate_context!()` so it embeds only the
/// client frontend.
pub fn run_client(ctx: tauri::Context) {
    build_client()
        .run(ctx)
        .expect("error while running tauri application");
}

/// Builds the **client** Tauri application without a context. The client binary
/// supplies the context (and therefore the embedded frontend).
pub fn build_client() -> tauri::Builder<tauri::Wry> {
    let config_root = AppPaths::config_root();

    #[cfg(not(debug_assertions))]
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    let game_server = game_server::GameServer::start(AppPaths::games_html_dir())
        .map(Arc::new)
        .ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Arc::new(Mutex::new(
                Database::open(AppPaths::database_path()).expect("failed to open database"),
            )),
            process: ProcessManager::new(),
            plugins: Mutex::new(PluginHost::new(AppPaths::plugins_dir())),
            config_root,
            game_server,
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
            // admin (shared backend for the YunGame Admin app)
            commands::admin::admin_import_enterprise_users,
            commands::admin::admin_list_enterprise_users,
            commands::admin::admin_delete_enterprise_user,
            commands::admin::admin_list_users,
            commands::admin::admin_save_user,
            commands::admin::admin_delete_user,
            commands::admin::admin_restore_user,
            commands::admin::admin_get_settings,
            commands::admin::admin_set_enterprise_config,
            commands::admin::admin_preview_enterprise,
            commands::admin::admin_set_game_level,
            commands::admin::admin_get_game_libraries,
            commands::admin::admin_save_game_library,
            commands::admin::admin_delete_game_library,
            commands::admin::admin_migrate_gamelibrary_placeholder,
            commands::admin::admin_validate_action,
            commands::admin::admin_soft_validate_action,
            // announcement
            commands::announcement::get_announcement,
            // per-game static detail page
            commands::game_html::get_game_html_page,
            commands::game_html::get_game_server_url,
            // games
            commands::games::get_games,
            commands::games::get_game,
            commands::games::save_game,
            commands::games::delete_game,
            commands::games::launch_game,
            commands::games::stop_game_tracking,
            commands::games::running_games,
            commands::games::get_run_state,
            // tags
            commands::tags::regenerate_tags,
            // library
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
            commands::system::is_maximized,
            commands::system::is_fullscreen,
            commands::system::toggle_fullscreen,
            commands::system::close_window,
            commands::system::hide_window,
            commands::system::show_window,
            commands::system::show_notification,
            commands::system::quit,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Unify every close path through the "close to tray" setting
                // instead of letting the window be destroyed directly.
                //
                // When the window is destroyed while a tray session keeps the
                // app alive, Chromium's window-class teardown races with Tauri's
                // event-loop shutdown and logs the benign
                //   "Failed to unregister class Chrome_WidgetWin_0 (Error 1412)".
                // Honoring close_to_tray here (hide instead of destroy) removes
                // that race for the common close-X flow.
                api.prevent_close();
                let app = window.app_handle();
                let close_to_tray = app
                    .try_state::<AppState>()
                    .map(|s| {
                        s.db
                            .lock()
                            .ok()
                            .and_then(|db| db.load_settings().ok())
                            .map(|st| st.close_to_tray)
                            .unwrap_or(false)
                    })
                    .unwrap_or(false);
                if close_to_tray {
                    let _ = window.hide();
                } else {
                    app.exit(0);
                }
            }
        })
}

/// Entry point for the **admin console** (`Playnite.Admin.exe`). The admin
/// binary passes its own `tauri::generate_context!()` so it embeds only the
/// admin frontend (`dist-admin/`).
pub fn run_admin(ctx: tauri::Context) {
    build_admin()
        .run(ctx)
        .expect("error while running tauri admin application");
}

/// Builds the **admin console** Tauri application without a context.
pub fn build_admin() -> tauri::Builder<tauri::Wry> {
    let config_root = AppPaths::config_root();

    #[cfg(not(debug_assertions))]
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: Arc::new(Mutex::new(
                Database::open(AppPaths::database_path()).expect("failed to open database"),
            )),
            process: ProcessManager::new(),
            plugins: Mutex::new(PluginHost::new(AppPaths::plugins_dir())),
            config_root,
            game_server: None,
        })
        .setup(|app| {
            init_app_db(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // admin (full console set)
            commands::admin::admin_import_enterprise_users,
            commands::admin::admin_list_enterprise_users,
            commands::admin::admin_delete_enterprise_user,
            commands::admin::admin_list_users,
            commands::admin::admin_save_user,
            commands::admin::admin_delete_user,
            commands::admin::admin_restore_user,
            commands::admin::admin_get_settings,
            commands::admin::admin_set_enterprise_config,
            commands::admin::admin_preview_enterprise,
            commands::admin::admin_set_game_level,
            commands::admin::admin_get_game_libraries,
            commands::admin::admin_save_game_library,
            commands::admin::admin_delete_game_library,
            commands::admin::admin_migrate_gamelibrary_placeholder,
            commands::admin::admin_validate_action,
            commands::admin::admin_soft_validate_action,
            commands::admin::validate_selected_actions,
            // auth (status / current user)
            commands::auth::get_current_user,
            commands::auth::resolve_enterprise,
            // games (read + save for editing launch actions)
            commands::game_html::get_game_html_page,
            commands::games::get_games,
            commands::games::get_game,
            commands::games::save_game,
            commands::games::delete_game,
            commands::games::launch_game,
            commands::games::test_script,
            // settings
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_platforms,
            commands::settings::get_builtin_platforms,
            commands::settings::save_platform,
            // tags
            commands::tags::regenerate_tags,
            // covers
            commands::covers::scan_covers,
            commands::covers::read_image,
            commands::covers::read_images_batch,
            // system
            commands::system::get_app_info,
            commands::system::minimize_window,
            commands::system::maximize_window,
            commands::system::is_maximized,
            commands::system::is_fullscreen,
            commands::system::toggle_fullscreen,
            commands::system::close_window,
            commands::system::quit,
            commands::system::show_notification,
        ])
}

fn setup_tray(app: &tauri::AppHandle) {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

    let show_i = MenuItem::with_id(app, "show", "Show YunGame", true, None::<&str>).unwrap();
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
    let separator = PredefinedMenuItem::separator(app).unwrap();
    let menu = Menu::with_items(app, &[&show_i, &separator, &quit_i]).unwrap();

    let icon = app.default_window_icon().cloned();

    let _tray = TrayIconBuilder::with_id("yungame-tray")
        .icon(icon.unwrap())
        .tooltip("YunGame")
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
