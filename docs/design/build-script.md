# 构建脚本（build.ps1）与开发模式

## 多可执行程序

项目采用 Cargo workspace，`build.ps1` 会构建**两个**绿色可执行程序：

| 程序 | 来源 crate | 输出位置 | 是否随发布分发 |
| --- | --- | --- | --- |
| `Playnite.DesktopApp.exe` | `apps/desktop` | `release/` | ✅ 是 |
| `Playnite.Admin.exe` | `apps/admin` | `admin_release/` | ❌ 否（仅本地管理用） |

管理端要操作与客户端**同一数据库**时，把 `Playnite.Admin.exe` 放到客户端 exe 同目录运行即可
（绿色存储按 exe 所在目录定位）。

## 用法

```powershell
.\build.ps1            # release 构建（默认，构建客户端 + 管理端）
.\build.ps1 -Debug     # debug 构建
.\build.ps1 -ClientOnly  # 只构建客户端（更快）
.\build.ps1 -AdminOnly   # 只构建管理端
```

## 流程

1. 自动启用 **sccache**（若已安装，设置 `RUSTC_WRAPPER`；否则提示可选安装）。
2. 客户端：在 `apps/desktop` 执行 `cargo tauri build --no-bundle`：
   - 触发 `beforeBuildCommand`（`npm run build`）重新构建前端并嵌入 `dist/`。
   - 编译并链接，产物复制为 `release/Playnite.DesktopApp.exe`。
3. 管理端：先 `npm run build:admin`（前端 → `dist-admin/`），再在 `apps/admin` 执行
   `cargo tauri build --no-bundle`，产物（含 `WebView2Loader.dll`）复制为 `admin_release/Playnite.Admin.exe`。
4. 清理旧版本残留的 `%LOCALAPPDATA%\YunGame`（保证绿色）。
5. 显示构建耗时。

## 开发模式（快速验证，推荐）

**`tauri dev`** 提供前端 HMR + 后端增量编译，秒级验证，避免每次改代码都完整重编译 exe：

| 脚本 | 说明 |
| --- | --- |
| `dev-client.bat` | 客户端 `tauri dev`（Vite 端口 1420） |
| `dev-admin.bat` | 管理端 `tauri dev`（Vite 端口 1421，在 `apps/admin` 运行） |

- **前端改动**：Vite HMR 秒级热更新，无需重编译。
- **后端改动**：cargo debug 增量编译（只重编改动的 crate）。
- **数据目录**：debug 构建固定指向项目根 `release/`，开发与发布访问同一份数据。
- 首次运行会完整编译一次（数分钟），之后增量秒级。

## 自动构建（watch 模式）

- 脚本：`scripts/auto-build.mjs`（Node.js）。
- 启动：`npm run auto-build` 或双击 `auto-build.bat`。
- 监听：前端 `src/`、`admin/src/`、后端 `crates/`、`apps/` 源码变化，防抖后调用 `build.ps1` 完整构建。

## 关键约定

- **必须用 `build.ps1` / `auto-build` / `cargo tauri build --no-bundle`**，不要直接用 `cargo build`：
  后者不重新构建前端，生成的 exe 会尝试从 dev server（localhost）加载 → 报"连接被拒绝"。
- `cargo tauri build` **默认就是 release**，不能用 `--release`；想要 debug 用 `--debug`。
- 每个 Tauri 应用各自嵌入自己的前端（客户端 `dist/`，管理端 `dist-admin/`），互不干扰。
- 构建失败时（`$LASTEXITCODE` 非 0）脚本 `Write-Error` 中断。

## 构建加速（release profile）

- 根 `Cargo.toml` workspace 统一 release profile：`thin-LTO` + `codegen-units = 16` + `incremental = true`。
- `sccache` 缓存编译产物，增量重构极快。
- 首次 `tauri dev` 或 `cargo tauri build` 会完整编译一次（约 400+ crate），之后增量秒级。
