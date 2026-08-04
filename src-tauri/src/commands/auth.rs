//! Client-side authentication & access commands.

use crate::auth;
use crate::models::{AppSettings, CurrentUser};
use crate::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusBarPayload {
    /// Local (intranet) IPv4 address to display.
    pub local_ip: String,
    /// Public (external) IPv4 address used for matching (not displayed).
    pub public_ip: String,
    /// Matched cafe name (UserName) for the public IP. Empty if not matched.
    pub cafe_name: String,
    /// Whether a cafe was matched.
    pub cafe_matched: bool,
    /// Config file path & existence (for diagnostics).
    pub config_path: String,
    pub config_exists: bool,
}

/// Status bar data: local IP + cafe name matched from the public IP.
#[tauri::command]
pub fn get_status_bar(state: State<AppState>) -> crate::Result<StatusBarPayload> {
    let db = state.db.lock().unwrap();
    let settings = db.load_settings()?;
    let cfg_path = settings.enterprise_config_path.clone();
    let config_exists = std::path::Path::new(&cfg_path).exists();

    // Local IP: first non-loopback IPv4.
    let local_ips = auth::local_ipv4_addresses();
    let local_ip = local_ips.first().cloned().unwrap_or_default();

    // Public IP + cafe name (matched from the unified users table, kind=enterprise).
    let public_ip = auth::public_ipv4_address().unwrap_or_default();
    let cafe = if public_ip.is_empty() {
        None
    } else {
        db.get_user_by_ip(&public_ip)?.map(|u| u.name)
    };

    Ok(StatusBarPayload {
        local_ip,
        public_ip,
        cafe_name: cafe.clone().unwrap_or_default(),
        cafe_matched: cafe.is_some(),
        config_path: cfg_path,
        config_exists,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUserPayload {
    pub kind: String,
    pub name: String,
    pub account: String,
    pub level: i32,
    pub enterprise: bool,
    pub config_path: String,
    pub config_exists: bool,
}

/// Determine the current user:
///  - if an enterprise IP matches the config file -> enterprise user
///  - otherwise fall back to the stored personal session (if logged in)
///  - otherwise a default full-access guest (level 3)
#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> crate::Result<CurrentUserPayload> {
    let db = state.db.lock().unwrap();
    let settings = db.load_settings()?;
    let cfg_path = settings.enterprise_config_path.clone();
    let cfg_exists = std::path::Path::new(&cfg_path).exists();

    // Enterprise user is matched from the DB by public IP (database is the
    // authority after the user JSON import).
    let public_ip = auth::public_ipv4_address();
    let enterprise_user = match &public_ip {
        Some(ip) => db.get_user_by_ip(ip)?,
        None => None,
    };

    let mut settings = settings;

    let payload = if let Some(u) = enterprise_user {
        // Enterprise user wins; persist it.
        let cu = CurrentUser {
            kind: "enterprise".into(),
            name: u.name.clone(),
            account: u.account.clone(),
            level: u.level,
        };
        settings.current_user_kind = "enterprise".into();
        settings.current_user_name = cu.name.clone();
        settings.current_user_level = cu.level;
        db.save_settings(&settings)?;
        to_payload(&cu, true, &cfg_path, cfg_exists)
    } else if settings.logged_in {
        // Personal session already stored.
        let cu = CurrentUser {
            kind: "personal".into(),
            name: settings.current_user_name.clone(),
            account: settings.username.clone().unwrap_or_default(),
            level: settings.current_user_level,
        };
        // Ensure new fields are persisted even on legacy settings JSON.
        if settings.enterprise_config_path.is_empty() {
            settings.enterprise_config_path = "D:/1.json".into();
        }
        db.save_settings(&settings)?;
        to_payload(&cu, false, &cfg_path, cfg_exists)
    } else {
        // Guest with full access by default (level 3).
        let cu = CurrentUser {
            kind: "guest".into(),
            name: "Guest".into(),
            account: "".into(),
            level: 3,
        };
        // Persist guest state (also normalises legacy settings JSON).
        settings.current_user_kind = "guest".into();
        settings.current_user_name = cu.name.clone();
        settings.current_user_level = cu.level;
        if settings.enterprise_config_path.is_empty() {
            settings.enterprise_config_path = "D:/1.json".into();
        }
        db.save_settings(&settings)?;
        to_payload(&cu, false, &cfg_path, cfg_exists)
    };

    Ok(payload)
}

fn to_payload(
    u: &CurrentUser,
    enterprise: bool,
    config_path: &str,
    config_exists: bool,
) -> CurrentUserPayload {
    CurrentUserPayload {
        kind: u.kind.clone(),
        name: u.name.clone(),
        account: u.account.clone(),
        level: u.level,
        enterprise,
        config_path: config_path.to_string(),
        config_exists,
    }
}

/// Resolve the enterprise user (matched from the DB by public IP) and store it
/// as the current session. Returns the resolved user or None if not enterprise.
#[tauri::command]
pub fn resolve_enterprise(state: State<AppState>) -> crate::Result<Option<CurrentUserPayload>> {
    let db = state.db.lock().unwrap();
    let mut settings = db.load_settings()?;
    let cfg_path = settings.enterprise_config_path.clone();
    let cfg_exists = std::path::Path::new(&cfg_path).exists();
    let enterprise_user = match auth::public_ipv4_address() {
        Some(ip) => db.get_user_by_ip(&ip)?,
        None => None,
    };
    if let Some(u) = enterprise_user {
        let cu = CurrentUser {
            kind: "enterprise".into(),
            name: u.name.clone(),
            account: u.account.clone(),
            level: u.level,
        };
        settings.current_user_kind = "enterprise".into();
        settings.current_user_name = cu.name.clone();
        settings.current_user_level = cu.level;
        db.save_settings(&settings)?;
        Ok(Some(to_payload(&cu, true, &cfg_path, cfg_exists)))
    } else {
        Ok(None)
    }
}

/// Personal account login. Verifies the password and stores the session.
#[tauri::command]
pub fn login_personal(
    state: State<AppState>,
    account: String,
    password: String,
) -> crate::Result<Option<CurrentUserPayload>> {
    let db = state.db.lock().unwrap();
    let mut settings = db.load_settings()?;
    let cfg_path = settings.enterprise_config_path.clone();
    let user = auth::verify_personal_login(&db, &account, &password)?;
    if let Some(u) = user {
        settings.logged_in = true;
        settings.username = Some(u.account.clone());
        settings.current_user_kind = "personal".into();
        settings.current_user_name = u.name.clone();
        settings.current_user_level = u.level;
        db.save_settings(&settings)?;
        Ok(Some(to_payload(
            &u,
            false,
            &cfg_path,
            std::path::Path::new(&cfg_path).exists(),
        )))
    } else {
        Ok(None)
    }
}

/// Clear the personal session.
#[tauri::command]
pub fn logout(state: State<AppState>) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    let mut settings = db.load_settings()?;
    settings.logged_in = false;
    settings.username = None;
    settings.current_user_kind = "".into();
    settings.current_user_name = "".into();
    settings.current_user_level = 3;
    db.save_settings(&settings)?;
    Ok(())
}

/// Whether the current user may play a game with the given level.
#[tauri::command]
pub fn check_can_play(state: State<AppState>, game_level: i32) -> crate::Result<bool> {
    let db = state.db.lock().unwrap();
    let settings = db.load_settings()?;
    Ok(auth::can_play(settings.current_user_level, game_level))
}

/// Imported by `AppSettings` for admin convenience.
pub fn load_settings(db: &crate::db::Database) -> crate::Result<AppSettings> {
    Ok(db.load_settings()?)
}
