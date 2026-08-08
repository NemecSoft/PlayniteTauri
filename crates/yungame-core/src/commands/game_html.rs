//! Per-game static detail page command.
//!
//! Games can ship a standalone HTML page under `Game_Details/<游戏名>/` with an
//! `index.html`, plus `css/`, `js/` and `images/` folders (e.g.
//! `Game_Details/GYLT/index.html`). The actual page is served by the custom
//! `yungame-game://<游戏名>/...` scheme (see lib.rs) so the webview natively
//! resolves css/js/images and `#anchor` navigation — no inlining needed.
//!
//! This command only reports whether a page exists, so the client can show a
//! friendly 404 when there is none.

use crate::settings::AppPaths;
use tauri::State;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameHtmlPage {
    /// The game's display name (used to locate its `Game_Details/<name>/` folder).
    pub name: String,
    /// Whether a page exists for this game.
    pub found: bool,
}

/// Reports whether a static detail page exists for the given game name.
#[tauri::command]
pub fn get_game_html_page(
    name: String,
    _state: State<'_, crate::AppState>,
) -> crate::Result<GameHtmlPage> {
    let dir = AppPaths::games_html_dir().join(sanitize_dir_name(&name));
    let found = dir.join("index.html").is_file();
    Ok(GameHtmlPage { name, found })
}

/// Returns the base URL of the local HTTP server that serves `Game_Details/`
/// (e.g. `http://127.0.0.1:4321`). Empty string if the server failed to start.
/// The client builds iframe URLs like `<base>/games/<游戏名>/index.html`.
#[tauri::command]
pub fn get_game_server_url(
    state: State<'_, crate::AppState>,
) -> crate::Result<String> {
    Ok(state
        .game_server
        .as_ref()
        .map(|s| s.base_url.clone())
        .unwrap_or_default())
}

/// Removes characters that are invalid/unsafe in a directory name.
fn sanitize_dir_name(name: &str) -> String {
    let invalid = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    name.chars()
        .map(|c| if invalid.contains(&c) { '_' } else { c })
        .collect()
}
