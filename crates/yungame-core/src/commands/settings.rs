//! Settings and platforms commands.

use crate::models::{AppSettings, Platform};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> crate::Result<AppSettings> {
    let db = state.db.lock().unwrap();
    Ok(db.load_settings()?)
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: AppSettings) -> crate::Result<AppSettings> {
    let db = state.db.lock().unwrap();
    db.save_settings(&settings)?;
    Ok(settings)
}

// ---- Platforms ----

#[tauri::command]
pub fn get_platforms(state: State<AppState>) -> crate::Result<Vec<Platform>> {
    let db = state.db.lock().unwrap();
    Ok(db.get_all_platforms()?)
}

#[tauri::command]
pub fn get_builtin_platforms() -> crate::Result<Vec<Platform>> {
    Ok(crate::plugins::builtin_platforms())
}

#[tauri::command]
pub fn save_platform(state: State<AppState>, platform: Platform) -> crate::Result<Platform> {
    let db = state.db.lock().unwrap();
    db.upsert_platform(&platform)?;
    Ok(platform)
}
