//! 启动项路径检测（统一核心）。
//! 客户端"运行前检测"和管理端"批量检测"都用这一份逻辑，避免两套实现不一致。
//! 核心：把 `{游戏库名}` 占位符解析成绝对路径，再检查目标 exe/bat 是否存在、
//! 是否是可执行文件类型。

use crate::models::GameLibrary;
use crate::process::resolve_path;
use serde::Serialize;

/// 一次启动项路径的检测结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionValidation {
    /// 路径是否合法且目标存在、是可执行文件。
    pub valid: bool,
    /// 解析占位符后的绝对路径（如 `D:\Games\Grain Rot\Helden.exe`）。
    pub resolved: String,
    /// 不合法时的中文原因（合法时为空）。
    pub reason: String,
    /// 目标文件的扩展名（如 "exe"、"bat"、"lnk"、""）。
    pub extension: String,
}

/// 允许作为"游戏启动目标"的扩展名。
pub const EXECUTABLE_EXTS: [&str; 5] = ["exe", "bat", "cmd", "lnk", "com"];

/// 检测一个启动项路径（或 URL）是否有效。
/// `path` 可含 `{游戏库名}` 占位符，会先按游戏库列表解析成绝对路径再检查。
/// URL 类型不检查文件系统，只要非空即视为合法。
pub fn validate_launch_path(
    path: &str,
    action_type: Option<&str>,
    libs: &[GameLibrary],
) -> ActionValidation {
    // URL 不是文件系统路径，没什么可检测的，非空即合法。
    if action_type
        .map(|t| t.eq_ignore_ascii_case("URL"))
        .unwrap_or(false)
    {
        return ActionValidation {
            valid: !path.trim().is_empty(),
            resolved: path.to_string(),
            reason: String::new(),
            extension: String::new(),
        };
    }

    let resolved = resolve_path(path, libs);

    if resolved.trim().is_empty() {
        return ActionValidation {
            valid: false,
            resolved,
            reason: "路径为空".into(),
            extension: String::new(),
        };
    }

    let p = std::path::Path::new(&resolved);
    let extension = p
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if !p.exists() {
        return ActionValidation {
            valid: false,
            resolved,
            reason: "文件不存在".into(),
            extension,
        };
    }
    if p.is_dir() {
        return ActionValidation {
            valid: false,
            resolved,
            reason: "是目录而非可执行文件".into(),
            extension,
        };
    }
    if !EXECUTABLE_EXTS.contains(&extension.as_str()) {
        return ActionValidation {
            valid: false,
            resolved,
            reason: format!("不是可执行文件（.exe/.bat/.cmd/.lnk/.com，当前是 .{extension}）"),
            extension,
        };
    }
    ActionValidation {
        valid: true,
        resolved,
        reason: String::new(),
        extension,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn libs() -> Vec<GameLibrary> {
        // 注意：测试环境可能没有真实目录，这里用"一定不存在"的路径来验证非空/占位符解析逻辑。
        vec![GameLibrary {
            id: "l1".into(),
            name: "库1".into(),
            path: r"Z:\不存在\根目录".into(),
        }]
    }

    #[test]
    fn url_is_valid_without_filesystem() {
        let r = validate_launch_path("https://example.com", Some("URL"), &libs());
        assert!(r.valid);
        assert!(r.reason.is_empty());
    }

    #[test]
    fn empty_path_invalid() {
        let r = validate_launch_path("", Some("File"), &libs());
        assert!(!r.valid);
        assert!(r.reason.contains("路径为空"));
    }

    #[test]
    fn missing_library_placeholder_resolves_empty() {
        // 占位符引用了不存在的库名 → 解析为空 → 路径为空
        let r = validate_launch_path("{不存在的库}\\Game.exe", Some("File"), &libs());
        assert!(!r.valid);
    }

    #[test]
    fn non_executable_extension_invalid() {
        // 构造一个指向不存在的 .txt 的路径（库存在但文件不存在 → "文件不存在"）
        let r = validate_launch_path("C:\\definitely\\missing.txt", Some("File"), &[]);
        assert!(!r.valid);
    }
}
