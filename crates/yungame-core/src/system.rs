//! App-level system info & helpers.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub app_name: String,
    pub version: String,
    pub os: String,
    pub arch: String,
    pub data_dir: String,
    pub config_dir: String,
}

impl AppInfo {
    pub fn current() -> Self {
        let os = std::env::consts::OS.to_string();
        let arch = std::env::consts::ARCH.to_string();
        let data_dir = dirs::data_local_dir()
            .map(|d| d.join("YunGame").to_string_lossy().to_string())
            .unwrap_or_default();
        let config_dir = dirs::config_dir()
            .map(|d| d.to_string_lossy().to_string())
            .unwrap_or_default();
        Self {
            app_name: "YunGame".into(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            os,
            arch,
            data_dir,
            config_dir,
        }
    }
}
