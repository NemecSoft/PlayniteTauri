# PlayniteTauri 设计文档

本文档集中记录 PlayniteTauri 项目的**设计决策**与**实现规范**。每次功能修改或新增都必须同步更新本文档（见 [文档同步约定](./CONTRIBUTING.md)）。

## 文档索引

### 架构与总体设计
- [整体架构](./design/architecture.md) — 技术栈、模块划分、数据流
- [目录结构](./design/directory-structure.md) — 前后端目录职责

### 数据模型（Game 核心）
- [游戏数据模型](./design/data-models.md) — `Game` 结构、多名称设计、动作/元数据字段
- [多名称设计（localizedNames / alternateNames）](./design/data-models.md#多名称设计) — 改进原版 Playnite 单名称缺陷

### 搜索与索引
- [搜索系统（含拼音首字母）](./design/search.md) — 匹配范围、拼音首字母（`xjzb`）、缓存策略

### 用户界面
- [视图系统](./design/views.md) — 网格 / 列表 / 详情，分组与排序
- [主题系统（多主题即时切换）](./design/theming.md) — 卡通 / 赛博朋克 / 孟菲斯 / 新拟态 / 美漫 / 吉卜力 / 中国风
- [封面图库（CoverImages 自动匹配）](./design/covers.md) — 本地图片按中文名自动设置封面
- [修改器整合（Trainer / Mods）](./design/trainers.md) — 本地/在线修改器、管理员启动、导入
- [备份游戏存档（Backup Saves）](./design/backup-save.md) — 本地 + 多种云途径的存档备份/恢复
- [图文 / 视频攻略整合](./design/guides.md) — 章节化攻略、本地攻略库、内嵌视频
- [国际化（多语言）](./design/i18n.md) — 英语 / 简体中文 / 繁體中文
- [登录系统](./design/login.md) — 微信扫码 / 账号密码，可配置
- [公告页面（最近新增）](./design/news.md) — 最近新增游戏动态
- [示例游戏](./design/sample-data.md) — 首次启动播种的示例游戏

### 数据存储与分发
- [绿色（便携）存储](./design/green-storage.md) — 应用目录存储、不写注册表、不使用 C 盘

### 构建与工具链
- [构建加速](./design/build-acceleration.md) — release profile、sccache、增量编译
- [构建脚本](./design/build-script.md) — `build.ps1` 约定与使用

### 规范
- [文档同步约定](./CONTRIBUTING.md) — 每次修改后如何更新文档
- [变更记录](./CHANGELOG.md) — 按时间记录每次功能变更

### AI 开发规范
- [AGENTS.md](../AGENTS.md) — AI 助手开发规则（架构 / 数据模型 / i18n / 主题 / 绿色存储约定）
- `.codebuddy/skills/` — CodeBuddy 项目级 skill：`init` / `check` / `cleanup` / `change-package-manager`
