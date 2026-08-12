//! 游戏脚本执行：变量展开 + 按行解析逐条执行。
//! 参考 Playnite 的全局脚本，但用更简单的"每行一条命令"方式，跨平台。
//! 每行非空、非注释（# 开头）会被解析成 "程序 参数..."，用系统命令逐条执行。

use crate::models::Game;
use crate::settings::AppPaths;
use std::path::Path;
use std::process::Command;

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
pub fn expand_variables(script: &str, game: &Game) -> String {
    let install_dir = game.install_directory.clone().unwrap_or_default();
    let lib = game.game_library.clone().unwrap_or_default();
    let app_dir = AppPaths::config_root().to_string_lossy().to_string();
    // 注意：先替换大括号变量，再替换小写形式（两种写法都支持）。
    let mut out = script.to_string();
    out = out
        .replace("{InstallDir}", &install_dir)
        .replace("{installdir}", &install_dir)
        .replace("{GameName}", &game.name)
        .replace("{gamename}", &game.name)
        .replace("{GameId}", &game.id)
        .replace("{gameid}", &game.id)
        .replace("{LibraryName}", &lib)
        .replace("{libraryname}", &lib)
        .replace("{AppDir}", &app_dir)
        .replace("{appdir}", &app_dir);
    out
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
