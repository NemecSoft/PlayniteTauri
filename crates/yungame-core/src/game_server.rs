//! Local HTTP server that serves per-game static detail pages from
//! `Game_Details/`, using the mature **axum** + **tower-http::services::ServeDir**
//! stack as the static file serving core.
//!
//! Design intent: this is **not** a hand-rolled HTTP server. It is a thin wrapper
//! that delegates all real HTTP semantics — request parsing, response framing,
//! MIME detection, **HTTP Range / Partial Content (206) for video seeking &
//! playback**, `HEAD`, streaming large files without loading them into memory,
//! `If-Modified-Since` caching, path-traversal protection, and keep-alive — to
//! `tower_http::services::ServeDir`, the same building block used by production
//! Rust web services. This mirrors how mature launchers / static hosts (Go's
//! `http.FileServer`, Python's `SimpleHTTPRequestHandler`, nginx `static`)
//! serve game metadata, so any arbitrary static site under
//! `Game_Details/<游戏名>/` loads in the webview iframe natively (css/js/images,
//! scripts, `#anchor`), with zero per-page patching.
//!
//! On top of static serving, this module adds one small **dynamic API**:
//! `GET /api/videos?dir=<游戏目录名>` returns the list of videos under
//! `Game_Details/<游戏目录名>/videos/` as JSON, so a detail page can render a
//! video playlist purely from what the user drops into the folder (supporting
//! sub-folder grouping). This reproduces the behaviour of the reference Node
//! `server.js` that game pages were originally tested against, but implemented
//! as an axum handler on the same self-contained server.
//!
//! URL mapping:
//!   - static: `<base>/games/<游戏名>/<相对路径>` → `Game_Details/<游戏名>/<相对路径>`
//!   - API:    `<base>/api/videos?dir=<游戏目录名>` → JSON video list
//!
//! Runtime: a dedicated `tokio` runtime is spawned in a background `std::thread`,
//! so the static server is fully self-contained and does not depend on Tauri
//! async-runtime initialization timing.

use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::routing::get;
use serde::Deserialize;
use serde_json::json;
use std::cmp::Ordering;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Owned handle to the running static server.
pub struct GameServer {
    /// Base URL the server listens on, e.g. `http://127.0.0.1:<port>`.
    pub base_url: String,
    /// Keeps the server thread alive for the app's lifetime.
    _handle: std::thread::JoinHandle<()>,
}

impl GameServer {
    /// Binds an ephemeral loopback port and spawns the `ServeDir`-backed server.
    ///
    /// `root` is the `Game_Details/` directory; URL `<base>/games/<x>/...` is
    /// mapped onto `<root>/<x>/...`.
    pub fn start(root: PathBuf) -> std::io::Result<Self> {
        let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
        // `tokio::net::TcpListener::from_std` requires non-blocking mode.
        listener.set_nonblocking(true)?;
        let addr: SocketAddr = listener.local_addr()?;
        let base_url = format!("http://127.0.0.1:{}", addr.port());

        let handle = std::thread::spawn(move || {
            run_server(listener, root);
        });

        Ok(GameServer {
            base_url,
            _handle: handle,
        })
    }
}

fn run_server(listener: std::net::TcpListener, root: PathBuf) {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("failed to build game-server tokio runtime");
    runtime.block_on(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[game_server] from_std failed: {e}");
                return;
            }
        };
        let root = Arc::new(root);
        // `ServeDir` (tower-http) is a drop-in `tower::Service` for axum: it
        // already implements GET + HEAD, HTTP Range/206 for video, streaming,
        // MIME detection, and safe path resolution — i.e. every behaviour a
        // "load any static website" container needs.
        let serve_dir = tower_http::services::ServeDir::new(root.as_ref())
            .append_index_html_on_directories(true);
        let app = axum::Router::new()
            // Dynamic JSON API: list videos in a game's `videos/` folder.
            .route("/api/videos", get(api_videos))
            .with_state(root.clone())
            // Static files under `/games/<游戏名>/...`.
            .nest_service("/games", serve_dir);
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("[game_server] serve failed: {e}");
        }
    });
}

// ---------------------------------------------------------------------------
// `/api/videos` — dynamic video-list API
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct VideosQuery {
    /// A path that locates the game folder under the server root.
    /// The page sends its own location path, e.g. `/games/Kenshi剑士/`.
    dir: Option<String>,
}

/// Video file extensions considered "a video" for listing purposes.
/// Mirrors the reference `server.js`.
const VIDEO_EXTS: &[&str] = &[
    ".mp4", ".webm", ".ogv", ".mov", ".m4v", ".mkv", ".flv", ".avi",
];

async fn api_videos(
    Query(query): Query<VideosQuery>,
    State(root): State<Arc<PathBuf>>,
) -> impl IntoResponse {
    let dir = query.dir.unwrap_or_default();
    // `dir` may look like `/games/Kenshi剑士/` (from the page's own location).
    // Normalise to a bare relative folder name under the root, guarding against
    // traversal so we never escape `Game_Details/`.
    let rel = normalize_dir(&dir);
    // Lexical guard: never allow `..` segments or an empty dir (which would
    // point at the whole `Game_Details/` tree). `root.join(rel)` can only stay
    // under the root once `..` and absolute segments are excluded.
    if rel.is_empty() || rel.split(['/', '\\']).any(|s| s == "..") || Path::new(&rel).is_absolute() {
        return axum::http::StatusCode::FORBIDDEN.into_response();
    }
    let videos_root = root.join(&rel).join("videos");

    let mut root_files: Vec<String> = Vec::new();
    let mut dirs: Vec<(String, Vec<String>)> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&videos_root) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let is_file = entry.file_type().map(|t| t.is_file()).unwrap_or(false);
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

            if is_file && is_video(&name) {
                root_files.push(name);
            } else if is_dir {
                // Group videos inside a sub-folder of `videos/`.
                let mut files: Vec<String> = Vec::new();
                if let Ok(sub) = std::fs::read_dir(entry.path()) {
                    for se in sub.flatten() {
                        let sn = se.file_name().to_string_lossy().to_string();
                        if se.file_type().map(|t| t.is_file()).unwrap_or(false) && is_video(&sn) {
                            files.push(format!("{name}/{sn}"));
                        }
                    }
                }
                if !files.is_empty() {
                    dirs.push((name, files));
                }
            }
        }
    }

    // Natural sort: numeric runs compare by value (实况2 < 实况10), ASCII first.
    root_files.sort_by(|a, b| natural_cmp(a, b));
    dirs.sort_by(|a, b| natural_cmp(&a.0, &b.0));
    let dirs_json: Vec<_> = dirs
        .into_iter()
        .map(|(n, mut files)| {
            files.sort_by(|a, b| natural_cmp(a, b));
            json!({ "name": n, "files": files })
        })
        .collect();

    let body = json!({ "root": root_files, "dirs": dirs_json });
    axum::Json(body).into_response()
}

fn is_video(name: &str) -> bool {
    Path::new(name)
        .extension()
        .map(|e| {
            let ext = format!(".{}", e.to_string_lossy().to_lowercase());
            VIDEO_EXTS.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

/// Normalises a `dir` param into a bare relative folder name under the root.
///
/// Accepts any of the forms the pages may send: `/games/Kenshi剑士/`,
/// `games/Kenshi剑士`, `/Kenshi剑士`, or `Kenshi剑士`. Trailing slashes and
/// a leading `games/` prefix are stripped.
fn normalize_dir(dir: &str) -> String {
    let mut rel = dir.trim_matches('/').to_string();
    if let Some(rest) = rel.strip_prefix("games/") {
        rel = rest.to_string();
    } else if rel == "games" {
        rel.clear();
    }
    rel
}

/// Builds a "natural sort" key: each run of ASCII digits is zero-padded to a
/// fixed width so that string comparison orders numbers by value
/// (`实况2` < `实况10`). Non-digit characters pass through unchanged, so ASCII
/// letters sort before CJK.
fn natural_key(s: &str) -> String {
    let mut out = String::new();
    let mut digits = String::new();
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            digits.push(ch);
        } else {
            if !digits.is_empty() {
                out.push_str(&format!("{:0>12}", digits));
                digits.clear();
            }
            out.push(ch);
        }
    }
    if !digits.is_empty() {
        out.push_str(&format!("{:0>12}", digits));
    }
    out
}

fn natural_cmp(a: &str, b: &str) -> Ordering {
    natural_key(a).cmp(&natural_key(b))
}
