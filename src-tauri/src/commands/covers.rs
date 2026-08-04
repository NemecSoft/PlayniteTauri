//! Cover-image library commands.
//!
//! The batch `read_images_batch` command is the preferred entry point for the
//! frontend: it accepts a list of absolute image paths, returns the bytes for
//! each (in the same order, with `None` for invalid/denied paths), and caches
//! the results in a process-wide map so repeated lookups are O(1) and avoid
//! re-reading from disk.

use crate::covers;
use crate::models::Game;
use crate::AppState;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverScanOutcome {
    pub matched: usize,
    pub cover_files: usize,
    pub considered: usize,
    pub dir_exists: bool,
    pub dir_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverScanResponse {
    pub games: Vec<Game>,
    pub outcome: CoverScanOutcome,
}

/// Re-run cover matching for all games, persist new covers, and return the
/// updated game list plus a summary. Used at startup / on demand.
#[tauri::command]
pub fn scan_covers(state: State<AppState>) -> crate::Result<CoverScanResponse> {
    let db = state.db.lock().unwrap();
    let games = db.get_all_games()?;
    let (updated, res) = covers::apply_covers_to_db(&db, games)?;
    Ok(CoverScanResponse {
        games: updated,
        outcome: CoverScanOutcome {
            matched: res.matched,
            cover_files: res.cover_files,
            considered: res.considered,
            dir_exists: res.dir_exists,
            dir_path: res.dir_path.clone(),
        },
    })
}

/// Returns a summary + the list of image files found in the CoverImages
/// directory, without touching the database. Used by the settings UI.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverDirInfo {
    pub dir_path: String,
    pub dir_exists: bool,
    pub cover_files: usize,
    pub images: Vec<String>,
}

#[tauri::command]
pub fn get_cover_dir_info() -> crate::Result<CoverDirInfo> {
    let dir = crate::settings::AppPaths::cover_images_dir();
    let dir_exists = dir.is_dir();
    let mut images = Vec::new();
    let mut cover_files = 0usize;
    if dir_exists {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string()) {
                        cover_files += 1;
                        images.push(name);
                    }
                }
            }
        }
        images.sort();
    }
    Ok(CoverDirInfo {
        dir_path: dir.to_string_lossy().to_string(),
        dir_exists,
        cover_files,
        images,
    })
}

/// Read a local image file and return its bytes + MIME type. Used by the
/// frontend to render covers/screenshots stored as absolute paths, without
/// relying on the Tauri asset protocol (which has variable scope behaviour
/// across Tauri 2 patch versions on Windows).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePayload {
    pub bytes: Vec<u8>,
    pub mime: String,
}

fn mime_from_ext(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

// ---- Single-image path (kept for backward compat) ----

#[tauri::command]
pub async fn read_image(path: String) -> crate::Result<ImagePayload> {
    // Try cache first.
    if let Some(p) = cache_get(&path) {
        return Ok(p);
    }
    let path_clone = path.clone();
    // File I/O + validation run off the main thread so the UI never blocks.
    let bytes = tauri::async_runtime::spawn_blocking(move || read_one_validated(&path_clone))
        .await
        .map_err(|e| crate::AppError::Other(format!("join: {}", e)))??;
    let mime = mime_from_ext(Path::new(&path)).to_string();
    let payload = ImagePayload { bytes, mime };
    cache_put(&path, payload.clone());
    Ok(payload)
}

// ---- Batch image path (preferred) ----

/// Read up to N images in a single IPC call. Returns Vec<Option<ImagePayload>>
/// in the same order as `paths`. `None` means: path invalid / denied / missing.
/// Cache hits are served directly from memory; misses read the file once.
#[tauri::command]
pub async fn read_images_batch(paths: Vec<String>) -> crate::Result<Vec<Option<ImagePayload>>> {
    // Resolve the allowed directories up front, then hand all I/O to a
    // blocking task so the main thread / UI thread is never stalled.
    let cover_dir = crate::settings::AppPaths::cover_images_dir()
        .canonicalize()
        .ok();
    let images_dir = crate::settings::AppPaths::images_dir().canonicalize().ok();
    let (cover_dir, images_dir) = (cover_dir, images_dir);

    tauri::async_runtime::spawn_blocking(move || {
        let mut out: Vec<Option<ImagePayload>> = Vec::with_capacity(paths.len());
        for p in paths {
            // 1. Try the in-memory cache first.
            if let Some(cached) = cache_get(&p) {
                out.push(Some(cached));
                continue;
            }
            // 2. Validate against the allowed directories (cached containers).
            let parsed = PathBuf::from(&p);
            let canonical = match parsed.canonicalize() {
                Ok(c) => c,
                Err(_) => {
                    out.push(None);
                    continue;
                }
            };
            let allowed = match cover_dir.as_ref() {
                Some(d) => canonical.starts_with(d),
                None => false,
            } || match images_dir.as_ref() {
                Some(d) => canonical.starts_with(d),
                None => false,
            };
            if !allowed {
                out.push(None);
                continue;
            }
            // 3. Read the file.
            let bytes = match std::fs::read(&canonical) {
                Ok(b) => b,
                Err(_) => {
                    out.push(None);
                    continue;
                }
            };
            let mime = mime_from_ext(&canonical).to_string();
            let payload = ImagePayload { bytes, mime };
            cache_put(&p, payload.clone());
            out.push(Some(payload));
        }
        Ok::<Vec<Option<ImagePayload>>, crate::AppError>(out)
    })
    .await
    .map_err(|e| crate::AppError::Other(format!("join: {}", e)))?
}

fn read_one_validated(path: &str) -> crate::Result<Vec<u8>> {
    let cover_dir = crate::settings::AppPaths::cover_images_dir();
    let images_dir = crate::settings::AppPaths::images_dir();
    let canonical = Path::new(path)
        .canonicalize()
        .map_err(|e| crate::AppError::Other(format!("canonicalize: {}", e)))?;
    let allowed_cover = cover_dir
        .canonicalize()
        .map(|d| canonical.starts_with(&d))
        .unwrap_or(false);
    let allowed_images = images_dir
        .canonicalize()
        .map(|d| canonical.starts_with(&d))
        .unwrap_or(false);
    if !allowed_cover && !allowed_images {
        return Err(crate::AppError::Other(format!(
            "image path not allowed: {}",
            path
        )));
    }
    std::fs::read(&canonical).map_err(|e| crate::AppError::Other(format!("read: {}", e)))
}

// ---- Process-wide image cache ----
//
// Keyed by the *original* (uncanonicalized) path the frontend passed in, which
// is stable across renders. Values are full ImagePayloads; on cache hit we
// return a clone (cheap for small payloads, and avoids any cross-thread
// lifetime issues since the cache guard is dropped before we return).

static IMAGE_CACHE: OnceLock<Mutex<HashMap<String, ImagePayload>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, ImagePayload>> {
    IMAGE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cache_get(path: &str) -> Option<ImagePayload> {
    cache().lock().ok().and_then(|m| m.get(path).cloned())
}

fn cache_put(path: &str, payload: ImagePayload) {
    if let Ok(mut m) = cache().lock() {
        m.insert(path.to_string(), payload);
    }
}

/// Test/diagnostic helper: clear the in-process image cache. Used by tests
/// and (optionally) by the frontend via the dedicated command below.
#[tauri::command]
pub fn clear_image_cache() -> crate::Result<usize> {
    let mut m = cache().lock().map_err(|e| crate::AppError::Other(format!("lock: {}", e)))?;
    let n = m.len();
    m.clear();
    Ok(n)
}