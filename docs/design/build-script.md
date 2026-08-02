# 构建脚本（build.ps1）

## 作用

一键构建绿色版 `Playnite.DesktopApp.exe`。

## 用法

```powershell
.\build.ps1          # release 构建（默认，推荐分发）
.\build.ps1 -Debug   # debug 构建
```

## 流程

1. 自动启用 **sccache**（若已安装，设置 `RUSTC_WRAPPER`）。
2. 执行 `cargo tauri build --no-bundle`（**release 默认**，`-Debug` 时加 `--debug`）：
   - 触发 `beforeBuildCommand`（`npm run build`）重新构建前端并嵌入。
   - 编译 Rust 后端。
3. 将产物复制为 `release/Playnite.DesktopApp.exe`。
4. 清理旧版本残留的 `%LOCALAPPDATA%\Playnite`（保证绿色）。
5. 显示构建耗时。

## 自动构建（watch 模式）

**无需手动运行**：修改代码后自动重新构建绿色 exe。

- 脚本：`scripts/auto-build.mjs`（Node.js，监听文件变化）。
- 启动方式：
  - 命令行：`npm run auto-build` 或 `node scripts/auto-build.mjs`
  - **双击 `auto-build.bat`**（无需输入命令，开箱即用）
- 行为：监听前端 `src/`、后端 `src-tauri/src/`、`Cargo.toml`、`tauri.conf.json`、
  `capabilities/` 的变化，防抖 600ms 后自动调用 `build.ps1` 完整构建并复制 exe。
- 停止：按 `Ctrl+C`（或关闭 bat 窗口）。
- 说明：自动构建与手动 `build.ps1` 逻辑完全一致，产物同样为 `release/Playnite.DesktopApp.exe`。

## 关键约定

- **必须用本脚本 / `auto-build` / `cargo tauri build --no-bundle`**，不要直接用 `cargo build`：
  后者不重新构建前端，生成的 exe 会尝试从 dev server（localhost）加载 → 报"连接被拒绝"。
- `cargo tauri build` **默认就是 release**，不能用 `--release`（会报参数错误）；
  想要 debug 用 `--debug`。
- 构建失败时（`$LASTEXITCODE` 非 0）脚本 `Write-Error` 中断。
