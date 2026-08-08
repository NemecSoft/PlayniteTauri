//! System-level commands: window control, tray, notifications, app info.

use crate::AppState;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub fn get_app_info() -> crate::Result<crate::system::AppInfo> {
    Ok(crate::system::AppInfo::current())
}

#[tauri::command]
pub fn minimize_window(app: AppHandle) -> crate::Result<()> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.minimize();
    }
    Ok(())
}

#[tauri::command]
pub fn maximize_window(app: AppHandle) -> crate::Result<bool> {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_maximized().unwrap_or(false) {
            let _ = win.unmaximize();
            Ok(false)
        } else {
            let _ = win.maximize();
            Ok(true)
        }
    } else {
        Ok(false)
    }
}

/// Returns whether the main window is currently maximized.
#[tauri::command]
pub fn is_maximized(app: AppHandle) -> crate::Result<bool> {
    Ok(app
        .get_webview_window("main")
        .map(|w| w.is_maximized().unwrap_or(false))
        .unwrap_or(false))
}

/// Returns whether the main window is currently in fullscreen.
#[tauri::command]
pub fn is_fullscreen(app: AppHandle) -> crate::Result<bool> {
    Ok(app
        .get_webview_window("main")
        .map(|w| w.is_fullscreen().unwrap_or(false))
        .unwrap_or(false))
}

/// Toggles fullscreen on/off. Returns the new fullscreen state.
#[tauri::command]
pub fn toggle_fullscreen(app: AppHandle) -> crate::Result<bool> {
    if let Some(win) = app.get_webview_window("main") {
        let currently = win.is_fullscreen().unwrap_or(false);
        let _ = win.set_fullscreen(!currently);
        Ok(!currently)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn close_window(app: AppHandle, state: State<AppState>) -> crate::Result<()> {
    let db = state.db.lock().unwrap();
    let settings = db.load_settings()?;
    if settings.close_to_tray {
        hide_to_tray(app);
    } else {
        app.exit(0);
    }
    Ok(())
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> crate::Result<()> {
    hide_to_tray(app);
    Ok(())
}

#[tauri::command]
pub fn show_window(app: AppHandle) -> crate::Result<()> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn show_notification(app: AppHandle, title: String, body: String) -> crate::Result<()> {
    let _ = app.emit("notification", serde_json::json!({ "title": title, "body": body }));
    Ok(())
}

#[tauri::command]
pub fn quit(app: AppHandle) -> crate::Result<()> {
    app.exit(0);
    Ok(())
}

fn hide_to_tray(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}
