//! Plugin / extension commands.

use crate::models::{Game, LibraryPluginInfo};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn discover_plugins(state: State<AppState>) -> crate::Result<Vec<LibraryPluginInfo>> {
    let mut plugins = state.plugins.lock().unwrap();
    Ok(plugins.discover())
}

#[tauri::command]
pub fn get_plugin_games(state: State<AppState>) -> crate::Result<Vec<Game>> {
    let plugins = state.plugins.lock().unwrap();
    Ok(plugins.collect_plugin_games())
}

#[tauri::command]
pub fn save_library_plugin(
    state: State<AppState>,
    plugin: LibraryPluginInfo,
) -> crate::Result<LibraryPluginInfo> {
    let db = state.db.lock().unwrap();
    db.upsert_library_plugin(&plugin)?;
    Ok(plugin)
}

#[tauri::command]
pub fn delete_library_plugin(state: State<AppState>, id: String) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    db.delete_library_plugin(&id)?;
    Ok(())
}
