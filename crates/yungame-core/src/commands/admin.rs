//! Admin app commands: manage games (incl. level) and personal user accounts.

use crate::auth;
use crate::models::{AppSettings, AppUser, GameLibrary};
use crate::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicUser {
    pub id: String,
    pub account: String,
    pub name: String,
    pub level: i32,
    pub kind: String, // "personal" | "enterprise"
    pub created_at: String,
}

fn to_public(u: &AppUser) -> PublicUser {
    PublicUser {
        id: u.id.clone(),
        account: u.account.clone(),
        name: u.name.clone(),
        level: u.level,
        kind: u.kind.clone(),
        created_at: u.created_at.clone(),
    }
}

// ---------------- Personal user management ----------------

#[tauri::command]
pub fn admin_list_users(state: State<AppState>) -> crate::Result<Vec<PublicUser>> {
    let db = state.db.lock().unwrap();
    Ok(db.get_all_users()?.iter().map(to_public).collect())
}

/// Create or update a user (personal or enterprise).
/// `id` empty => create (account must be unique); otherwise update by id.
/// `kind` selects the user category: "personal" | "enterprise".
#[tauri::command]
pub fn admin_save_user(
    state: State<AppState>,
    id: String,
    account: String,
    name: String,
    level: i32,
    kind: String,
    password: String,
) -> crate::Result<PublicUser> {
    let db = state.db.lock().unwrap();
    let level = level.clamp(1, 3);
    let kind = if kind.eq_ignore_ascii_case("enterprise") {
        "enterprise".to_string()
    } else {
        "personal".to_string()
    };

    if id.is_empty() {
        // Create new user.
        if account.trim().is_empty() {
            return Err(crate::AppError::Other("account is required".into()));
        }
        if password.is_empty() {
            return Err(crate::AppError::Other("password is required".into()));
        }
        if db.get_user_by_account(&account)?.is_some() {
            return Err(crate::AppError::Other("account already exists".into()));
        }
        let user = AppUser {
            id: uuid::Uuid::new_v4().to_string(),
            account: account.trim().to_string(),
            password_hash: auth::hash_password(&password),
            name: if name.trim().is_empty() {
                account.clone()
            } else {
                name
            },
            level,
            kind,
            ip_address: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
            deleted_at: None,
        };
        db.upsert_user(&user)?;
        Ok(to_public(&user))
    } else {
        // Update existing: load, patch, optionally set new password.
        let Some(mut user) = db.get_user_by_account(&account)? else {
            // fall back to finding by id
            let all = db.get_all_users()?;
            let Some(mut found) = all.into_iter().find(|u| u.id == id) else {
                return Err(crate::AppError::NotFound(id));
            };
            found.account = account;
            found.name = name;
            found.level = level;
            found.kind = kind;
            if !password.is_empty() {
                found.password_hash = auth::hash_password(&password);
            }
            db.upsert_user(&found)?;
            return Ok(to_public(&found));
        };
        user.name = name;
        user.level = level;
        user.kind = kind;
        if !password.is_empty() {
            user.password_hash = auth::hash_password(&password);
        }
        db.upsert_user(&user)?;
        Ok(to_public(&user))
    }
}

#[tauri::command]
pub fn admin_delete_user(state: State<AppState>, id: String) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    db.delete_user(&id)?; // soft delete (sets deleted_at)
    Ok(())
}

/// Restore a soft-deleted user (undo).
#[tauri::command]
pub fn admin_restore_user(state: State<AppState>, id: String) -> crate::Result<PublicUser> {
    let db = state.db.lock().unwrap();
    db.restore_user(&id)?;
    // Return the restored (active) user.
    let all = db.get_all_users()?;
    let Some(u) = all.into_iter().find(|u| u.id == id) else {
        return Err(crate::AppError::NotFound(id));
    };
    Ok(to_public(&u))
}

// ---------------- App settings / enterprise config ----------------

#[tauri::command]
pub fn admin_get_settings(state: State<AppState>) -> crate::Result<AppSettings> {
    let db = state.db.lock().unwrap();
    Ok(db.load_settings()?)
}

/// Update the enterprise config path.
#[tauri::command]
pub fn admin_set_enterprise_config(
    state: State<AppState>,
    config_path: String,
) -> crate::Result<AppSettings> {
    let db = state.db.lock().unwrap();
    let mut s = db.load_settings()?;
    s.enterprise_config_path = config_path;
    db.save_settings(&s)?;
    Ok(s)
}

// ---------------- Launch-action validation ----------------
//
// Real filesystem validation of a launch action's executable path, used by the
// admin when adding/editing a game so invalid paths are caught before saving.
// 检测核心逻辑（类型、扩展名、存在性判断）统一在 `validation::validate_launch_path`，
// 客户端运行前检测和管理端批量检测共用同一份，避免两套实现。

/// Validates a launch-action path (or URL) against the real filesystem.
/// `path` may contain `{LibraryName}` placeholders — they are resolved against
/// the configured game libraries before checking. Returns whether the file
/// exists and is an executable type (not a directory).
#[tauri::command]
pub fn admin_validate_action(
    state: State<AppState>,
    path: String,
    r#type: Option<String>,
) -> crate::Result<crate::validation::ActionValidation> {
    let db = state.db.lock().unwrap();
    let libs = db.load_settings()?.game_libraries;
    Ok(crate::validation::validate_launch_path(&path, r#type.as_deref(), &libs))
}

// ---------------- One-shot data migration ----------------
//
// Migrate launch action paths / working directories from the old relative
// format `.\Gamelibrary\...` (or `..\Gamelibrary\...`) to the placeholder
// format `{Gamelibrary1}\...`, so the existing database is forward-compatible
// with the new game-library feature.

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateResult {
    pub scanned: usize,
    pub updated: usize,
    pub examples: Vec<String>,
}

/// Walks every game's `actions` and rewrites `path` / `workingDir` entries:
///   `.\Gamelibrary\` -> `{Gamelibrary1}\`
///   `..\Gamelibrary\` -> `{Gamelibrary1}\`
/// Paths that already use `{GamelibraryN}` or unrelated values are left alone.
/// Idempotent: already-migrated paths won't be re-changed (the old prefix is
/// gone). Returns a summary so the admin UI can show progress.
#[tauri::command]
pub fn admin_migrate_gamelibrary_placeholder(state: State<AppState>) -> crate::Result<MigrateResult> {
    let db = state.db.lock().unwrap();
    let games = db.get_all_games()?;
    let scanned = games.len();
    // Delegate to the shared migration logic (also invoked automatically at
    // startup). It is idempotent and writes the `gamelibrary_migrated` marker.
    let updated = crate::migrate_gamelibrary_paths(&db);
    Ok(MigrateResult { scanned, updated, examples: Vec::new() })
}

// ---------------- Game libraries ----------------
//
// Game libraries are stored in `AppSettings::game_libraries` (persisted to
// config.json). Each is a `{ id, name, path }` record; launch actions reference
// them via `{name}` placeholders.

/// Lists all configured game libraries (`{ id, name, path }` records).
#[tauri::command]
pub fn admin_get_game_libraries(state: State<AppState>) -> crate::Result<Vec<GameLibrary>> {
    let db = state.db.lock().unwrap();
    Ok(db.load_settings()?.game_libraries)
}

/// Creates or updates a single game library. When `id` is empty a new one is
/// generated; otherwise the matching record is replaced (name/path updated).
#[tauri::command]
pub fn admin_save_game_library(
    state: State<AppState>,
    library: GameLibrary,
) -> crate::Result<Vec<GameLibrary>> {
    let db = state.db.lock().unwrap();
    let mut s = db.load_settings()?;
    let mut lib = library;
    lib.name = lib.name.trim().to_string();
    lib.path = lib.path.trim().to_string();

    if lib.id.is_empty() {
        // New record: assign an id.
        lib.id = format!("lib-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or(""));
        s.game_libraries.push(lib);
    } else {
        // Update existing by id.
        if let Some(existing) = s.game_libraries.iter_mut().find(|l| l.id == lib.id) {
            existing.name = lib.name;
            existing.path = lib.path;
        } else {
            s.game_libraries.push(lib);
        }
    }
    db.save_settings(&s)?;
    Ok(s.game_libraries.clone())
}

/// Deletes the game library with the given id.
#[tauri::command]
pub fn admin_delete_game_library(
    state: State<AppState>,
    id: String,
) -> crate::Result<Vec<GameLibrary>> {
    let db = state.db.lock().unwrap();
    let mut s = db.load_settings()?;
    s.game_libraries.retain(|l| l.id != id);
    db.save_settings(&s)?;
    Ok(s.game_libraries.clone())
}

/// Preview how many enterprise records load & whether the current machine IP
/// would match (useful for the admin to sanity-check the config file).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnterprisePreview {
    pub path: String,
    pub exists: bool,
    pub records: usize,
    pub matched_ip: Option<String>,
    pub matched_name: String,
    pub matched_level: i32,
}

#[tauri::command]
pub fn admin_preview_enterprise(config_path: String) -> crate::Result<EnterprisePreview> {
    let records = auth::load_enterprise_records(&config_path);
    let local_ips = auth::local_ipv4_addresses();
    let matched = auth::resolve_enterprise_user(&records, &local_ips);
    Ok(EnterprisePreview {
        path: config_path.clone(),
        exists: std::path::Path::new(&config_path).exists(),
        records: records.len(),
        matched_ip: local_ips.first().cloned(),
        matched_name: matched.as_ref().map(|m| m.name.clone()).unwrap_or_default(),
        matched_level: matched.as_ref().map(|m| m.level).unwrap_or(0),
    })
}

/// Set the game's access level.
#[tauri::command]
pub fn admin_set_game_level(
    state: State<AppState>,
    game_id: String,
    level: i32,
) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    let level = level.clamp(1, 3);
    let mut game = db
        .get_game(&game_id)?
        .ok_or_else(|| crate::AppError::NotFound(game_id))?;
    game.game_level = level;
    game.modified = chrono::Utc::now().to_rfc3339();
    db.upsert_game(&game)?;
    Ok(())
}

// ---------------- Enterprise user import / management ----------------

/// Import enterprise users from a JSON file (legacy format, an array of
/// {UserId, UserAccount, UserName, UserIpAddress, UserLevel}). These are stored
/// in the unified `users` table with kind = "enterprise". IDs are auto-generated.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportEnterpriseResult {
    pub imported: usize,
    pub skipped_empty: usize,
}

#[tauri::command]
pub fn admin_import_enterprise_users(
    state: State<AppState>,
    json_path: String,
) -> crate::Result<ImportEnterpriseResult> {
    let db = state.db.lock().unwrap();
    let text = std::fs::read_to_string(&json_path).map_err(|e| {
        crate::AppError::Other(format!("cannot read {}: {}", json_path, e))
    })?;
    let records: Vec<auth::EnterpriseRecord> =
        serde_json::from_str(&text).map_err(|e| {
            crate::AppError::Other(format!("invalid JSON in {}: {}", json_path, e))
        })?;

    let mut users: Vec<crate::models::AppUser> = Vec::new();
    let mut skipped = 0usize;
    let now = chrono::Utc::now().to_rfc3339();
    for r in records {
        let ip = r.user_ip_address.trim().to_string();
        if ip.is_empty() {
            skipped += 1;
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
        users.push(crate::models::AppUser {
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

    let imported = db.replace_enterprise_users(&users)?;
    Ok(ImportEnterpriseResult {
        imported,
        skipped_empty: skipped,
    })
}

/// List all enterprise users (kind = "enterprise").
#[tauri::command]
pub fn admin_list_enterprise_users(
    state: State<AppState>,
) -> crate::Result<Vec<crate::models::AppUser>> {
    let db = state.db.lock().unwrap();
    Ok(db
        .get_all_users()?
        .into_iter()
        .filter(|u| u.kind == "enterprise")
        .collect())
}

/// Delete a single user by id (enterprise or personal).
#[tauri::command]
pub fn admin_delete_enterprise_user(state: State<AppState>, id: String) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    db.delete_user(&id)?;
    Ok(())
}
