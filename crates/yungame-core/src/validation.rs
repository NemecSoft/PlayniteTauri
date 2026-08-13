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
        // 如果占位符引用了一个不存在的库，给个"你可能想写 X"的提示，
        // 避免用户因为拼错/大小写问题反复卡住。占位符匹配是大小写不敏感
        // 的，所以"库找不到"基本就是拼写错了。
        let token = extract_placeholder_token(path);
        let placeholder_hint = token.as_deref().and_then(|tok| {
            if libs.iter().any(|l| l.name.eq_ignore_ascii_case(tok)) {
                None
            } else {
                suggest_placeholder(tok, libs)
            }
        });
        return ActionValidation {
            valid: false,
            resolved,
            reason: match (&token, &placeholder_hint) {
                (Some(tok), Some(s)) => format!("路径为空：占位符 {{{tok}}} 不存在，你是否想写 {{{s}}}？"),
                _ => "路径为空".into(),
            },
            extension: String::new(),
        };
    }

    let p = std::path::Path::new(&resolved);
    let extension = p
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if !p.exists() {
        // 如果是"占位符存在但指向了拼错的库名"，提示用户纠错。
        // 占位符匹配是大小写不敏感的，所以"库名找不到"通常就是拼错了。
        let token = extract_placeholder_token(path);
        let placeholder_hint = token.as_deref().and_then(|tok| {
            if libs.iter().any(|l| l.name.eq_ignore_ascii_case(tok)) {
                None
            } else {
                suggest_placeholder(tok, libs)
            }
        });
        let reason = match (&token, &placeholder_hint) {
            (Some(tok), Some(s)) => format!(
                "占位符 {{{tok}}} 找不到对应游戏库（你可能想写 {{{s}}}）；解析后的路径：{resolved}"
            ),
            _ => format!("文件不存在：{resolved}"),
        };
        return ActionValidation {
            valid: false,
            resolved,
            reason,
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

/// 从路径中提取 `{...}` 里的占位符名（不区分大小写）。比如
/// `{Gamelibrary2}\\X.exe` → Some("Gamelibrary2")。
fn extract_placeholder_token(p: &str) -> Option<String> {
    let trimmed = p.trim_start();
    if !trimmed.starts_with('{') {
        return None;
    }
    let end = trimmed.find('}')?;
    let token = trimmed[1..end].trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

/// 在已配置的游戏库里找和 `token` 拼写最接近的那个名字（编辑距离最小，
/// 且 ≤ 2 才返回）。当占位符拼写错时（如 `gamelibray2`），给出一个明确的
/// 修正建议，避免用户盲猜。
fn suggest_placeholder(token: &str, libs: &[GameLibrary]) -> Option<String> {
    let t = token.to_ascii_lowercase();
    let mut best: Option<(usize, String)> = None;
    for l in libs {
        let name = l.name.to_ascii_lowercase();
        let d = levenshtein(&t, &name);
        // 只在"足够接近"时才建议，否则可能误导用户（比如 `Gamelibrary2` 和
        // `Gamelibrary3` 距离是 1，但推荐错了反而添乱）。
        if d <= 2 && best.as_ref().map_or(true, |(bd, _)| d < *bd) {
            best = Some((d, l.name.clone()));
        }
    }
    best.map(|(_, n)| n)
}

/// 计算两个字符串的 Levenshtein 编辑距离（迭代版，避免引入依赖）。
/// 这里用作"占位符拼写纠错"的相似度度量，距离阈值很小（≤ 2）所以性能完全
/// 不是瓶颈，O(n*m) 也够用。
fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    if a.is_empty() {
        return b.len();
    }
    if b.is_empty() {
        return a.len();
    }
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut curr = vec![0usize; b.len() + 1];
    for i in 1..=a.len() {
        curr[0] = i;
        for j in 1..=b.len() {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1)
                .min(curr[j - 1] + 1)
                .min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b.len()]
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

    fn libs_with_names() -> Vec<GameLibrary> {
        vec![
            GameLibrary {
                id: "l1".into(),
                name: "Gamelibrary1".into(),
                path: r"Z:\不存在\1".into(),
            },
            GameLibrary {
                id: "l2".into(),
                name: "Gamelibrary2".into(),
                path: r"Z:\不存在\2".into(),
            },
        ]
    }

    #[test]
    fn suggest_close_typo() {
        // 拼写错（少个 r）："gamelibray2" → 建议 "Gamelibrary2"
        let s = suggest_placeholder("gamelibray2", &libs_with_names());
        assert_eq!(s.as_deref(), Some("Gamelibrary2"));
    }

    #[test]
    fn suggest_does_not_match_unrelated() {
        // 完全无关的名字不应该被建议（避免误导）
        let s = suggest_placeholder("totally_unrelated", &libs_with_names());
        assert!(s.is_none());
    }

    #[test]
    fn typo_placeholder_suggests_correction() {
        // 拼错占位符时，错误信息里要带"是否要写 X"的提示
        let r = validate_launch_path("{gamelibray2}\\Game.exe", Some("File"), &libs_with_names());
        assert!(!r.valid);
        assert!(r.reason.contains("Gamelibrary2"), "reason should suggest the correct name, got: {}", r.reason);
    }

    #[test]
    fn exact_match_placeholder_no_suggestion() {
        // 正确的占位符不应该触发纠错建议
        let r = validate_launch_path("{Gamelibrary2}\\Game.exe", Some("File"), &libs_with_names());
        assert!(!r.valid);
        // 路径解析成 Z:\不存在\2\Game.exe，文件不存在但不应该有"是否要写"的纠错
        assert!(!r.reason.contains("是否要写"));
    }

    #[test]
    fn levenshtein_basics() {
        assert_eq!(levenshtein("abc", "abc"), 0);
        assert_eq!(levenshtein("abc", "abcd"), 1);
        assert_eq!(levenshtein("kitten", "sitting"), 3);
    }
}
