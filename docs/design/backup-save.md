# 备份游戏存档（Backup Saves）整合设计

## 目标

为每款游戏提供**存档文件**的备份与管理，覆盖两类存储：
1. **本地存档**：把存档快照备份到应用目录（离线、完全可控），防止进度丢失，可随时恢复。
2. **云存档**：通过**多种云途径**把存档备份到云端（多端同步、防本机损坏/丢失），
   支持不同的云服务作为"途径"。

## 现状与关键区分

- `AppSettings.auto_backup_enabled` **已存在**，但它备份的是**游戏库数据库**（`library.db`），
  属于"元数据备份"，**不是**这里讨论的**游戏存档（save file）备份**。两者互不冲突、可并存。

## 数据模型扩展

在 `Game` 上新增存档备份配置：

```rust
/// Save-file backup configuration for a game.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupConfig {
    /// Whether save backup is enabled for this game.
    #[serde(default)]
    pub enabled: bool,
    /// One or more source paths/folders where the game stores its saves.
    /// Supports env vars & glob patterns (e.g. "%USERPROFILE%\\Documents\\My Games\\*.sav").
    #[serde(default)]
    pub paths: Vec<String>,
    /// Trigger: "on_exit" | "on_launch" | "manual" | "timer".
    #[serde(default)]
    pub trigger: String,
    /// When trigger == "timer": interval in minutes.
    #[serde(default)]
    pub interval_minutes: u32,
    /// Max number of rotating LOCAL backups to keep (default 10).
    #[serde(default = "default_save_max_backups")]
    pub max_backups: u32,
    /// Cloud backup targets (0..n cloud destinations).
    #[serde(default)]
    pub cloud: Vec<CloudBackupTarget>,
}

fn default_save_max_backups() -> u32 { 10 }

/// A cloud destination for this game's save backups.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupTarget {
    /// Which cloud backend: "local_dir" | "webdav" | "sftp" | "onedrive" | "googledrive" | "nproxy".
    pub backend: String,
    /// Display label chosen by the user, e.g. "坚果云", "我的 NAS".
    pub label: String,
    /// Backend-specific endpoint (WebDAV base URL, SFTP host, local folder path...).
    pub endpoint: String,
    /// Remote folder path to upload into (e.g. "/PlayniteSaves/<gameId>").
    pub remote_dir: String,
    /// Credentials are NOT stored here; they are kept in the OS keyring (see Security).
    #[serde(default)]
    pub credential_key: Option<String>,
}

// In Game:
#[serde(default)]
pub save_backup: Option<SaveBackupConfig>,
```

> `Option` 表示未配置的游戏为 `None`；`#[serde(default)]` 保证向后兼容，无需迁移。

## 目录约定（本地，绿色存储）

```
release/
├─ save_backups/
│  ├─ <gameId>/
│  │  ├─ 2026-02-10-14-30-00.zip   ← 时间戳命名的本地快照
│  │  ├─ 2026-02-09-10-00-00.zip
│  │  └─ ...
│  └─ ...
```

- `AppPaths::save_backups_dir()` = `config_root()/save_backups/<gameId>/`
- 本地快照压缩为 `.zip`，文件名 = 时间戳
- **滚动保留**：超过 `max_backups` 删除最旧

## 云存档途径

"云存档"是一组可插拔的**后端适配器**，统一"上传/下载/列举"接口，用户可在设置里配置多个云端目标。

| backend | 说明 | 典型用途 |
| --- | --- | --- |
| `local_dir` | 同步到另一个本地/网络磁盘目录（NAS 挂载盘、移动硬盘） | 离线异地备份 |
| `webdav` | WebDAV 协议（坚果云、Nextcloud、OwnCloud、群晖 WebDAV） | 国内常用网盘 |
| `sftp` | SFTP 协议（自建服务器 / NAS） | 自托管 |
| `onedrive` | Microsoft OneDrive 官方 API | Windows 用户云盘 |
| `googledrive` | Google Drive 官方 API | 多平台 |
| `nproxy` | 预留扩展点：任意自定义云插件（对接 BiliDrive / 阿里云盘等） | 按需接入 |

### 云同步策略

- **上传**：每次生成本地快照后，按 `cloud` 列表逐个上传（可配置"仅手动"或"自动上传"）
- **下载/恢复**：从指定云端拉取快照到本地 `save_backups/` 临时区，再解压回源路径
- **列举**：列出云端已上传的快照（时间戳 + 大小），与本地快照并列展示
- **去重/增量**（可选）：对大存档用增量上传（哈希比对），节省流量

## 后端命令

| 命令 | 作用 |
| --- | --- |
| `get_save_backup_config(game_id)` | 读取该游戏存档备份配置 |
| `set_save_backup_config(game_id, cfg)` | 保存配置（路径/触发/保留数/云目标） |
| `backup_saves_now(game_id)` | 手动立即备份一次（本地 + 按策略上传云），返回结果 |
| `list_save_backups(game_id)` | 列出本地 + 各云端的历史快照 |
| `restore_save_backup(game_id, ref)` | 恢复（先临时备份当前存档），`ref` 指向本地或云端快照 |
| `delete_save_backup(game_id, ref)` | 删除本地或云端指定快照 |
| `test_save_path(game_id, path)` | 校验本地存档路径有效性 |
| `test_cloud_target(target)` | 校验云端连接（凭据/连通性） |
| `list_cloud_backends()` | 返回支持的云途径列表及是否需要凭据 |

### 触发时机

- **启动时** / **退出时**（进程钩子，复用 `process.rs`）/ **定时** / **手动**
- 每次触发同时执行：本地快照 →（若开启）云上传

## 前端 UI

### 详情页新增 "存档备份" 分区

- **状态卡片**：是否启用、触发方式、保留数量、最近一次本地/云备份时间
- **切换开关**：启用/禁用该游戏存档备份
- **路径管理**：展示存档源路径，可增删；"测试路径"即时校验
- **立即备份**按钮：手动触发，显示结果（文件数、压缩后大小、云上传结果）
- **历史快照列表**：分"本地"与各"云端"分组，提供"恢复"/"删除"（恢复前二次确认）
- **云目标管理**：可添加/编辑/删除云端目标（选择后端、填 endpoint、授权凭据）

### 设置页（`Settings` → 通用）

- 全局存档备份目录展示（`save_backups/`）
- 默认触发方式 / 默认保留数量 / 默认云上传策略
- 全局云凭据管理（在系统钥匙串中保存，见安全）
- 说明该功能与"自动游戏库备份"（`auto_backup_enabled`）是**两套独立备份**

## 安全与可靠性

1. **恢复前自保护**：恢复时先把当前存档临时备份，避免覆盖导致二次损坏。
2. **滚动保留**：默认 10 份，防磁盘膨胀。
3. **路径白名单**：只允许备份已配置且存在于 `paths` 内的文件，后端校验路径，防止误删/越权。
4. **凭据不进数据库/日志**：云凭据（密码/Token）存入 **OS 钥匙串**（Windows Credential Manager /
   macOS Keychain），DB 仅存 `credential_key` 引用；不上传、不落盘明文。
5. **完全离线可用**：本地备份不依赖网络；云备份失败不影响本地快照，且有失败重试与提示。
