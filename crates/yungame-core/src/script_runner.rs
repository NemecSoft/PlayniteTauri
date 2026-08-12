//! 游戏脚本执行：变量展开 + 按行解析逐条执行。
//! 参考 Playnite 的全局脚本，但用更简单的"每行一条命令"方式，跨平台。
//! 每行非空、非注释（# 开头）会被解析成 "程序 参数..."，用系统命令逐条执行。

use crate::models::Game;
use crate::settings::AppPaths;
use std::path::Path;
use std::process::Command;

#[cfg(test)]
mod tests {
    use super::*;

    /// 构造一个带各字段的测试游戏。
    fn make_game() -> Game {
        let mut g: Game = serde_json::from_str(r#"{"id":"g1","name":"我的游戏"}"#).unwrap();
        g.install_directory = Some(r"D:\Games\MyGame".to_string());
        g.game_library = Some("Steam".to_string());
        g
    }

    /// 变量展开：各占位符替换成对应值。
    #[test]
    fn expand_variables_replaces_all_known() {
        let g = make_game();
        let out = expand_variables(
            "{InstallDir} {GameName} {GameId} {LibraryName}",
            &g,
        );
        assert!(out.contains(r"D:\Games\MyGame"));
        assert!(out.contains("我的游戏"));
        assert!(out.contains("g1"));
        assert!(out.contains("Steam"));
    }

    /// 变量展开：不区分大小写（两种写法都支持）。
    #[test]
    fn expand_variables_is_case_insensitive() {
        let g = make_game();
        let out = expand_variables("{installdir}|{GAMENAME}", &g);
        assert!(out.contains(r"D:\Games\MyGame"));
        assert!(out.contains("我的游戏"));
    }

    /// 未知/未设置变量替换为空字符串，不报错。
    #[test]
    fn expand_variables_missing_variable_cleared() {
        let mut g = make_game();
        // 安装目录为空时 {InstallDir} 应为空
        g.install_directory = None;
        let out = expand_variables("[{InstallDir}]", &g);
        assert_eq!(out, "[]");
    }

    /// 空行和 # 注释行被跳过（不产生结果）。
    #[test]
    fn run_script_skips_blank_and_comments() {
        let script = "\n  \n# 注释行\n\n";
        let results = run_script(script, None);
        assert!(results.is_empty());
    }

    /// 不存在的命令行应标记为失败，但不 panic。
    #[test]
    fn run_script_reports_failed_line() {
        // 用一个几乎不可能存在的命令，验证失败行被标记。
        let script = "this_command_does_not_exist_xyz123";
        let results = run_script(script, None);
        assert_eq!(results.len(), 1);
        assert!(!results[0].ok);
        assert!(results[0].error.is_some());
    }
}

/// 单行脚本的执行结果。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLineResult {
    pub line: String,
    pub ok: bool,
    pub error: Option<String>,
}

/// 把脚本里的变量替换成实际值。
/// 支持：{InstallDir} {GameName} {GameId} {LibraryName} {AppDir}。
/// 缺失/为空的变量替换成空字符串，不报错。
/// 大小写不敏感地在 hay 中查找 needle 第一次出现的位置。
fn find_ci(hay: &str, needle: &str) -> Option<usize> {
    let hb = hay.as_bytes();
    let nb = needle.as_bytes();
    if nb.is_empty() || nb.len() > hb.len() {
        return None;
    }
    hb.windows(nb.len())
        .position(|w| w.eq_ignore_ascii_case(nb))
}

/// 把 hay 中所有大小写不敏感匹配 from 的地方替换成 to。
/// 变量键都是 ASCII（字母+花括号），用 eq_ignore_ascii_case 忽略大小写。
fn replace_ci(hay: &str, from: &str, to: &str) -> String {
    let mut out = String::new();
    let mut rest = hay;
    while let Some(pos) = find_ci(rest, from) {
        out.push_str(&rest[..pos]);
        out.push_str(to);
        rest = &rest[pos + from.len()..];
    }
    out.push_str(rest);
    out
}

pub fn expand_variables(script: &str, game: &Game) -> String {
    let install_dir = game.install_directory.clone().unwrap_or_default();
    let lib = game.game_library.clone().unwrap_or_default();
    let app_dir = AppPaths::config_root().to_string_lossy().to_string();
    // 所有占位符统一做"不区分大小写"替换，用户写 {Installdir}/{GAMENAME} 都生效。
    let out = replace_ci(script, "{InstallDir}", &install_dir);
    let out = replace_ci(&out, "{GameName}", &game.name);
    let out = replace_ci(&out, "{GameId}", &game.id);
    let out = replace_ci(&out, "{LibraryName}", &lib);
    replace_ci(&out, "{AppDir}", &app_dir)
}

/// 执行一段多行脚本。每行非空、非 # 注释，解析成 "程序 参数..." 执行。
/// 逐行独立，单行失败不影响后续行。返回每行结果，供上层展示。
pub fn run_script(script: &str, cwd: Option<&Path>) -> Vec<ScriptLineResult> {
    let mut results = Vec::new();
    for raw in script.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue; // 跳过空行和注释
        }
        // 简单按空白切分：第一段是程序，其余是参数。
        let mut parts = line.split_whitespace();
        let program = parts.next().unwrap_or_default();
        let args: Vec<&str> = parts.collect();
        let mut cmd = Command::new(program);
        cmd.args(&args);
        if let Some(c) = cwd {
            cmd.current_dir(c);
        }
        match cmd.output() {
            Ok(_) => results.push(ScriptLineResult {
                line: line.to_string(),
                ok: true,
                error: None,
            }),
            Err(e) => results.push(ScriptLineResult {
                line: line.to_string(),
                ok: false,
                error: Some(e.to_string()),
            }),
        }
    }
    results
}
