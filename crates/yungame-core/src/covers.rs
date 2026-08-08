//! Cover-image library: match local cover images to games by file name.
//!
//! Users drop images (e.g. `星际争霸.png`) into the app's `CoverImages`
//! directory. This module scans that directory once, builds a normalized
//! `file-name -> path` index (O(1) lookup), and matches each game against the
//! index using its Chinese display name, localized names, alternate names and
//! original name. Only games with an empty or stale (file-missing) `cover_image`
//! are filled in, so manually-set covers are never overwritten while they still
//! point to an existing file.

use crate::models::Game;
use crate::settings::AppPaths;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Image file extensions we consider as covers.
const IMAGE_EXTS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

/// Format priority for a same-named cover: higher wins. Animated formats
/// (APNG / WebP / GIF) are preferred over static JPEG/PNG, per user
/// preference: APNG > webp > gif > jpg > png.
fn format_priority(ext: &str, is_apng: bool) -> u32 {
    match ext {
        "png" if is_apng => 100, // APNG (animated PNG)
        "webp" => 80,
        "gif" => 60,
        "jpg" | "jpeg" => 40,
        "png" => 20,
        "bmp" => 10,
        _ => 0,
    }
}

/// Detect whether a `.png` file is actually an APNG (animated PNG) by
/// checking for the `acTL` chunk right after the IHDR chunk in the file head.
/// Cheap: only reads the first few bytes.
fn is_apng(path: &Path) -> bool {
    let Ok(mut f) = std::fs::File::open(path) else {
        return false;
    };
    let mut head = [0u8; 64];
    use std::io::Read;
    if f.read(&mut head).unwrap_or(0) < 33 {
        return false;
    }
    // PNG signature (8 bytes) + IHDR (must be 0x49484452 at bytes 12..16).
    if head[0..8] != [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a] {
        return false;
    }
    if &head[12..16] != b"IHDR" {
        return false;
    }
    // The chunk right after IHDR's data could be acTL for APNG.
    head.windows(4).any(|w| w == b"acTL")
}

/// Cached index so repeated `get_games` calls don't re-read the directory
/// unless files actually changed. Keyed by the directory's modified time.
static INDEX_CACHE: Mutex<Option<(PathBuf, u64, CoverIndex)>> = Mutex::new(None);

/// A snapshot index of the CoverImages directory: normalized name -> file path.
#[derive(Clone)]
pub struct CoverIndex {
    by_name: HashMap<String, PathBuf>,
    /// Total number of image files found (used for cheap change detection).
    pub file_count: usize,
}

/// Characters stripped from names before matching (CJK + common separators).
fn is_stripped(c: char) -> bool {
    matches!(
        c,
        ' ' | '\t' | '\r' | '\n'
            | '　'
            | '、' | '，' | '。' | '：' | '；' | '！' | '？' | '·' | '•'
            | '（' | '）' | '【' | '】' | '《' | '》' | '「' | '」' | '『' | '』' | '〈' | '〉'
            | '(' | ')' | '[' | ']' | '{' | '}' | '<' | '>'
            | '-' | '_' | '.' | ',' | '｜' | '|' | '&' | '+'
            | '\'' | '"' | '`' | '＊' | '*' | '＃' | '#'
    )
}

/// Normalize a name for fuzzy-but-deterministic matching:
/// lowercase, full-width -> half-width, strip spaces/punctuation/brackets
/// so `"星际争霸 (2)"`, `"星际争霸-2"` and `"星际争霸"` all match the same key.
pub fn normalize_name(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        let c = match ch {
            // Full-width alphanumerics -> half-width.
            '０'..='９' => char::from_u32('0' as u32 + (ch as u32 - '０' as u32)).unwrap_or(ch),
            'Ａ'..='Ｚ' => char::from_u32('A' as u32 + (ch as u32 - 'Ａ' as u32)).unwrap_or(ch),
            'ａ'..='ｚ' => char::from_u32('a' as u32 + (ch as u32 - 'ａ' as u32)).unwrap_or(ch),
            _ => ch,
        };
        if is_stripped(c) {
            continue;
        }
        out.push(c.to_ascii_lowercase());
    }
    out
}

/// Read the directory's last-modified time (used as a cheap cache key).
fn dir_mtime(dir: &Path) -> u64 {
    let Ok(meta) = std::fs::metadata(dir) else {
        return 0;
    };
    let Ok(modified) = meta.modified() else {
        return 0;
    };
    modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Build the normalized name -> path index from scratch.
fn build_index(dir: &Path) -> CoverIndex {
    let mut index: HashMap<String, PathBuf> = HashMap::new();
    let mut file_count = 0usize;

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(ext) = path.extension().map(|e| e.to_string_lossy().to_lowercase()) else {
                continue;
            };
            if !IMAGE_EXTS.contains(&ext.as_str()) {
                continue;
            }
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let key = normalize_name(&stem);
            if key.is_empty() {
                continue;
            }
            file_count += 1;
            // Prefer the higher-priority format for the same name: animated
            // (APNG/webp/gif) over static (jpg/png). Each file read for APNG
            // detection is tiny (a few bytes).
            let is_anim_png = ext == "png" && is_apng(&path);
            let prio = format_priority(&ext, is_anim_png);
            match index.get(&key) {
                Some(existing) => {
                    let e_ext = existing
                        .extension()
                        .map(|e| e.to_string_lossy().to_lowercase())
                        .unwrap_or_default();
                    let e_anim_png = e_ext == "png" && is_apng(existing);
                    let existing_prio = format_priority(&e_ext, e_anim_png);
                    if prio > existing_prio {
                        index.insert(key, path);
                    }
                }
                None => {
                    index.insert(key, path);
                }
            }
        }
    }

    CoverIndex {
        by_name: index,
        file_count,
    }
}

/// Scan the CoverImages directory, reusing a cached index when the directory
/// is unchanged since the last scan. This keeps `get_games` cheap even when
/// called frequently.
pub fn scan_cover_index() -> CoverIndex {
    let dir = AppPaths::cover_images_dir();
    let mtime = dir_mtime(&dir);
    let mut cache = INDEX_CACHE.lock().unwrap();
    if let Some((cached_dir, cached_mtime, cached)) = cache.as_ref() {
        if cached_dir == &dir && *cached_mtime == mtime {
            return cached.clone();
        }
    }
    let built = build_index(&dir);
    *cache = Some((dir, mtime, built.clone()));
    built
}

/// Resolve the cover image path for a single game, if a matching file exists.
pub fn match_cover<'a>(index: &'a CoverIndex, game: &Game) -> Option<&'a Path> {
    // Collect every candidate name once, deduplicated, in priority order.
    let mut seen = std::collections::HashSet::new();
    let mut candidates: Vec<&str> = Vec::new();

    // 1) Chinese display name (zh-CN -> zh-TW) first.
    for lang in ["zh-CN", "zh-TW"] {
        if let Some(ln) = game.localized_names.iter().find(|n| n.language == lang) {
            let t = ln.name.trim();
            if !t.is_empty() && seen.insert(t) {
                candidates.push(t);
            }
        }
    }
    // 2) All other localized names.
    for ln in &game.localized_names {
        let t = ln.name.trim();
        if !t.is_empty() && seen.insert(t) {
            candidates.push(t);
        }
    }
    // 3) Alternate names.
    for a in &game.alternate_names {
        let t = a.trim();
        if !t.is_empty() && seen.insert(t) {
            candidates.push(t);
        }
    }
    // 4) Original primary name.
    if seen.insert(game.name.trim()) {
        candidates.push(game.name.trim());
    }

    for name in candidates {
        let key = normalize_name(name);
        if key.is_empty() {
            continue;
        }
        if let Some(p) = index.by_name.get(&key) {
            return Some(p.as_path());
        }
    }
    None
}

/// Scan the CoverImages directory and fill `cover_image` for games that don't
/// have one yet. Returns a summary of matches.
pub struct CoverScanResult {
    /// Number of games that now have a cover.
    pub matched: usize,
    /// Number of cover image files available in the directory.
    pub cover_files: usize,
    /// Total games considered (those with an empty cover).
    pub considered: usize,
    /// Whether the CoverImages directory exists.
    pub dir_exists: bool,
    /// Absolute path of the CoverImages directory.
    pub dir_path: String,
}

/// Apply the cover library to the given games, returning a new Vec with
/// `cover_image` filled where a match is found and the field was empty.
pub fn apply_covers(games: &[Game]) -> (Vec<Game>, CoverScanResult) {
    let index = scan_cover_index();
    let mut matched = 0usize;
    let mut considered = 0usize;

    let updated: Vec<Game> = games
        .iter()
        .map(|g| {
            // A cover is "present" only if its path is non-empty AND the file
            // actually exists on disk. If the stored path is stale (the file was
            // deleted/renamed, e.g. a user swapped `007.jpg` for `007.gif`), we
            // re-match against the CoverImages dir so the new file takes over.
            let has_cover = g
                .cover_image
                .as_deref()
                .map(|s| !s.trim().is_empty() && Path::new(s.trim()).is_file())
                .unwrap_or(false);
            if has_cover {
                return g.clone();
            }
            considered += 1;
            if let Some(path) = match_cover(&index, g) {
                matched += 1;
                let mut ng = g.clone();
                ng.cover_image = Some(path.to_string_lossy().to_string());
                ng
            } else {
                g.clone()
            }
        })
        .collect();

    let dir = AppPaths::cover_images_dir();
    let dir_exists = dir.is_dir();
    (
        updated,
        CoverScanResult {
            matched,
            cover_files: index.file_count,
            considered,
            dir_exists,
            dir_path: dir.to_string_lossy().to_string(),
        },
    )
}

/// Persist covers into the database for games that lack one, and return the
/// updated games plus a summary. Called by `get_games` so the frontend always
/// sees covers without a separate round-trip.
pub fn apply_covers_to_db(
    db: &crate::db::Database,
    games: Vec<Game>,
) -> crate::Result<(Vec<Game>, CoverScanResult)> {
    let (updated, result) = apply_covers(&games);
    // Persist only the games whose cover changed and is now set.
    for (i, g) in updated.iter().enumerate() {
        let before = &games[i];
        if g.cover_image != before.cover_image && g.cover_image.is_some() {
            db.upsert_game(g)?;
        }
    }
    Ok((updated, result))
}
