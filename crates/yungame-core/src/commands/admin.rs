//! Admin app commands: manage games (incl. level) and personal user accounts.

use crate::auth;
use crate::models::{AppSettings, AppUser};
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
    pub created_at: String,
}

fn to_public(u: &AppUser) -> PublicUser {
    PublicUser {
        id: u.id.clone(),
        account: u.account.clone(),
        name: u.name.clone(),
        level: u.level,
        created_at: u.created_at.clone(),
    }
}

// ---------------- Personal user management ----------------

#[tauri::command]
pub fn admin_list_users(state: State<AppState>) -> crate::Result<Vec<PublicUser>> {
    let db = state.db.lock().unwrap();
    Ok(db.get_all_users()?.iter().map(to_public).collect())
}

/// Create or update a personal user.
/// `id` empty => create (account must be unique); otherwise update by id.
#[tauri::command]
pub fn admin_save_user(
    state: State<AppState>,
    id: String,
    account: String,
    name: String,
    level: i32,
    password: String,
) -> crate::Result<PublicUser> {
    let db = state.db.lock().unwrap();
    let level = level.clamp(1, 3);

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
            kind: "personal".into(),
            ip_address: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
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
            if !password.is_empty() {
                found.password_hash = auth::hash_password(&password);
            }
            db.upsert_user(&found)?;
            return Ok(to_public(&found));
        };
        user.name = name;
        user.level = level;
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
    db.delete_user(&id)?;
    Ok(())
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
