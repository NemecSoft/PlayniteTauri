# 构建加速

## 目标

减少每次修改后的重新编译时间。实测从 **3 分钟+ 降至 ~49 秒**（修改单个后端文件后增量编译）。

## 优化手段（行业推荐方案）

### 1. Release Profile（`src-tauri/Cargo.toml`）

| 配置 | 之前 | 之后 | 效果 |
| --- | --- | --- | --- |
| `lto` | `true`（全量 LTO） | `"thin"`（薄 LTO） | 链接快 2~3 倍，运行性能接近 |
| `codegen-units` | `1`（串行单文件） | `16`（并行 codegen） | 编译并行化 |
| `opt-level` | `"s"` | `3`（自身 crate） | 自身代码优化更好 |
| `incremental` | 无 | `true` | 增量编译，复用上次产物 |
| **依赖优化** `[profile.release.package."*"]` | 全 opt-level=3 | `opt-level = 2` + `codegen-units = 16` | 800+ 依赖 crate 大幅加速 |

> `lto` 是链接级设置，不能在 `package."*"` 中覆盖（会报错），故只覆盖 `opt-level` 与 `codegen-units`。

### 2. sccache（Rust 社区标准编译缓存）

- 已安装 `sccache`（`cargo install sccache`）。
- `build.ps1` 自动检测并设置 `RUSTC_WRAPPER=sccache`。
- 跨构建缓存编译产物，重复构建命中缓存。

### 3. 项目级配置（`src-tauri/.cargo/config.toml`）

- `jobs = 8`：并行编译。
- `[profile.dev]` / `[profile.release]` 均 `incremental = true`。

## 实测

| 场景 | 优化前 | 优化后 |
| --- | --- | --- |
| 修改单个后端文件后增量编译 | 3 分钟+ | ~49 秒 |
| 完整 `build.ps1`（前端 + 后端） | 5 分钟+ | ~2 分钟（sccache 命中后更快） |

## 注意

- 首次全量编译或依赖配置变更后会有一次性重编译成本（数分钟）。
- 构建必须用 `build.ps1` 或 `cargo tauri build --no-bundle`，否则前端资源不嵌入，
  exe 会尝试加载 dev server（localhost）而失败。
