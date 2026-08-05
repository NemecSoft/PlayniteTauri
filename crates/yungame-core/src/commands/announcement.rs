//! Announcement command: reads the startup announcement HTML file from the
//! app's `announcements/` directory and returns it to the frontend. If no file
//! exists, a default announcement is returned.

use crate::settings::AppPaths;
use tauri::State;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Announcement {
    /// Raw HTML content to render in the announcement dialog.
    pub html: String,
    /// Whether a user-provided announcement file exists.
    pub from_file: bool,
}

const DEFAULT_HTML: &str = r#"<div class="announcement-hero">
  <div class="announcement-badge">NEW</div>
  <h1>Welcome to <span>YunGame</span></h1>
  <p>Your game library, reimagined.</p>
  <ul>
    <li>Multi-name &amp; Pinyin search support</li>
    <li>Three view modes: grid / list / details</li>
    <li>Fully portable (green) &amp; multi-language</li>
  </ul>
  <p class="hint">Put your own HTML here: <code>announcements/announcement.html</code></p>
</div>"#;

/// Reads the announcement HTML file. Returns the file content if it exists,
/// otherwise a default announcement.
#[tauri::command]
pub fn get_announcement(_state: State<'_, crate::AppState>) -> crate::Result<Announcement> {
    let path = AppPaths::announcement_file();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if !content.trim().is_empty() {
                return Ok(Announcement {
                    html: content,
                    from_file: true,
                });
            }
        }
    }
    Ok(Announcement {
        html: DEFAULT_HTML.to_string(),
        from_file: false,
    })
}
