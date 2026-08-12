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
    let games = db.get_all_games()?;
    // Auto-apply local cover images (CoverImages dir) for games without a
    // cover yet. Persist only the newly-matched ones.
    let (updated, _) = crate::covers::apply_covers_to_db(&db, games)?;
    Ok(updated)
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
/// 若传了 action_id，则启动指定的指令；否则用默认的 play action。
#[tauri::command]
pub fn launch_game(
    state: State<AppState>,
    id: String,
    action_id: Option<String>,
) -> crate::Result<bool> {
    let db = state.db.lock().unwrap();
    let game = db
        .get_game(&id)?
        .ok_or_else(|| crate::AppError::NotFound(format!("Game {} not found", id)))?;

    // Access control: the current user level must be >= the game's level.
    let settings = db.load_settings()?;
    if !crate::auth::can_play(settings.current_user_level, game.game_level) {
        return Err(crate::AppError::Other(format!(
            "user level {} cannot play level {} game",
            settings.current_user_level, game.game_level
        )));
    }

    // Whether to record play time (user-toggleable setting).
    let track = settings.track_playtime;

    // 启动前脚本：先同步执行完（成功与否都继续启动游戏，避免脚本问题阻止游戏运行）。
    if game.pre_launch_enabled {
        if let Some(s) = &game.pre_launch_script {
            if !s.trim().is_empty() {
                let expanded = crate::script_runner::expand_variables(s, &game);
                let cwd = game.install_directory.as_deref().map(std::path::Path::new);
                let _ = crate::script_runner::run_script(&expanded, cwd);
            }
        }
    }

    let launched = if let Some(play_task_id) = &game.play_task {
        // 优先用前端传入的指定指令；否则用 play_task 匹配或默认 play action。
        let action = action_id
            .as_ref()
            .and_then(|aid| game.actions.iter().find(|a| a.id == *aid))
            .or_else(|| game.actions.iter().find(|a| a.id == *play_task_id))
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
                            .launch(
                                &exe,
                                action.arguments.as_deref(),
                                action.working_dir.as_deref(),
                                &settings.game_libraries,
                            )
                            .map_err(|e| crate::AppError::Launch(e.to_string()))?;
                        if track {
                            state.process.start_tracking(&game);
                        }
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
                        &settings.game_libraries,
                    )
                    .map_err(|e| crate::AppError::Launch(e.to_string()))?;
                if track {
                    state.process.start_tracking(&game);
                }
                true
            } else {
                false
            }
        } else {
            false
        }
    };

    // 启动后脚本：游戏进程已拉起，异步执行（不阻塞命令返回）。
    if launched && game.post_launch_enabled {
        if let Some(s) = &game.post_launch_script {
            if !s.trim().is_empty() {
                let expanded = crate::script_runner::expand_variables(s, &game);
                let cwd = game
                    .install_directory
                    .as_deref()
                    .map(std::path::PathBuf::from);
                // 放到后台线程跑，避免阻塞命令响应。
                std::thread::spawn(move || {
                    let _ = crate::script_runner::run_script(&expanded, cwd.as_deref());
                });
            }
        }
    }

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
/// 若该游戏配置了"退出后脚本"，在停止追踪（游戏退出）时执行。
#[tauri::command]
pub fn stop_game_tracking(state: State<AppState>, id: String) -> crate::Result<u64> {
    // 先取回游戏，用于执行退出后脚本。
    let game = {
        let db = state.db.lock().unwrap();
        db.get_game(&id)?
    };
    // 退出后脚本：游戏已退出，执行清理脚本（同步）。
    if let Some(g) = &game {
        if g.post_exit_enabled {
            if let Some(s) = &g.post_exit_script {
                if !s.trim().is_empty() {
                    let expanded = crate::script_runner::expand_variables(s, g);
                    let cwd = g.install_directory.as_deref().map(std::path::Path::new);
                    let _ = crate::script_runner::run_script(&expanded, cwd);
                }
            }
        }
    }
    Ok(state.process.stop_tracking(&id))
}

/// Returns the list of currently running games.
#[tauri::command]
pub fn running_games(state: State<AppState>) -> crate::Result<Vec<crate::process::RunningGame>> {
    Ok(state.process.running_games())
}

/// 管理端"测试脚本"：不启动游戏，只执行传入的脚本并返回每行结果。
/// 工作目录优先级：游戏所属游戏库的根目录（基准文件夹）→ 游戏安装目录 → 应用目录。
/// 脚本里用相对路径时，按这个目录解析。
#[tauri::command]
pub fn test_script(
    state: State<AppState>,
    script: String,
    game_id: Option<String>,
) -> crate::Result<Vec<crate::script_runner::ScriptLineResult>> {
    let cwd = if let Some(id) = &game_id {
        let db = state.db.lock().unwrap();
        // 先取游戏所属游戏库的名字
        let lib_name = db.get_game(id)?.and_then(|g| g.game_library);
        // 再查 settings 里的游戏库列表，找到对应 path
        let settings = db.load_settings().ok();
        let lib_path = lib_name.as_deref().and_then(|n| {
            settings
                .as_ref()
                .and_then(|s| s.game_libraries.iter().find(|l| l.name == n))
                .map(|l| l.path.clone())
        });
        // 回退到游戏安装目录，最后回退到应用目录
        let dir = lib_path
            .or_else(|| db.get_game(id).ok().flatten().and_then(|g| g.install_directory))
            .unwrap_or_else(|| crate::settings::AppPaths::config_root().to_string_lossy().to_string());
        Some(std::path::PathBuf::from(dir))
    } else {
        None
    };
    Ok(crate::script_runner::run_script(&script, cwd.as_deref()))
}