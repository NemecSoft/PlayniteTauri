---
name: init
description: Onboard into the PlayniteTauri codebase — understand architecture, data models, search, theming, i18n and build flow. Use at the start of a new development session.
---

# Init（项目初始化 / 上手）

在开始新的开发会话时运行，快速了解 PlayniteTauri 项目结构、架构和关键约定。

## 第一步：阅读核心文档
- `README.md` — 项目概览、功能清单、构建方式
- `docs/README.md` — 设计文档索引
- `docs/design/architecture.md` — 技术栈与模块划分
- `docs/design/data-models.md` — 游戏数据模型（重点：多名称设计）
- `docs/design/search.md` — 搜索系统（拼音首字母）
- `docs/design/green-storage.md` — 绿色存储与构建

## 第二步：理解目录结构
```
src/            React 前端（api / components / stores / i18n / types / utils / styles）
src-tauri/      Rust 后端（commands / db / library / process / models / settings 等）
docs/           设计文档（每次修改需同步）
scripts/        auto-build 自动构建
release/        绿色 exe + 运行数据（不入库）
```

## 第三步：关键开发约定
- **构建**：用 `build.ps1` 或 `scripts/auto-build.mjs`（不要直接 `cargo build`，会缺前端资源）
- **数据模型**：前后端同步（`models.rs` ↔ `types/models.ts`），改字段需 `#[serde(default)]` 保证向后兼容
- **多名称**：`Game.localizedNames` + `alternateNames`，搜索时纳入匹配
- **搜索**：`src/utils/search.ts` 用 `pinyin-pro`，支持中文首字母
- **i18n**：所有 UI 文本用 `t()`，改文案需同步三语字典
- **主题**：CSS 变量驱动，不硬编码颜色
- **文档同步**：修改后更新对应 `docs/design/*.md` + `docs/CHANGELOG.md`

## 第四步：检查 git 状态
- `git status` 确认工作区
- 确认无冲突的未提交改动

## 完成后
向用户简要总结项目关键信息（架构、数据模型、构建方式、本次会话目标）。
