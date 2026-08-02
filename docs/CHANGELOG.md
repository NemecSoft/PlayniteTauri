# 变更记录

本文件按时间记录每次功能变更。格式：`日期 - 变更内容（相关文档）`。

---

## 2026-08-03

- **i18n 迁移到 i18next**：将自研轻量 i18n（React Context）迁移为 **i18next + react-i18next**，
  与 tauri-template 对齐。字典由 TS 转为 `locales/*.json`（三语 en-US / zh-CN / zh-TW），
  保留兼容的 `useI18n()` 门面（底层为 i18next），现有组件无需改动。
  （[architecture](./design/architecture.md)、[i18n](./design/i18n.md)）

- **技术栈升级**：React 18 → 19（启用 React Compiler）、Vite 5 → 8、TypeScript 5 → 6、
  Zustand 4 → 5，并引入 Tailwind CSS 4 + shadcn/ui（Radix + CVA + tailwind-merge）与
  TanStack Query 5。前端现有功能在新技术栈下编译运行正常。
  （[architecture](./design/architecture.md)）

## 2026-08-03

- **引入 AI 开发规范（CodeBuddy skills + AGENTS.md）**：借鉴 `tauri-template` 的工程体系，
  改造成适配 PlayniteTauri 的 CodeBuddy 项目级 skill（`.codebuddy/skills/`）：
  `init`（上手）、`check`（质量检查）、`cleanup`（清理）、`change-package-manager`（切包管理）。
  并新增 `AGENTS.md`（AI 助手开发规则，涵盖架构/数据模型/i18n/主题/绿色存储约定）。
  （[docs/README](./README.md)）

## 2026-08-03

- **任务栏图标去重（根治）**：任务栏出现两个图标的**真正根因**是 `tauri.conf.json` 的
  `app.trayIcon` 配置（Tauri 自动创建托盘）与 Rust 代码 `setup_tray`（手动创建托盘）**重复创建**
  了两个系统托盘图标。移除 `tauri.conf.json` 的 `trayIcon` 配置，只保留代码 `setup_tray`
  （带完整菜单与事件），即 Tauri 推荐做法——**只保留一种托盘创建方式**。
  （[green-storage](./design/green-storage.md)）

## 2026-08-03

- **自动构建**：新增 `scripts/auto-build.mjs` 监听脚本 + `auto-build.bat` 双击启动。
  源码变化后自动防抖触发完整构建并更新绿色 exe，无需手动运行。
  （[build-script](./design/build-script.md)）

## 2026-08-03

- **示例游戏**：首次启动且库为空时播种 7 款示例游戏（GTA V / 星际争霸II / 赛博朋克2077 /
  巫师3 / 艾尔登法环 / 蔚蓝 / 哈迪斯），含多名称与 URL 启动动作，便于体验搜索与视图。
  （[sample-data](./design/sample-data.md)）
- **登录系统**：启动可显示登录界面，支持微信扫码（qrcode.react）与账号密码两种方式，
  可配置是否启用、选择方式，登录状态持久化。（[login](./design/login.md)）
- **公告页面（最近新增）**：侧边栏新增"最近新增"入口，按加入时间倒序展示新增游戏动态。
  （[news](./design/news.md)）

## 2026-08-03

- **编译加速**：release profile 改为 thin-LTO + 16 codegen-units + incremental，
  依赖 opt-level=2；引入 sccache 编译缓存；`build.ps1` 自动启用并显示耗时。
  增量编译从 3 分钟+ 降至 ~49 秒。（[build-acceleration](./design/build-acceleration.md)、[build-script](./design/build-script.md)）

## 2026-08-03

- **拼音首字母搜索**：引入 `pinyin-pro`，为每个游戏构建含名称变体 + 中文首字母 + 全拼 + 元数据的
  搜索索引。输入 `xjzb` 可搜到"星际争霸"。（[search](./design/search.md)）

## 2026-08-03

- **多名称支持**：`Game` 新增 `localized_names`（带语言标签的本地化名称，如 zh-CN/zh-TW/ja/ko）
  与 `alternate_names`（无语言标注的别名/俗称，如"三男一狗""车枪大战"），改进原版 Playnite
  单名称缺陷。编辑弹窗支持录入多名称。（[data-models](./design/data-models.md)）

## 2026-08-02 ~ 2026-08-03

- **设计文档体系建立**：新增 `docs/`，含架构、数据模型、搜索、视图、主题、i18n、绿色存储、
  构建加速、构建脚本等设计文档 + 文档同步约定 + 变更记录。
  （[docs/README](./README.md)、[CONTRIBUTING](./CONTRIBUTING.md)）

## 2026-08-02

- **绿色（便携）存储**：所有数据（数据库/图片/缓存/插件）改存应用当前目录，
  不写注册表、不使用 C 盘。移除会访问 `%LOCALAPPDATA%` 的 `tauri-plugin-store`。
  窗口回退到 config 自动创建以保证前端资源加载。（[green-storage](./design/green-storage.md)）

## 2026-08-02

- **多语言**：英语 / 简体中文 / 繁體中文，切换即时生效并持久化。
  自研轻量 i18n（React Context + 三语字典）。（[i18n](./design/i18n.md)）

## 2026-08-02

- **双主题**：卡通风格 / 赛博朋克风格，CSS 变量驱动，切换即时应用并持久化。
  （[theming](./design/theming.md)）

## 2026-08-02

- **移除模拟器**：删除模拟器相关后端模块、命令、前端 UI 与数据模型。
  `GameAction` 类型仅保留 `File` / `URL`。

## 2026-08-02（项目初期）

- **项目骨架建立**：Tauri v2 + React + TypeScript + Vite + Zustand + SQLite。
  实现游戏库管理、导入（目录/Steam）、三种视图、筛选搜索、启动游戏、插件系统、
  设置界面、系统托盘。（[architecture](./design/architecture.md)）
