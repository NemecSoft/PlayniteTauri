//! Library statistics commands.

use crate::models::{LibraryStats, PlatformCount};
use crate::AppState;
use tauri::State;

/// Computes library statistics across all games.
#[tauri::command]
pub fn library_stats(state: State<AppState>) -> crate::Result<LibraryStats> {
    let db = state.db.lock().unwrap();
    let games = db.get_all_games()?;
    let total = games.len() as u64;
    let installed = games.iter().filter(|g| g.installed).count() as u64;
    let favorite = games.iter().filter(|g| g.favorite).count() as u64;
    let hidden = games.iter().filter(|g| g.hidden).count() as u64;
    let total_playtime: u64 = games.iter().map(|g| g.playtime).sum();

    let mut platform_counts: std::collections::HashMap<String, u64> =
        std::collections::HashMap::new();
    let mut genre_counts: std::collections::HashMap<String, u64> =
        std::collections::HashMap::new();
    for g in &games {
        for p in &g.platform {
            *platform_counts.entry(p.clone()).or_insert(0) += 1;
        }
        for ge in &g.genre {
            *genre_counts.entry(ge.clone()).or_insert(0) += 1;
        }
    }

    let installed_pct = if total > 0 {
        (installed as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(LibraryStats {
        total_games: total,
        installed_games: installed,
        installed_pct,
        total_playtime,
        total_size: 0,
        favorite_games: favorite,
        hidden_games: hidden,
        platform_breakdown: platform_counts
            .into_iter()
            .map(|(name, count)| PlatformCount { name, count })
            .collect(),
        genre_breakdown: genre_counts
            .into_iter()
            .map(|(name, count)| PlatformCount { name, count })
            .collect(),
    })
}
