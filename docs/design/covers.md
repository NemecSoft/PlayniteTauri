# 封面图库（CoverImages 自动匹配）

## 目标

完全离线、用户可控的封面方案：用户在应用目录的 `CoverImages` 文件夹放入图片，图片**文件名**
与**游戏中文名**一致，应用自动将其匹配为该游戏的封面，无需联网、无需手动逐张设置。

## 使用方式

1. 在 `CoverImages` 目录放入封面图，文件名 = 游戏显示的中文名，例如：
   - `蔚蓝.png`
   - `巫师3：狂猎.png`
   - `艾尔登法环.jpg`
2. 启动应用或点击设置→外观→"重新扫描封面"，即可自动匹配。
3. 支持的格式：`png / jpg / jpeg / webp / gif / bmp`。

### 格式优先级（同名多格式）

同一游戏若放置了多种格式的封面，按如下优先级自动选择（**动画优先**）：

```
APNG > webp > gif > jpg/jpeg > png(静态) > bmp
```

- **APNG**（动画 PNG，扩展名仍为 `.png`）最高：`is_apng()` 读取文件头检测 `acTL` chunk 识别
- webp、gif 是动画/高压缩格式，次之
- jpg、静态 png 作为兜底
- 因此想用动画封面时，直接放入 `蔚蓝.gif` / `蔚蓝.webp`（或 APNG）即可，应用会自动优先采用，
  静态 jpg/png 不会覆盖它

示例：目录同时存在 `蔚蓝.png`、`蔚蓝.gif`、`蔚蓝.webp` 时，Celeste 会匹配到 `蔚蓝.webp`。

## 匹配规则（`src-tauri/src/covers.rs`）

### 候选名优先级
对每个游戏，按以下顺序取候选名，命中即返回：
1. **中文显示名**（`localized_names` 中 `zh-CN`，其次 `zh-TW`）
2. 其余语言的 `localized_names`
3. `alternate_names`（别名/俗称）
4. 原始主名 `name`（通常英文）

### 规范化（模糊但确定）
`normalize_name()` 将名字统一后再查索引：
- 大写 → 小写
- 全角字母/数字 → 半角（`Ａ→A`、`０→0`）
- 剔除空格、标点、括号、中英文分隔符（`（）、-_.:·&…`）
- 因此 `"巫师3：狂猎"`、`"巫师3-狂猎"` 归一后相同，可互相匹配

### 索引与效率
- `scan_cover_index()` 一次性扫描目录，建立 `HashMap<规范化文件名, 路径>`（O(1) 查找）
- **索引缓存**：`static INDEX_CACHE` 记录目录的 `mtime`，目录未变化时直接复用缓存，
  `get_games` 被高频调用也不会反复 `read_dir`
- 同名的多张图仅保留第一张（行为确定、更省内存）

### 覆盖策略
- 只填充 `cover_image` 为空的游戏；已有封面（含手动设置）**不会被覆盖**
- 匹配结果随 `get_games` 一并写入数据库并持久化

## 本地图片加载（`read_image` / `read_images_batch` 命令）

Tauri 2 的 `asset` 协议 + `convertFileSrc` 在 Windows 绿色版上对绝对路径的 glob 匹配
**不稳定**（不同 patch 版本行为差异），故改为走后端命令读取图片字节：

- **后端** `commands::covers`：
  - `read_image(path) -> { bytes, mime }`（单张，兼容旧调用）
  - `read_images_batch(paths) -> Vec<Option<{bytes, mime}>>`（**首选**，一次 IPC 读 N 张，顺序对应，`None` 表示路径非法/不存在）
  - 路径校验必须在 `CoverImages` 或 `library/images` 目录内（防御外部路径攻击）
  - 按扩展名推断 MIME（png/jpg/jpeg/gif/webp/bmp）
- **前端** `src/utils/assets.ts`：
  - `imageUrl(path)` **只**同步返回已缓存的 blob URL（未缓存返回 `undefined` 让视图显示占位符，**不**触发加载）
  - 模块级 LRU blob 缓存（上限 `BLOB_LRU_CAP`，超限 `URL.revokeObjectURL` 淘汰最久未用项）
  - `ensureImageLoaded(path)` 单张加载（并发上限 `SINGLE_CONCURRENCY`）
  - `preloadImages` / `preloadGameImages` 批量加载（每批 `BATCH_SIZE`，`BATCH_CONCURRENCY` 路并发）
  - `URL.createObjectURL(blob)` 生成的 blob URL 内嵌字节，浏览器内核直接渲染
- 所有视图（网格/列表/详情/最近新增/详情页）统一通过 `imageUrl()` 渲染封面/背景/截图
- 图片加载由 `useLazyImage` 的 IntersectionObserver 驱动（见下方"性能优化"）

## 命令

| 命令 | 作用 |
| --- | --- |
| `scan_covers` | 扫描图库、匹配并持久化所有空封面游戏，返回更新后的游戏列表 + 统计 |
| `get_cover_dir_info` | 返回 `CoverImages` 目录路径、是否存在、图片文件列表（供设置面板展示） |
| `read_image` | 读取单张图片字节 + MIME（单张调用） |
| `read_images_batch` | **一次 IPC 批量读取**多张图片字节 + MIME（推荐，性能优） |
| `clear_image_cache` | 清空后端进程级图片缓存（测试/重扫用） |

## 目录位置（绿色存储）

`CoverImages` 位于可执行文件同目录（`AppPaths::cover_images_dir()` = `config_root()/CoverImages`），
与数据库、插件等保持一致，完全便携。
