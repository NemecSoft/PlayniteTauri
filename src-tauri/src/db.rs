//! SQLite-backed persistence layer, mirroring Playnite's GameDatabase.

use crate::models::{AppSettings, Game, GameAction, GameLink};
use rusqlite::{Connection, params};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub type DbResult<T> = Result<T, DbError>;

pub struct Database {
    conn: Connection,
    path: PathBuf,
}

impl Database {
    /// Opens (or creates) the database at the given path.
    pub fn open(path: impl AsRef<Path>) -> DbResult<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(&path)?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;",
        )?;
        let db = Self { conn, path };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> DbResult<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS platforms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                specification_id TEXT,
                icon TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS library_plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT,
                enabled INTEGER NOT NULL DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
            "#,
        )?;
        Ok(())
    }

    // ---------------- Games ----------------

    pub fn get_all_games(&self) -> DbResult<Vec<Game>> {
        let mut stmt = self.conn.prepare("SELECT data FROM games")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut games = Vec::new();
        for r in rows {
            let data = r?;
            games.push(serde_json::from_str(&data)?);
        }
        Ok(games)
    }

    pub fn get_game(&self, id: &str) -> DbResult<Option<Game>> {
        let mut stmt = self.conn.prepare("SELECT data FROM games WHERE id = ?1")?;
        let mut rows = stmt.query_map(params![id], |row| row.get::<_, String>(0))?;
        if let Some(r) = rows.next() {
            let data = r?;
            Ok(Some(serde_json::from_str(&data)?))
        } else {
            Ok(None)
        }
    }

    pub fn upsert_game(&self, game: &Game) -> DbResult<()> {
        let data = serde_json::to_string(game)?;
        self.conn.execute(
            "INSERT INTO games (id, name, data) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data",
            params![game.id, game.name, data],
        )?;
        Ok(())
    }

    pub fn upsert_games(&self, games: &[Game]) -> DbResult<()> {
        for g in games {
            self.upsert_game(g)?;
        }
        Ok(())
    }

    pub fn delete_game(&self, id: &str) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM games WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn count_games(&self) -> DbResult<u64> {
        let n: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM games", [], |r| r.get(0))?;
        Ok(n as u64)
    }

    // ---------------- Platforms ----------------

    pub fn get_all_platforms(&self) -> DbResult<Vec<crate::models::Platform>> {
        let mut stmt = self.conn.prepare("SELECT id, name, specification_id, icon FROM platforms")?;
        let rows = stmt.query_map([], |r| {
            Ok(crate::models::Platform {
                id: r.get(0)?,
                name: r.get(1)?,
                specification_id: r.get(2)?,
                icon: r.get(3)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_platform(&self, p: &crate::models::Platform) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO platforms (id, name, specification_id, icon) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name,
                 specification_id = excluded.specification_id, icon = excluded.icon",
            params![p.id, p.name, p.specification_id, p.icon],
        )?;
        Ok(())
    }

    // ---------------- Settings ----------------

    pub fn get_setting(&self, key: &str) -> DbResult<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |r| r.get::<_, String>(0))?;
        Ok(rows.next().transpose()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn load_settings(&self) -> DbResult<AppSettings> {
        match self.get_setting("app")? {
            Some(json) => Ok(serde_json::from_str(&json)?),
            None => Ok(AppSettings::default()),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> DbResult<()> {
        let json = serde_json::to_string(settings)?;
        self.set_setting("app", &json)
    }

    // ---------------- Library plugins ----------------

    pub fn get_all_library_plugins(&self) -> DbResult<Vec<crate::models::LibraryPluginInfo>> {
        let mut stmt = self.conn.prepare("SELECT id, name, icon, enabled FROM library_plugins")?;
        let rows = stmt.query_map([], |r| {
            Ok(crate::models::LibraryPluginInfo {
                id: r.get(0)?,
                name: r.get(1)?,
                icon: r.get(2)?,
                enabled: r.get::<_, i64>(3)? != 0,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_library_plugin(&self, p: &crate::models::LibraryPluginInfo) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO library_plugins (id, name, icon, enabled) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon,
                 enabled = excluded.enabled",
            params![p.id, p.name, p.icon, p.enabled as i64],
        )?;
        Ok(())
    }

    pub fn delete_library_plugin(&self, id: &str) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM library_plugins WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

// Helper used by library scanning to build a GameAction from a path.
pub fn make_file_action(name: &str, path: &str) -> GameAction {
    GameAction {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        r#type: "File".into(),
        path: Some(path.to_string()),
        working_dir: Path::new(path)
            .parent()
            .map(|p| p.to_string_lossy().to_string()),
        arguments: None,
        is_play_action: true,
        track_game: true,
    }
}

pub fn empty_links() -> Vec<GameLink> {
    Vec::new()
}
