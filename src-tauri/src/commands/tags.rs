//! Tag-management commands (auto-generation of user-facing tags from the
//! game's display name).

use crate::models::Game;
use crate::AppState;
use tauri::State;

/// Recompute auto-tags for every game in the library and persist the result.
/// Returns the number of games whose `tags` field was updated.
#[tauri::command]
pub fn regenerate_tags(state: State<AppState>) -> crate::Result<usize> {
    let db = state.db.lock().unwrap();
    let games = db.get_all_games()?;
    let mut updated = 0usize;
    for g in games.iter() {
        let new_tags = crate::autotags::auto_tags_for(&g.name);
        let mut g2: Game = g.clone();
        g2.tags = new_tags;
        g2.modified = chrono::Utc::now().to_rfc3339();
        db.upsert_game(&g2)?;
        updated += 1;
    }
    Ok(updated)
}