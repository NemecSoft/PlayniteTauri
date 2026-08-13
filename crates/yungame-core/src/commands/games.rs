//! Game CRUD, launch, playtime tracking commands.

use crate::models::Game;
use crate::process::ProcessManager;
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
    // 自动修复空 id：老数据/导入数据可能 id 是空字符串，导致前端点详情跳转
    // `/game/`（缺段）匹配不上路由，被兜底路由拉回主页——表现为"点详情闪一下
    // 没变化"。这里给空 id 的游戏补一个 UUID 并回写数据库。
    // 注意：必须先用新 id upsert（INSERT 会因 ON CONFLICT(id) 在空 id 上匹配
    // 不到，从而插入一条新记录），再删掉旧的空 id 记录，否则库里会留一条
    // 脏数据（id=""），下次 get_games 又会读到它重复修复。
    let mut final_games: Vec<Game> = Vec::with_capacity(games.len());
    for mut g in games {
        if g.id.trim().is_empty() {
            g.id = uuid::Uuid::new_v4().to_string();
            let _ = db.upsert_game(&g);
            let _ = db.delete_game(""); // 删掉旧的空 id 记录
        }
        final_games.push(g);
    }
    let games = final_games;
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
    // 治本：任何写入都保证 id 非空。若前端漏传 id（空字符串），这里自动补一个
    // UUID，避免再次产生"空 id 游戏导致点详情闪一下"的脏数据。
    if game.id.trim().is_empty() {
        game.id = uuid::Uuid::new_v4().to_string();
    }
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
                        return Err(crate::AppError::Launch("启动指令路径为空".into()));
                    }
                    // 运行前检测：用共享的校验逻辑解析目标 exe 并确认存在。
                    // 不存在则阻止启动并返回错误（前端会 toast 提示）。
                    let precheck =
                        crate::validation::validate_launch_path(&exe, Some("File"), &settings.game_libraries);
                    if !precheck.valid {
                        return Err(crate::AppError::Launch(format!(
                            "启动前检测未通过：{}（解析路径：{}）",
                            precheck.reason, precheck.resolved
                        )));
                    }
                    let child = state
                        .process
                        .launch(
                            &exe,
                            action.arguments.as_deref(),
                            action.working_dir.as_deref(),
                            &settings.game_libraries,
                        )
                        .map_err(|e| crate::AppError::Launch(e.to_string()))?;
                    // 登记句柄并启动后台监控线程，检测该游戏进程何时退出。
                    // track 控制是否累计 playtime；但无论是否 track，都要监控
                    // 进程退出，因为详情页需要显示"运行中 / 已退出 / 未运行"。
                    let game_id = game.id.clone();
                    state.process.start_tracking(&game, child, track);
                    spawn_process_monitor(
                        state.process.clone(),
                        state.db.clone(),
                        game_id,
                    );
                    true
                }
                "URL" => {
                    if let Some(url) = &action.path {
                        let _ = open_url(url);
                    } else {
                        return Err(crate::AppError::Launch("URL 启动指令的地址为空".into()));
                    }
                    true
                }
                other => {
                    return Err(crate::AppError::Launch(format!(
                        "未知的启动指令类型：{other}"
                    )));
                }
            }
        } else {
            return Err(crate::AppError::Launch("游戏没有可启动的指令".into()));
        }
    } else {
        // No play task: try to auto-detect an executable in the install dir.
        if let Some(dir) = &game.install_directory {
            if let Some((exe, wd)) = crate::process::find_game_executable(dir) {
                let child = state
                    .process
                    .launch(
                        &exe.to_string_lossy(),
                        None,
                        Some(&wd.to_string_lossy()),
                        &settings.game_libraries,
                    )
                    .map_err(|e| crate::AppError::Launch(e.to_string()))?;
                let game_id = game.id.clone();
                state.process.start_tracking(&game, child, track);
                spawn_process_monitor(
                    state.process.clone(),
                    state.db.clone(),
                    game_id,
                );
                true
            } else {
                return Err(crate::AppError::Launch(format!(
                    "未配置启动指令，且在安装目录 {} 中也找不到可执行文件",
                    dir
                )));
            }
        } else {
            return Err(crate::AppError::Launch(
                "游戏未配置启动指令且没有安装目录".into(),
            ));
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

/// 后台监控线程：轮询某游戏子进程是否退出。
///
/// 为什么需要这个：客户端详情页要显示"游戏在运行 / 已退出 / 未运行"三种状态。
/// 仅仅把进程 spawn 出来还不够——需要一个后台线程每隔几秒 `try_wait()` 检测
/// 进程是否已经退出，退出了就把本次运行时长和退出时间写回数据库，并更新
/// ProcessManager 的状态。
///
/// 这个线程是"后台服务"性质：不挂在某个前端页面生命周期上，进程退不退出它都
/// 持续检测，所以用户点返回再点详情进来，状态依然准确。
fn spawn_process_monitor(
    pm: ProcessManager,
    db: std::sync::Arc<std::sync::Mutex<crate::db::Database>>,
    game_id: String,
) {
    let handle = match pm.take_handle(&game_id) {
        Some(h) => h,
        None => return, // 句柄已被清理，直接退出监控。
    };
    // 记录本线程自己的开始时间，退出时用它算运行时长（不依赖 track_playtime）。
    let started = std::time::Instant::now();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        // 尝试读取子进程句柄；若已被 stop_tracking 清理则为 None，结束监控。
        let exited = {
            let mut guard = match handle.lock() {
                Ok(g) => g,
                Err(_) => {
                    // 锁被污染，放弃监控
                    return;
                }
            };
            match guard.as_mut() {
                Some(child) => match child.try_wait() {
                    Ok(Some(_)) => true, // 进程已退出
                    Ok(None) => false,   // 还在跑
                    Err(_) => false,
                },
                None => return, // 句柄已被清除（stop_tracking 调用了），结束
            }
        };
        if exited {
            let seconds = started.elapsed().as_secs();
            // 更新 ProcessManager：记录最近退出时长、停止追踪、清理句柄。
            pm.record_exit(&game_id, seconds);
            let _played = pm.stop_tracking(&game_id);
            // 把"最近一次运行时长 / 退出时间"持久化到数据库，供详情页展示
            // "游戏已退出 · 最近共运行 X"。同时把这段时长累加到 playtime。
            if let Ok(db) = db.lock() {
                if let Ok(mut g) = db.get_game(&game_id) {
                    if let Some(g) = g.as_mut() {
                        g.last_session_seconds = seconds;
                        g.last_session_ended_at = Some(
                            chrono::Utc::now().to_rfc3339(),
                        );
                        g.playtime = g.playtime.saturating_add(seconds);
                        let _ = db.upsert_game(g);
                    }
                }
            }
            return; // 监控结束
        }
    });
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

/// 运行状态（详情页顶部展示用）。三种状态：
/// - `running`：游戏进程正在运行。`elapsedSec` 为已运行秒数（前端据此实时计时）。
/// - `stopped`：本会话内游戏已退出过一次。`lastSessionSec` 为最近一次运行时长。
/// - `never`：既没在运行，本会话也没有退出记录（即"游戏未运行"）。
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunState {
    pub state: String,
    pub elapsed_sec: u64,
    pub last_session_sec: u64,
}

/// 查询某游戏的运行状态。详情页进入时轮询此命令，即可显示"运行中/已退出/未运行"。
#[tauri::command]
pub fn get_run_state(state: State<AppState>, game_id: String) -> crate::Result<RunState> {
    let pm = &state.process;
    // 读取持久化的最近一次会话时长（可能后端刚退出还没写、或跨进程重启）。
    let db = state.db.lock().unwrap();
    let persisted_last = db
        .get_game(&game_id)
        .ok()
        .flatten()
        .map(|g| g.last_session_seconds)
        .unwrap_or(0);

    if pm.is_running(&game_id) {
        Ok(RunState {
            state: "running".into(),
            elapsed_sec: pm.elapsed_seconds(&game_id),
            last_session_sec: persisted_last,
        })
    } else if let Some(sec) = pm.last_exit_seconds(&game_id) {
        // 本会话刚退出过 → 显示"已退出 · 最近共运行 X"
        Ok(RunState {
            state: "stopped".into(),
            elapsed_sec: 0,
            last_session_sec: sec.max(persisted_last),
        })
    } else if persisted_last > 0 {
        // 进程退出已被持久化（跨页面、跨重启仍能显示最近一次时长）
        Ok(RunState {
            state: "stopped".into(),
            elapsed_sec: 0,
            last_session_sec: persisted_last,
        })
    } else {
        // 从没运行过 → "游戏未运行"
        Ok(RunState {
            state: "never".into(),
            elapsed_sec: 0,
            last_session_sec: 0,
        })
    }
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
    // 工作目录优先级：游戏工作目录（从 is_play_action 路径解析）→ 游戏库根 →
    // 游戏安装目录 → 应用目录。脚本里的相对路径（如 ./cn.exe）按这个目录解析，
    // 与实际启动游戏时的工作目录一致（联动"执行目录"）。
    let cwd = if let Some(id) = &game_id {
        let db = state.db.lock().unwrap();
        let game = db.get_game(id)?;
        let libs = db.load_settings().ok().map(|s| s.game_libraries).unwrap_or_default();
        let lib_root: Option<String> = game
            .as_ref()
            .and_then(|g| g.game_library.as_deref())
            .and_then(|n| libs.iter().find(|l| l.name == n))
            .map(|l| l.path.clone());

        // 从游戏的"作为启动指令"路径解析出工作目录（去掉文件名）。
        let workdir_from_action: Option<String> = game.as_ref().and_then(|g| {
            g.actions
                .iter()
                .find(|a| a.is_play_action && a.r#type == "File")
                .and_then(|a| a.path.as_deref())
                .filter(|p| !p.trim().is_empty())
                .map(|p| crate::process::resolve_path(p, &libs))
                .map(|resolved| {
                    let pb = std::path::PathBuf::from(&resolved);
                    // 去掉文件名，保留目录
                    if pb.extension().is_some() {
                        pb.parent().map(|p| p.to_string_lossy().to_string())
                    } else {
                        Some(resolved)
                    }
                })
                .flatten()
        });

        let dir = workdir_from_action
            .or(lib_root.clone())
            .or_else(|| game.as_ref().and_then(|g| g.install_directory.clone()))
            .unwrap_or_else(|| crate::settings::AppPaths::config_root().to_string_lossy().to_string());
        Some(std::path::PathBuf::from(dir))
    } else {
        None
    };
    Ok(crate::script_runner::run_script(&script, cwd.as_deref()))
}