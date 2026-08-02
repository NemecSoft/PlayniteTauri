//! Game CRUD, launch, playtime tracking commands.

use crate::models::Game;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGamePayload {
    pub game: Game,
}

#[tauri::command]
pub fn get_games(state: State<AppState>) -> crate::Result<Vec<Game>> {
    let db = state.db.lock().unwrap();
    Ok(db.get_all_games()?)
}

#[tauri::command]
pub fn get_game(state: State<AppState>, id: String) -> crate::Result<Option<Game>> {
    let db = state.db.lock().unwrap();
    Ok(db.get_game(&id)?)
}

#[tauri::command]
pub fn save_game(state: State<AppState>, payload: UpdateGamePayload) -> crate::Result<Game> {
    let mut game = payload.game;
    game.modified = chrono::Utc::now().to_rfc3339();
    let db = state.db.lock().unwrap();
    db.upsert_game(&game)?;
    Ok(game)
}

#[tauri::command]
pub fn delete_game(state: State<AppState>, id: String) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    db.delete_game(&id)?;
    Ok(())
}

/// Launches a game by its id. Resolves the play action and starts the process.
#[tauri::command]
pub fn launch_game(state: State<AppState>, id: String) -> crate::Result<bool> {
    let db = state.db.lock().unwrap();
    let game = db
        .get_game(&id)?
        .ok_or_else(|| crate::AppError::NotFound(format!("Game {} not found", id)))?;

    let launched = if let Some(play_task_id) = &game.play_task {
        let action = game
            .actions
            .iter()
            .find(|a| a.id == *play_task_id || a.is_play_action)
            .or_else(|| game.actions.iter().find(|a| a.is_play_action));

        if let Some(action) = action {
            match action.r#type.as_str() {
                "File" => {
                    let exe = action.path.clone().unwrap_or_default();
                    if exe.is_empty() {
                        false
                    } else {
                        state
                            .process
                            .launch(&exe, action.arguments.as_deref(), action.working_dir.as_deref())
                            .map_err(|e| crate::AppError::Launch(e.to_string()))?;
                        state.process.start_tracking(&game);
                        true
                    }
                }
                "URL" => {
                    if let Some(url) = &action.path {
                        let _ = open_url(url);
                    }
                    false
                }
                _ => false,
            }
        } else {
            false
        }
    } else {
        // No play task: try to auto-detect an executable in the install dir.
        if let Some(dir) = &game.install_directory {
            if let Some((exe, wd)) = crate::process::find_game_executable(dir) {
                state
                    .process
                    .launch(
                        &exe.to_string_lossy(),
                        None,
                        Some(&wd.to_string_lossy()),
                    )
                    .map_err(|e| crate::AppError::Launch(e.to_string()))?;
                state.process.start_tracking(&game);
                true
            } else {
                false
            }
        } else {
            false
        }
    };

    Ok(launched)
}

#[cfg(windows)]
fn open_url(url: &str) -> std::io::Result<()> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn()
        .map(|_| ())
}

#[cfg(not(windows))]
fn open_url(url: &str) -> std::io::Result<()> {
    std::process::Command::new("xdg-open").arg(url).spawn().map(|_| ())
}

/// Stops tracking a game's play session and returns accumulated playtime (sec).
#[tauri::command]
pub fn stop_game_tracking(state: State<AppState>, id: String) -> crate::Result<u64> {
    Ok(state.process.stop_tracking(&id))
}

/// Returns the list of currently running games.
#[tauri::command]
pub fn running_games(state: State<AppState>) -> crate::Result<Vec<crate::process::RunningGame>> {
    Ok(state.process.running_games())
}


