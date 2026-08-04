# 图片懒加载与 UI 性能优化

> 针对千级游戏库（1000+ 游戏、1362 张本地封面图）启动卡顿、滚动卡顿的专项优化。
> 目标：**图片逐渐显示、GUI 不卡顿**，效果接近优化良好的网页（懒加载 + 淡入）。

## 问题背景

本地图片通过后端 `read_image` 命令读取（不走 Tauri asset 协议，Windows 绿色版上 glob 匹配不稳定）。
在引入优化前，应用启动时会一次性调用 `preloadGameImages` 预加载**所有**本地图片路径，
即对 1362 张图发起 1362 次 IPC。每次 `read_image` 内部还有 `canonicalize × 2 + fs::read + 序列化 Vec<u8>`，
单张 ~50-200ms，合计可达 **2 分钟**，且 `read_image` 是同步命令会阻塞主线程 → 启动卡死、关闭公告也卡。

## 优化方案（三层）

### 1. 后端：批量读取 + 进程级图片缓存 + 后台 I/O

文件：`src-tauri/src/commands/covers.rs`

- **`read_images_batch(paths) -> Vec<Option<ImagePayload>>`**
  - 一次 IPC 读取最多 `BATCH_SIZE` 张（前端控制批大小），IPC 次数从 `游戏数` 降到 `游戏数 / 批大小`。
  - `Option` 语义：路径非法/不存在 → `None`，前端跳过，不中断整批。
- **进程级图片缓存**：`OnceLock<Mutex<HashMap<String, ImagePayload>>>`
  - key = 前端传入的原始路径（跨渲染稳定）
  - hit 直接返回内存克隆，零读盘；miss 才 canonicalize 校验 + 读盘。
  - 提供 `clear_image_cache()` 命令供清理。
- **后台线程 I/O**：`read_image` / `read_images_batch` 改为 `async` + `tauri::async_runtime::spawn_blocking`
  - 文件读取、路径校验全部在阻塞线程池执行，**主线程 / UI 线程永不被磁盘读取阻塞**。

### 2. 前端：移除全量预加载 + LRU blob 缓存 + 并发限制

文件：`src/utils/assets.ts`、`src/stores/gamesStore.ts`

- **`gamesStore.load()` 不再调用 `preloadGameImages`**：启动时不发任何图片 IPC，主界面秒开。
  图片改由视口驱动（见第 3 层）。
- **LRU blob URL 池**：`Map<path, {url}>`，上限 `BLOB_LRU_CAP`（约 220）。
  插入时按 Map 顺序淘汰最久未用项，并 `URL.revokeObjectURL` 释放内存，避免海量 blob 撑爆 WebView。
- **单图并发限制**：`SINGLE_CONCURRENCY`（=3）信号量，防止网格挂载时图片 IPC 洪峰。
- **批量并发控制**：`preloadImages` 每批 `BATCH_SIZE`（=24）、`BATCH_CONCURRENCY`（=2）路并发，
  仍保留给需要显式批量加载的场景。
- **`imageUrl()` 纯同步**：只返回缓存 blob URL 或 `undefined`，**不主动发起加载**（加载完全交给 IntersectionObserver），
  保证网格 1270 个卡片同时渲染时不会触发任何 IPC。

### 3. 前端：IntersectionObserver 渐进懒加载 + 空闲调度 + 淡入

文件：`src/hooks/useLazyImage.ts`、`src/components/views/GridView.tsx`、`src/styles/global.css`

- **`useLazyImage` hook**：
  - IntersectionObserver 观察每张卡片的 `.cover`，`rootMargin: 600px` → 图片在**进入视口前 600px 就预加载**，滚动时逐张出现。
  - 触发后经 `requestIdleCallback`（`timeout: 1500`）延迟到浏览器**空闲时**才发 IPC，绝不和滚动/布局抢主线程。
  - 字节就绪后用 `useReducer` `force()` 强制重渲染，让 `<img>` 拿到 blob URL 并淡入。
- **GridView**：抽 `GridCard` 子组件，`.cover` 绑定 `useLazyImage` 的 ref；`<img>` 加 `loading="lazy"` + `decoding="async"`。
- **淡入动画**：`.grid-card .cover img` 加 `animation: cover-fade-in 0.35s ease`（透明 → 不透明），
  图片"逐渐显示"、无闪烁弹入，观感流畅。

## 加载流程（最终）

```
应用启动
  └─ gamesStore.load()：仅 get_games（数据库），不预加载图片 → 主界面秒出
  └─ GridView 渲染 1270 张卡片 → 每张显示 placeholder（图标）
  └─ 用户滚动：IntersectionObserver 命中视口前 600px 的卡片
       └─ requestIdleCallback → ensureImageLoaded(path) → read_image（并发≤3）
       └─ Rust spawn_blocking 读盘 → 进程级缓存 → 返回 bytes
       └─ 前端 createObjectURL → 写入 LRU blob 缓存 → force() 重渲染 → img 淡入
  └─ 已加载图片再次进入视口：直接命中 blob 缓存，零 IPC、零读盘
```

## 关键调优点

| 参数 | 位置 | 建议值 | 说明 |
| --- | --- | --- | --- |
| `SINGLE_CONCURRENCY` | `assets.ts` | 3 | 单图并发，越小越渐进、IPC 压力越小 |
| `BATCH_SIZE` | `assets.ts` | 24 | 批量 IPC 每批张数 |
| `BATCH_CONCURRENCY` | `assets.ts` | 2 | 批量并发路数 |
| `BLOB_LRU_CAP` | `assets.ts` | 220 | 前端 blob URL 池上限（超限淘汰） |
| `rootMargin` | `useLazyImage.ts` | `600px` | 进入视口前预加载距离，越大越提前加载 |
| `timeout` | `useLazyImage.ts` | 1500ms | requestIdleCallback 空闲超时 |

## 效果

- 启动：**秒开**（无图片 IPC 阻塞）
- 滚动：图片**逐张淡入**，GUI 不卡顿
- 内存：blob LRU + Rust 缓存共同限制，海量图片不撑爆 WebView
- 复用：同一图片二次进入视口零成本（双缓存命中）

## 相关文件

- `src-tauri/src/commands/covers.rs` — 批量读取、进程缓存、spawn_blocking
- `src/utils/assets.ts` — LRU blob 缓存、并发控制、imageUrl
- `src/hooks/useLazyImage.ts` — IntersectionObserver + requestIdleCallback
- `src/components/views/GridView.tsx` — GridCard + 懒加载 ref
- `src/stores/gamesStore.ts` — 移除启动全量预加载
- `src/styles/global.css` — 图片淡入动画
