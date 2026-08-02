//! Playnite Tauri backend library.
//! Holds the shared application state and registers all Tauri commands.

pub mod commands;
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
            {
                let state = app.state::<AppState>();
                let db = state.db.lock().unwrap();
                // Seed built-in platforms on first run.
                for p in plugins::builtin_platforms() {
                    let _ = db.upsert_platform(&p);
                }
                // Seed example games so the library is not empty on first launch.
                if db.count_games().unwrap_or(0) == 0 {
                    let _ = db.upsert_games(&sample_data::sample_games());
                }
            }

            setup_tray(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // games
            commands::games::get_games,
            commands::games::get_game,
            commands::games::save_game,
            commands::games::delete_game,
            commands::games::launch_game,
            commands::games::stop_game_tracking,
            commands::games::running_games,
            // library
            commands::library::scan_directory_command,
            commands::library::import_scanned_games,
            commands::library::scan_steam_command,
            commands::library::import_steam_games,
            commands::library::library_stats,
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
