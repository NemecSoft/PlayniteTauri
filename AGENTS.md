# AI Agent Instructions（PlayniteTauri）

## Overview

PlayniteTauri 是一个游戏库管理器（技术栈见下方"技术栈约束"）。它并非复刻某个具体产品，
而是参考 Playnite 等同类工具的理念，并实现了大量自己的设计与特性。项目已包含：多名称、
拼音搜索、多语言、多主题、登录、公告、示例游戏、封面图库（CoverImages）、绿色存储、
自动构建等完整功能。完整设计见 `docs/`。

## 核心规则

### 新会话开始
- 阅读 `docs/README.md`（设计文档索引）与 `AGENTS.md`（本文件）
- 阅读 `docs/design/architecture.md` 了解架构
- 检查 `git status` 和项目结构

### 开发规范（严格遵循）
0. **使用 npm**：本项目用 npm，`npm install` / `npm run`
1. **先读再改**：修改前先读取文件理解上下文
2. **遵循既有模式**：沿用 `src/components`、`src/stores`、`commands/` 的现有模式
3. **架构一致性**：考虑性能、可维护性、可测试性
4. **批量操作**：一条回复内尽量并行多次工具调用
5. **代码风格**：匹配现有格式与模式
6. **构建加速**：修改后可用 `scripts/auto-build.mjs` 或 `build.ps1`，不要直接 `cargo build`
7. **质量门禁**：完成后运行 `npm run build`（前端 tsc + vite）和 `cargo check`（后端）
8. **不主动提交**：除非用户明确要求，否则不 commit / push
9. **文档同步**：数据模型 / 功能 / 目录变更后，必须更新 `docs/design/*.md` 和 `docs/CHANGELOG.md`
10. **删除文件**：用工具删除（`delete_file`），不留下残留
11. **优先使用已有成熟方案**：基础设施类（HTTP 服务器、协议、文件 IO、序列化、数据库、图片/视频等）
    和通用功能一律复用生态成熟 crate / 官方库，不要为局部需求手写底层实现。自研代码只负责把
    成熟方案接到本项目的模型与目录约定；采用后应在设计文档中写明候选对比与选择理由
    （见 `docs/CONTRIBUTING.md` 开发准则）。

### 技术栈约束
- Tauri v2 文档为准；Rust 用现代格式化 `format!("{var}")`
- **React 19（React Compiler）+ TypeScript 6 + Vite 8**（见 `package.json`）
- 状态管理：Zustand 5（UI 状态）+ TanStack Query 5（服务端状态）
- **UI 样式：纯手写 CSS**（`src/styles/global.css`，CSS 变量 + `[data-theme]` 多主题）
- 国际化：**i18next + react-i18next**（`src/i18n/config.ts`，字典在 `locales/*.json`，
  运行时语言 code：`en-US` / `zh-CN` / `zh-TW`，对应文件 `en.json` / `zh-CN.json` / `zh-TW.json`）
- `pinyin-pro` 做拼音搜索；`qrcode.react` 做登录二维码
- 注意：曾引入 shadcn/ui + Tailwind（因 Tailwind 4 preflight 冲突导致黑屏已全部移除，
  相关依赖也已彻底从 `package.json` 清除）。**不要新增 Tailwind 工具类、shadcn/Radix 组件
  或 sonner 等依赖**，UI 继续用 `global.css`（CSS 变量驱动多主题）。

## 关键架构模式

### 状态管理
```
useState (组件内) → Zustand (全局 UI 状态) → Tauri 命令 (持久数据，SQLite)
```
- 全局 UI 状态用 Zustand（`src/stores/`）
- 持久数据经 Tauri 命令（`src/api/client.ts`）读写，后端在 SQLite

### 前后端数据流
```
React → api/client.ts (invoke) → commands/*.rs → db.rs (SQLite)
```
- 前端不直接访问数据库
- 命令返回 Result，前端处理 ok/err

### 数据模型（多名称设计）
- `Game` 主名 `name` + `localizedNames`（语言标签名称）+ `alternateNames`（别名）
- 搜索纳所有名称变体 + 拼音首字母（见 `src/utils/search.ts`）
- 改字段需 `models.rs` ↔ `types/models.ts` 同步，加 `#[serde(default)]` 保证兼容

### 国际化（i18next）
- 所有 UI 文本用 `useI18n().t("key")`（`src/i18n/index.tsx` 的 `useSyncExternalStore` 封装，
  不直接依赖 react-i18next hook）
- 字典在 `locales/{en,zh-CN,zh-TW}.json`；新增 key 需同步三份 JSON
- 带占位符用 `t("key", { var })`
- 语言持久化：`App.tsx` 监听 `settings.language` → `setLang()` → `i18n.changeLanguage()`

### 主题
- CSS 变量驱动（`--accent`、`--bg-*` 等），默认 + `[data-theme]` 覆盖（多主题：卡通 / 赛博朋克 /
  孟菲斯 / 新拟态 / 美漫 / 吉卜力 / 中国风）
- 不硬编码颜色；新增主题在 `src/utils/theme.ts` + `global.css`

### 封面图库（CoverImages）
- `get_games` 时后端扫描 `CoverImages/` 目录，按"规范化文件名 ↔ 游戏中文名/多名称/别名/原名"
  自动匹配空封面（`covers.rs`，索引缓存）
- 本地图片经 `read_image` 命令返回字节，前端 `utils/assets.ts` 转 blob URL 并缓存

### 绿色存储
- 所有数据存 exe 目录（`settings.rs` 用 `current_exe()`）
- **应用设置（语言/主题/卡片等）存 `config.json`**（`config.rs` 读写，不存数据库）
- 游戏库/用户等业务数据存 SQLite（`library/library.db`）
- 不写注册表、不用 C 盘 / `%LOCALAPPDATA%`
- 构建产物不入库（见 `.gitignore`）

## 静态分析 / 质量
- 前端：`tsc`（`npm run build`）
- 后端：`cargo clippy`（可选）、`cargo check`
- 建议用 `check` skill 在完成功能后自查

## 文档结构
- `docs/design/*.md` — 各功能设计
- `docs/CHANGELOG.md` — 变更记录（每次功能变更追加）
- `docs/CONTRIBUTING.md` — 文档同步约定（每次修改必须遵循）
