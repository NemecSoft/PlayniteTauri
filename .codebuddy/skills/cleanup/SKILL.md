---
name: cleanup
description: Clean up build artifacts, runtime data, logs and temp files in PlayniteTauri to keep the repository and workspace tidy. Use periodically or before committing.
---

# Cleanup（清理）

清理 PlayniteTauri 项目中的构建产物、运行时数据、日志和临时文件，保持仓库整洁。

## 需要清理的内容

### 1. 构建产物
| 路径 | 说明 | 是否入库 |
| --- | --- | --- |
| `node_modules/` | npm 依赖 | 否（.gitignore） |
| `dist/` | 前端构建输出 | 否 |
| `src-tauri/target/` | Rust 编译产物 | 否 |
| `release/` | 绿色 exe + 运行数据 | 否 |

### 2. 运行时数据（绿色模式，运行中产生）
- `release/library/`（含 `library.db`）— 可删除重建（会丢失游戏库数据）
- `release/UserData/` — WebView2 数据
- `release/cache/`、`release/extensions/` — 缓存/插件

> 注意：删除 `library.db` 会清空游戏库，下次启动会重新播种示例游戏。需用户确认。

### 3. 日志 / 临时文件
- `auto-build.log`、`auto-build.err.log`
- `*.log`
- `scripts/diag/`（如存在，诊断工具）
- git 残留：`*.orig`、`*.rej`

## 执行步骤
1. 用 `git status` 查看当前工作区，确认哪些是临时产物
2. 列出待清理文件清单
3. 删除非必要产物（不删除源码和 `docs/`）
4. 用 `git status` 确认清理后工作区干净
5. 报告清理结果

## 重要
- **绝不删除**源码（`src/`、`src-tauri/src/`）、设计文档（`docs/`）、构建脚本（`build.ps1`、`scripts/`）
- 删除用户数据前需明确告知并征得同意
