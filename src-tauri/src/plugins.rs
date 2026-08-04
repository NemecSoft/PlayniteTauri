//! Plugin / extension system, mirroring Playnite's ExtensionFactory concept.
//! A plugin is a directory (or JSON manifest) describing a library or generic
//! extension that can provide games and metadata. In the Tauri rewrite, plugins
//! are defined declaratively (JSON) and executed via the frontend bridge.

use crate::models::{Game, LibraryPluginInfo, Platform};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub author: String,
    pub version: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub plugin_type: String, // "Library" | "GameMenu" | "Generic" | "Metadata"
    pub icon: Option<String>,
    /// For library plugins, a list of platforms they cover.
    pub platforms: Vec<String>,
    /// Optional static list of games the plugin provides.
    #[serde(default)]
    pub provided_games: Vec<PluginGame>,
    /// Whether the plugin can authenticate / has settings UI.
    #[serde(default)]
    pub has_settings: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginGame {
    pub id: String,
    pub name: String,
    pub platform: Option<String>,
    pub cover_image: Option<String>,
    pub background_image: Option<String>,
    pub description: Option<String>,
}

/// The plugin host. Discovers plugins from the plugins directory.
pub struct PluginHost {
    plugins_dir: std::path::PathBuf,
    manifests: Vec<PluginManifest>,
}

impl PluginHost {
    pub fn new(plugins_dir: std::path::PathBuf) -> Self {
        Self {
            plugins_dir,
            manifests: Vec::new(),
        }
    }

    /// Scans the plugins directory for manifest.json files.
    pub fn discover(&mut self) -> Vec<LibraryPluginInfo> {
        self.manifests.clear();
        let mut infos = Vec::new();
        if !self.plugins_dir.exists() {
            return infos;
        }
        if let Ok(entries) = std::fs::read_dir(&self.plugins_dir) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }
                let manifest_path = entry.path().join("manifest.json");
                if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                    if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                        let info = LibraryPluginInfo {
                            id: manifest.id.clone(),
                            name: manifest.name.clone(),
                            icon: manifest.icon.clone(),
                            enabled: true,
                        };
                        infos.push(info);
                        self.manifests.push(manifest);
                    }
                }
            }
        }
        infos
    }

    pub fn all_manifests(&self) -> &[PluginManifest] {
        &self.manifests
    }

    /// Collects games provided by all library plugins.
    pub fn collect_plugin_games(&self) -> Vec<Game> {
        let mut games = Vec::new();
        for manifest in &self.manifests {
            if manifest.plugin_type != "Library" {
                continue;
            }
            for pg in &manifest.provided_games {
                let now = chrono::Utc::now().to_rfc3339();
                games.push(Game {
                    id: format!("{}-{}", manifest.id, pg.id),
                    name: pg.name.clone(),
                    sort_name: None,
                    localized_names: Vec::new(),
                    alternate_names: Vec::new(),
                    game_id: Some(pg.id.clone()),
                    installed: false,
                    install_directory: None,
                    play_task: None,
                    other_tasks: Vec::new(),
                    last_played: None,
                    play_count: 0,
                    last_activity: None,
                    playtime: 0,
                    added: now.clone(),
                    modified: now,
                    category: Vec::new(),
                    genre: Vec::new(),
                    developer: Vec::new(),
                    publisher: Vec::new(),
                    tags: Vec::new(),
                    series: Vec::new(),
                    age_rating: Vec::new(),
                    region: Vec::new(),
                    source: vec![manifest.name.clone()],
                    features: Vec::new(),
                    release_date: None,
                    community_score: None,
                    critic_score: None,
                    user_score: None,
                    hidden: false,
                    favorite: false,
                    background_image: pg.background_image.clone(),
                    cover_image: pg.cover_image.clone(),
                    icon: None,
                    description: pg.description.clone(),
                    notes: None,
                    version: None,
                    platform: pg.platform.clone().into_iter().collect(),
                    emulator: None,
                    completion_status: None,
                    user_score_set: false,
                    manual_game: false,
                    plugin_id: Some(manifest.id.clone()),
                    links: Vec::new(),
                    actions: Vec::new(),
                    features_enabled: false,
                    guide: None,
                    screenshots: Vec::new(),
                    videos: Vec::new(),
                    game_level: 1,
                });
            }
        }
        games
    }
}

/// The set of built-in platforms, mirroring Playnite's built-in platform spec.
pub fn builtin_platforms() -> Vec<Platform> {
    let defs = [
        ("pc", "PC", "pc"),
        ("windows", "Windows", "pc_windows"),
        ("linux", "Linux", "pc_linux"),
        ("steam", "Steam", "steam"),
        ("epic", "Epic", "epic"),
        ("gog", "GOG", "gog"),
        ("ps4", "PlayStation 4", "ps4"),
        ("ps5", "PlayStation 5", "ps5"),
        ("switch", "Nintendo Switch", "switch"),
        ("xbox", "Xbox", "xbox"),
        ("android", "Android", "android"),
        ("ios", "iOS", "ios"),
        ("web", "Web", "web"),
    ];
    defs.iter()
        .map(|(id, name, spec)| Platform {
            id: id.to_string(),
            name: name.to_string(),
            specification_id: Some(spec.to_string()),
            icon: None,
        })
        .collect()
}

pub type PluginGameMap = HashMap<String, Vec<String>>;
