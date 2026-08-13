# 变更记录

## 2026-08-14

- **棋盘视图：用 R3F 移植《中国象棋 3D》场景氛围**：
  - 确认架构是 **@react-three/fiber（R3F）**，参考文件是原生 three.js；本项目保持
    R3F 声明式写法。
  - 用 R3F 移植参考文件的关键场景氛围：
    - `<Sky>`（drei 程序化天空：夕阳低角度 sunPosition、暖色大气散射）
    - `<fog>`（远处大雾，参考文件的远山雾效）
    - 灯光改"夕阳"：暖橙主光 `#ffd0a0` + 冷色补光 `#7fb0d8` + 半球天光，
      阴影 mapSize 2048 更细腻
    - 背景色 `#87CEEB`（天蓝）
  - 保留 16:9 封面立牌 + 棋盘 + 恐怖谷入口。

- **星球视图 → 3D 棋盘视图（参考中国象棋 3D）**：
  - 把原来的"星球"视图改为 **3D 棋盘视图**：一个仿中国象棋的大型棋盘地面
    （木底座 + 描金边 + 米黄格线盘面），游戏以 **16:9 封面立牌**的方式竖立在
    棋盘格子上（像一排排卡牌）。
  - 参考 `参考/中国象棋3D.html` 的 3D 搭建技术：OrbitControls 相机（拖拽旋转 /
    滚轮缩放 / 自转）、Directional + Hemisphere 灯光、Canvas 程序化棋盘纹理。
  - **16:9 封面**：每个游戏是 1.78×1 的平面立牌，正面贴游戏封面（懒加载，
    避免 1000+ 游戏一次打满 IPC）；底部半透明底座托住，像棋子底座。
  - **扩大场景**：棋盘 26 列 × 14 行 ≈ 364 格，相机视野拉远（fov 50、距离 34），
    能容纳上千游戏，OrbitControls 可缩放查看。
  - **交互**：hover 封面放大 + 上浮 + 显示游戏名（金色描边文字）；点击进游戏详情；
    恐怖谷分区（红色底座）点击进恐怖谷地图（复用原星球入口）。
  - 新增 `src/components/board/`：`BoardScene.tsx`（场景根）、`BoardGround.tsx`
    （棋盘地面）、`CoverTile.tsx`（16:9 封面立牌）。
  - `PlanetView.tsx` 改为渲染 BoardScene（保留懒加载 + WebGL 降级 + 恐怖谷入口）。

## 2026-08-14

- **应用启动即最大化窗口（不再正常启动）**：
  - `apps/desktop/tauri.conf.json` 主窗口加 `"maximized": true`——Tauri 创建窗口时
    即最大化，无闪烁。
  - 这是**窗口级属性**，与设置里的 `startupBehavior`（应用内行为）独立，强制客户端
    启动即最大化。
  - admin 端暂不改（用户只要求客户端）。

## 2026-08-13

- **新增"钻石版"渐变配色（`p-diamond`，特别版分类）**：
  - 背景是 **青 → 紫蓝 → 紫粉 → 粉** 的斜向渐变（`linear-gradient(135deg, ...)`），
    与一般"单色顶底渐变"的 palette 区分。
  - 通过 `body.theme-diamond`（class 选择器）在 global.css 覆盖默认 body 渐变；
    主内容区 `.main-area` 在该主题下用 `background: transparent`，让卡片在彩色渐变上更突出。
  - 配套加了 themeId 持久化：ThemesSection 切换时 `document.body.classList.toggle("theme-diamond", p.id === "p-diamond")`，
    `restoreLibraryTheme` 启动恢复时也按 id 同步该 class，重启后钻石版背景能正确生效。
  - 图标用 lucide-react `Gem`（宝石）。
  - 选 class 选择器而非 `[data-theme-id]` 属性选择器：更稳、避免某些 PostCSS 工具处理属性选择器时的兼容性问题。

- **新增"古地图"配色（`p-ancient-map`，特别版分类）**：
  - 羊皮纸沙色 + 棕橙 + 深棕文字，像考古地图集/探险日志
  - 主色 `#8B5A2B`（深棕）、背景 `#E8D9B8`（米沙）、边框 `#A0522D`（红棕）、
    文字 `#3A2A14`（深棕黑）
  - 图标用 lucide-react `Map`（地图）
  - 区别于"中国红/蓝/绿/水墨"：更偏探险+考古+沙漠的"全球地理"风格，温暖复古

- **"正在启动"横幅：至少保留 3 秒（修复一闪而过）**：
  - 启动流程可能几百毫秒就完成，之前启动结束立即清除横幅 → "一闪而过看不清"。
  - `gamesStore` 增加模块级定时器 + `launchingStartedAt`：`setLaunching` 记录开始
    时刻；`clearLaunching` 计算已过去时间，**延迟到"开始后至少 3 秒"**再真正清除
    （不足 3 秒则补足剩余时间，超出则立即清）。
  - 多次快速启动会先清掉上一个定时器，避免叠加出多个定时器互相干扰。

- **渐变配色改"平滑过渡"（修硬切分界）**：
  - 5 套新渐变 palette（雾蓝浅灰/墨黑墨紫/赭红深棕/桃粉墨绿/苔绿姜黄）原本用
    `linear-gradient(90deg, A 0% A 50% B 50% B 100%)` 实现 50/50 硬切——中间
    明显分界，用户反馈"完全左右分开，中间太分明"。
  - 改为 4 段平滑斜向渐变 `linear-gradient(135deg, A 0% 中间色1 35% 中间色2 65% B 100%)`——
    从左上到右下平滑过渡，没有硬分界。
  - 同时把 `body` 和 `.app-body` 的默认渐变从 180deg 顶底改为 **135deg 斜向**
    （"左上亮 → 右下主色"），所有 palette 默认就柔和，没有顶/底分界感。

- **新增 5 套"双色硬切"渐变配色（特别版）**：
  - 来源：用户 5 张色卡（每张两色硬切 50/50）：雾蓝/浅灰、墨黑/墨紫、赭红/深棕、
    桃粉/墨绿、苔绿/姜黄
  - palette id：`p-grad-mist-blue` / `p-grad-ink-purple` / `p-grad-vermilion` /
    `p-grad-pink-green` / `p-grad-moss-yellow`
  - 用属性选择器机制：`ThemeEntry` 加 `gradientClass?: string` 字段；5 个新 palette
    都设 `gradientClass: "theme-diamond"`，CSS 用 `body.theme-diamond[data-theme-id="p-grad-xxx"]`
    分发不同渐变色（避免给每个 palette 各加一个 class）
  - 渐变用 `linear-gradient(90deg, A 0% A 50% B 50% B 100%)` 实现横向 50/50 硬切，
    与原色卡一致（左半色 A + 右半色 B）
  - ThemesSection / main.tsx 的 restore 逻辑同步处理 gradientClass，
    重启后渐变背景能正确恢复

- **新增"正在启动游戏"醒目横幅反馈**：
  - 用户点"开始游戏"后，游戏启动流程（跑前置脚本 + spawn 进程）可能耗时几百毫秒
    到几秒。之前这段时间前端**没有任何反馈**，用户会以为"点了没反应"。
  - 现在 `gamesStore` 增加 `launchingGame` 状态；`launchGame` 在启动开始时设置、
    启动结束（成功/失败）后清除。
  - 新增 `LaunchingBanner` 组件（挂载在 App 根）：启动过程中在**屏幕顶部中央**
    显示醒目的"正在启动《游戏名》…"，带旋转加载图标 + 强调色渐变底 + 高 z-index；
    启动完成自动消失。
  - 用 framer-motion 的 AnimatePresence 做淡入/滑出过渡。

- **新增两套"醒目版"游戏主题配色**：
  - **魔兽世界·醒目史诗版（`p-wow-epic`）**：暖色高对比、古铜+金迸发。
    主背景 `#120E0A`、正文 `#FFF3E0`、任务金 `#FFD866`、高亮边框 `#C8A86A`、
    危险亮红 `#F05040`。图标 `Swords`。
  - **英雄联盟·醒目科技版（`p-lol-neon`）**：冷色高对比、冰蓝+纯白。
    主背景 `#05080D`、正文纯白 `#FFFFFF`、电光蓝 `#40A0FF`（法力）、翠绿
    `#30D080`（血量）、亮金 `#FFD850`（金币）、危险 `#FF4A4A`。图标 `Gamepad2`。
  - 色值全部来自用户给定表，按 palette-tuning skill 映射到 token 命名
    （`success`/`accent`/`warning`/`danger` 语义落位），并补全其余 UI token。
  - 决策与映射记录在 `docs/design/theme-system.md`。

- **设置弹窗：去掉"登录 / 游戏库 / 插件"3 个 tab**：
  - 用户反馈这三个 tab 功能未实现，UI 只是占位，先从侧栏移除。
  - 保留 `LoginSection.tsx` / `LibrarySection.tsx` / `PluginsSection.tsx` 文件
    在仓库里（不删），以备以后启用时复用；顶部注释说明如何重新启用。
  - `SettingsModal.tsx`：从 `SectionId` 类型删 3 个值、从 `SECTIONS` 删 3 项、
    从 `sectionContent` 删 3 个 case、清理不再用的 icon import
    （`Database` / `Plug` / `Lock`）。

- **修复"设置 → 外观"页 4 个英文 key**：
  - 缺失的 4 个 i18n key（`settings_cardSize` / `settings_cardGap` /
    `settings_coverLibrary` / `settings_coverRescan`）在三份语言文件里**完全不存在**，
    导致界面显示英文 key 字面量。
  - 三份文件（zh-CN / en / zh-TW）补全这 4 个 key：
    - 卡片宽度 / 卡片间距 / 封面图库 / 重新扫描封面
  - `AppearanceSection.tsx` 给 4 个 t() 调用加 `{ defaultValue: "中文回退" }`
    兜底（i18next 26+ API），跟之前 GeneralSection 一样防止后续再漏 key。

- **修复"设置 → 通用"页面下拉/复选框显示英文 key**：
  - `settings_trackPlaytime` 在三份语言文件（zh-CN / en / zh-TW）里**完全缺失**，
    导致复选框 label 显示 "settings_trackPlaytime"（key 字面量）。已补全中文
    "启用游戏时间追踪" / English / 繁體中文。
  - 给 GeneralSection 里所有 i18n 调用加 `{ defaultValue: "中文回退" }` 兜底
    （i18next 26+ 支持），万一 key 缺失显示中文而不显示英文 key。
  - 改动的 4 个 key：`settings_startNormal` / `settings_startMinimized` /
    `settings_startMinimizedTray` / `settings_trackPlaytime`（复选框）。

- **用 palette-tuning skill 优化"山水蓝"和"中国红/朱金"两个配色**：
  - **山水蓝（浅水蓝底）**：修复"浅底上文字对比度不足"——`textDim` 由浅水蓝
    `#A8C6DC` 改为深水蓝 `#3A6284`（对比 1.9:1 → ≈4:1）；`textPrimary` 加深到
    `#0F2940`（≈5:1）；`muted` 与 `secondary` 区分、`border` 稍深。
  - **中国红/朱金（朱红底）**：修复"暗金文字对比不足"——`textDim` 由 `#A48B5A`
    提亮到 `#D6B26A`（对比 2.7:1 → ≈3.5:1）；`muted` 与 `secondary` 区分。
  - 全程遵循 palette-tuning skill 的检查清单（对比度≥4.5:1、背景层次在主色家族内、
    不破坏已确认的视觉）；决策与色值表同步 `docs/design/theme-system.md`。

- **新增项目级 skill `palette-tuning`**（`.codebuddy/skills/palette-tuning/SKILL.md`）：
  - 专门调节 PlayniteTauri 配色（添加/调整/重命名/对比度检查/渐变背景）时使用
  - 内容覆盖：核心文件清单（themeLibrary.ts / themeApply.ts / global.css / ThemesSection.tsx）、
    添加新 palette 的标准流程、必填字段、icon 映射 key bug 教训、命名约束、
    调色前检查清单（对比度/背景层次/稀缺感）、反模式、调试技巧
  - 描述里包含 "添加主题/palette/调整配色/改图标" 等关键词时会自动加载

- **主背景改为渐变色（不再是纯色）**：
  - `body` 和 `.main-area`（主内容区）背景从 `var(--bg-base)` 纯色改为
    `linear-gradient(180deg, var(--bg-top), var(--bg-base))` 渐变。
  - **渐变两端自动取自当前配色**的 `--bg-top`（通常比主色亮一档）和 `--bg-base`
    （主色）——所以**所有 palette 都自动获得"顶部亮 → 底部主色"的柔和渐变**，
    无需逐个改色值。
  - 加了 `background-attachment: fixed`，滚动内容时渐变保持固定、不跟随滚动。
  - 例如"山水蓝"配色：顶部 `#79A9CB`（亮水蓝）→ 底部 `#6FA3C7`（主水蓝），
    像湖面由近及远的蓝色渐变。

- **新增"山水蓝"配色（`p-cn-blue-mountain`）+ 修配色图标 key bug**：
  - **新增 palette**：名为"**山水蓝**"，**背景是水的蓝色**（`#6FA3C7` 清透水蓝，
    像湖泊/江水），不是米白留白。文字用深蓝 `#16324A`，主色/强调用更深的水蓝
    `#2E5E7E`，视觉如水墨山水画（蓝山蓝水）。
    区别于现有的"中国蓝"（深海军蓝底）和"中国水墨"（灰黑墨色）。
  - **修 bug**：`paletteIconMap` 的 key 一直用 `"chinese-red"` 等短串，但
    `themeLibrary.ts` 里实际 id 是 `"p-cn-red"`——**所有配色图标一直走 `Palette`
    兜底**。已修正为真实 id（`p-light` / `p-dark` / `p-cn-red` / `p-cn-blue` /
    `p-cn-green` / `p-cn-ink` / `p-cn-blue-mountain`），现在每种配色都会显示专属
    图标（太阳/月亮/火焰/水滴/绿叶/毛笔/山峦）。
  - 新图标用 `Mountain`（lucide-react 山峦）配"蓝山水"。

- **中国红配色改为"朱金"主题（Vermilion + Gold）**：
  - 按 ui-ux-pro-max skill 流程做配色：先列 4 个候选（米白底+红/红底+米白/红底+亮金/红底+冰蓝），
    选定 **C. 朱金**——用户指定的 `#9D2933` 朱红做底 + 亮金 `#F0D58A` 做主文字 +
    纯金 `#E5B04B` 做强调/描边，致敬紫禁城朱红墙 + 鎏金匾额。
  - **关键设计原则**：金色只用于文字/强调/描边/焦点环（稀缺感 = 高级感）；
    背景层次全部在朱红家族内做 5-8% 亮度差，不引入其他色相。
  - **对比度**：亮金 vs 朱红 ≈ 5.2:1（AA 合规）；次要文字 ≈ 4.6:1。
  - 新增 `docs/design/theme-system.md` 记录候选方案、调色表、设计原则。
  - `docs/README.md` 加索引链接。

- **设置弹窗"主题"标签页：风格 / 配色 列表对齐样式 + 加标志图标**：
  - **风格（Style）区**：原为胶囊按钮组（只显示 `s.zh` 一个名），改为与配色
    一致的"行项"形式：每行一个 lucide-react **标志图标** + 中文名 + 英文名 +
    选中勾。图标按风格 id 映射，区分度强（苹果=Sparkles 灵动、毛玻璃=Layers
    层叠、赛博=Zap 电流、像素=Grid3x3、粗野=Box、蒸汽波=Radio 等）。
  - **配色（Palette）区**：原已显示色卡+中英名，**新增一个标志图标**
    （明亮=Sun、暗黑=Moon、中国红=Flame、中国蓝=Droplet、中国绿=Leaf、水墨=Brush）。
  - **未匹配兜底**：未来新增风格/配色时，库内没显式映射 → 统一用 `Palette`
    图标兜底，保证"始终有图标"的设计一致性，不会因为没填映射就显示空白。
  - 顺手给所有可点击行加了 `onKeyDown` 支持键盘 Enter/Space 选择（无障碍 + 跨设备一致）。

- **修复"启动时先闪英文再切中文"**：
  - **根因**：i18n config 硬编码默认 `lng: "en-US"`，settings 一开始是 DEFAULT
    （`en-US`）。React 第一次渲染时 i18n 用 en-US 渲染，settings 异步加载完
    （zh-CN）才 `changeLanguage` 切到中文——中间那一帧就是英文闪烁。
  - **治本**：在 `main.tsx` 渲染 React 之前，**同步 await 后端拿 settings**，
    立刻用该语言 `i18n.changeLanguage()`（资源已加载，changeLanguage 同步），
    并把 settings 预注入到 `useSettingsStore`。React 第一次渲染时 i18n 已经是
    正确语言。
  - **保险**：`settingsStore.load()` 检查 `loaded` 标志，已注入则不再 invoke，
    避免覆盖预加载值引发二次闪烁。
  - **兜底**：invoke 失败/超时（1.5s）时用 `zh-CN` fallback 渲染，绝不闪英文。
  - **顺带**：补全 `status_unknownCafe` 三语翻译（之前完全缺失，状态栏显示
    key 字面量"status_unknownCafe"），现在显示"未连接 C-afe"。

- **新增"详情页游戏运行状态监控"（后台服务式）**：
  - 进入任意游戏详情页，顶部（返回按钮所在行）显示运行状态：
    - `运行中 00:12:34`（实时计时）
    - `游戏已退出 · 最近共运行 00:12:34`
    - `游戏未运行`
  - 支持"点开始游戏自动跳转进来"和"手动点详情进来"两种入口，都实时监控。
  - **后台服务式**：后端在启动游戏时保存子进程句柄并启动监控线程，每 2 秒
    `try_wait()` 检测进程退出；进程退出时把"本次运行时长 / 退出时间"写回数据库
    （`game.last_session_seconds`、`last_session_ended_at`），并累加 `playtime`。
    所以用户点返回再点详情进来，重新拉一次 `get_run_state` 就能从数据库读到准确
    时长，不会丢。
  - 新增命令 `get_run_state(game_id)`，返回 `{ state: running|stopped|never,
    elapsedSec, lastSessionSec }`。
  - 前端 `GameDetailPage` 用 `useRunState` hook 每 1 秒轮询 + 本地秒表平滑计时。
  - 结构改动：`AppState.db` 从 `Mutex<Database>` 改为 `Arc<Mutex<Database>>`（供
    监控线程 clone 写库）；`ProcessManager` 实现 `Clone`（内部全 Arc）；`launch`
    现在返回 `Child` 供句柄登记。

- **明确"启动游戏后跳转详情页"为固定行为（不做可选项）**：
  - 用户点"开始游戏"成功拉起游戏后，客户端**统一跳转到该游戏详情页**（`/game/:id`），
    方便用户边玩边看 `Game_Details/` 下的攻略图文 + `videos/` 视频教程。
  - **固定，不提供** Playnite 式的"窗口保持 / 最小化到托盘 / 关闭窗口"可选设置。
  - **不改窗口状态**：启动后不得调用 `maximize_window`/`minimize_window`/`hide_window`。
    历史教训：曾调用 `api.maximizeWindow()`，但它本质是"最大化/还原"切换，窗口已
    最大化时反而被还原，造成"点开始游戏窗口被恢复"的怪异表现——已删除，用户窗口
    状态保持原样。设计决策已固化到 `docs/design/game-detail.md`。

- **修复"朽木难雕点详情闪一下没变化"（空 id 脏数据）**：
  - **根因**：朽木难雕这条游戏在数据库里的 `id` 是**空字符串 `""`**（其他 1270 个
    游戏 id 都是正常 UUID）。前端点详情跳转 `/game/`（缺段）匹配不上 `/game/:id`
    路由，被兜底路由 `Navigate to "/"` 拉回主页——表现为"点详情闪一下没变化"。
  - **修复**：
    1. 一次性清理：把库里空 id 的朽木难雕补上 UUID 并删除旧脏记录（总数不变，
       空 id 归零）。
    2. 治本：`get_games` 和 `save_game` 两个命令都保证 id 非空（空则补 UUID 并
       清理脏记录），以后不会再产生空 id 游戏。
    3. 前端 `GridView.openDetails` 对空 id/含特殊字符 id 加 `encodeURIComponent`
       和 console 警告，跳转更健壮。
  - **影响**：重启客户端后，朽木难雕详情可正常打开。

- **修复"朽木难雕"启动报"未配置启动指令且没有安装目录"**：
  - **根因**：管理端保存游戏时只写了 `actions` 数组，**漏掉了 `play_task` 和
    `install_directory` 两个顶层字段**。后端 `launch_game` 看到 `play_task=None`
    就走"自动检测 install_dir"分支，如果 install_dir 也是 None 就报这个错。
  - **修复**：管理端 `saveGame` 改为根据 actions 里"作为启动指令"勾选**自动派生**
    `playTask`（=该 action 的 id）和 `installDirectory`（=该 action 的工作目录或
    exe 路径），用户填好启动项保存后数据天然完整。
  - **老数据回填**：启动时跑一次性 `backfill_play_task_and_install_dir`，扫所有游戏
    把这两个字段补上（守卫键 `play_task_backfilled` 防止重复跑），避免用户手动重存。

- **管理端保存前占位符拼写纠错**（防"朽木难雕"再发生）：
  - 新增 `admin_soft_validate_action` 命令，对单个启动项做**软校验**（不查文件
    存在性，只看占位符拼写、扩展名、目录/路径合法性）。
  - 管理端 `saveGame` 在保存前对每个 action 调一次，发现 invalid 时弹确认框
    （"检测到启动项路径有问题，仍要保存吗？《启动项1》：……"），用户取消就放弃
    保存，避免错数据落库。
  - 之前的 `admin_validate_action` 仍可手动点"校验"按钮触发（强校验，会查文件
    存在性），适合做最终部署前的体检。

- **编译太慢优化**：
  - 新增 `.cargo/config.toml` 全局启用 sccache，**所有 cargo 命令**都命中编译缓存
    （之前只在 `build.ps1` 里临时启用，直接跑 `cargo tauri build` 不生效）。
  - dev profile：`opt-level=0` + `incremental=true`，开发迭代秒级。
  - release profile：移除与 LTO 冲突的 `incremental`。
  - 实测：改一处 core 后 dev 构建 admin **12.7s**（之前数分钟）；无改动重跑 **<1s**。

- **占位符拼写纠错**：`validation.rs` 集成 Levenshtein 距离检测，用户写错占位符名
  （如 `gamelibray2` 少个 r）时，错误信息直接提示"你可能想写 `Gamelibrary2`"，避免
  反复猜测。9 个 validation 单测全过。

- **新增运行前/批量检测（统一共用一套检测）**：
  - **共享检测核心**：后端新增 `validation.rs`（`validate_launch_path`），把启动项路径
    解析 + 目标 exe/bat 存在性 + 可执行类型判断统一为一处；客户端运行前检测、管理端
    单条校验、批量检测都用它，不再各写各的。
  - **客户端运行前检测**：启动游戏前解析目标 exe，若不存在（"文件不存在"/"不是可执行文件"）
    则**阻止启动**并弹出提示（`无法启动《游戏名》：文件不存在（解析路径：…）`）。
  - **管理端批量检测**：新增 `validate_selected_actions` 命令 + "批量检测"按钮。游戏列表
    支持多选（表头全选/逐行勾选），对选中的游戏逐个检测目标 exe，展示结果表
    （游戏 / 启动指令 / 目标 exe / 存在·缺失），用于体检（测试环境也给出明确"缺失"结论）。
  - **前端共享类型**：`shared/validate.ts` 定义 `ActionValidation` / `GameValidationResult`，
    客户端与管理端共用，保证字段一致。

- **明确"以游戏库管理为基础"根本业务原则**：新增权威设计文档
  `docs/design/game-library-management.md`，规定所有游戏必须属于某个游戏库、启动路径
  必须以游戏库为根（`{库名}\子目录\exe`）、不得用脱离游戏库的绝对路径。目的是**迁移友好**
  ——游戏库换盘/换目录只需改游戏库的 `path`，游戏数据无需改动。`admin.md`、`README.md`
  索引同步补充。

## 2026-08-12

- **新增启动方式选择弹窗**：当游戏有多个可启动指令（如 game.exe -dx11 / -dx12）时，
  客户端点"开始游戏"会弹出漂亮的选择窗口，显示每个指令的名称和参数（如"以 dx11 启动游戏
  （兼容更好）"），点击即用该指令启动。后端 `launch_game` 支持指定 `action_id`。

## 2026-08-12

- **新增游戏启动/退出脚本**：每个游戏可配置"启动前/启动后/退出后"三段脚本（每行一条命令），
  支持变量展开（{InstallDir}/{GameName}/{AppDir} 等）。启动前脚本同步执行、启动后异步、
  退出后同步。管理端游戏编辑新增"脚本"页（3 个多行文本框 + 启用勾选 + "测试脚本"按钮），
  新增 `test_script` 命令供测试。脚本每行一条命令，支持 # 注释。

## 2026-08-12

- **彻底修复公告弹窗交互（点击可立即停止倒计时 / 立即关闭）**：
  - **公告延迟到主界面加载完成后弹出**（`App.tsx`）：公告不再一进 App 就弹，而是等游戏数据
    `loading` 变 false 且延迟 600ms（让首屏渲染稳定）后再显示。之前公告和主界面加载同时进行，
    主线程被占用，导致鼠标点击要"使劲按"很久才响应。现在公告打开时主线程空闲，点击立即生效。
  - **交互改用 document 捕获阶段原生 `mousedown` 监听**：点"关闭"按钮（`data-action="close"`）
    → 立即关闭；点公告其它任何地方 → 停止倒计时。不再依赖 React 合成事件（在 WebView2 里嵌在
    页面中的层偶尔失效）。
  - **移除公告遮罩的 `backdrop-filter`**：在 WebView2/Chromium 里，`backdrop-filter` +
    `position: fixed` 全屏元素会导致点击命中测试异常（点了没反应），改用具象深色背景。
  - **公告用 `createPortal` 挂到 `<body>`**：脱离主界面 DOM 树和样式影响，事件更可靠。
  - 移除测试用的"停止计时器"按钮，恢复干净界面：底部居中"倒计时状态 + 关闭按钮"。
  - 行为：默认 5 秒自动关闭；点公告任意处（除"关闭"按钮）→ 停止倒计时并显示"已停止自动关闭"；
    点"关闭"按钮 / Esc → 立即关闭。

## 2026-08-12

- **新增恐怖谷 3D 地图（低多边形风格）**：星球视图的"恐怖谷"分区升级为一块**可开车探索的
  低多边形 3D 地图**（道路/河流/山脉/森林/草地），点击星球上的恐怖谷分区进入。每个恐怖谷游戏
  是一个**山洞洞口**，游戏封面作为洞口贴图。用 `cannon-es` 物理引擎实现真车辆驾驶
  （WASD/方向键，第三人称相机跟随），**开车开进山洞 → 跳转该游戏详情页**。地图角落
  有"返回星球"按钮。封面走懒加载（车接近才加载）。视觉参考"低多边形森林公园"：flatShading
  平面着色、3 层锥形低多边形松树、柔和自然配色、太阳光 + 阴影 + 雾 + 天空背景。
  恐怖谷场景用 `React.lazy` 代码分割，three.js 和 cannon-es 都只在进入时加载。
- **新增 3D 虚拟星球视图**：主页工具栏新增"星球视图"切换按钮。全部游戏按 7 个分区
  （恐怖谷/射击场/赛车场/角色扮演城/益智区/体育场/未分类）渲染到一颗自转 3D 星球上，
  每个分区是一段大陆带。悬停游戏点放大显示封面，点击进入详情页。基于
  `three.js` + `@react-three/fiber` + `@react-three/drei`。封面走懒加载（悬停才加载），
  星球视图用 `React.lazy` 代码分割，three.js 只在使用星球视图时才加载，不拖慢主界面启动。
- **新增 vitest 测试基础设施**：为纯函数（球面分布、分区归类、地形、道路、树木、山洞布局）
  补充单元测试，`npm test` 运行。

## 2026-08-11

- **网格滚动位置恢复（改进版）**：进入游戏详情页返回时，网格**恢复到原滚动位置**而非重置到
  顶部。新增 `scrollStore`（`gridScrollTop` 保存/一次性取出），GridView 在 `openDetails` 导航前
  保存 `scrollRef.scrollTop`，返回挂载后等 `totalSize` 就绪，用 `useLayoutEffect`（绘制前）+
  `virtualizer.scrollToOffset()` 恢复到原位置（rAF 后执行，避免闪跳，`restoredRef` 防重复）。

## 2026-08-11

- **公告弹窗与主界面游戏加载彻底隔离 + 交互优化**：
  - `assets.ts` 新增**图片加载挂起机制**（`suspendImageLoading` / `resumeImageLoading`）：
    `loadOne`/`loadBatch` 在挂起时等待（`waitIfSuspended`），公告挂载时挂起、卸载时恢复。
    公告显示期间主界面封面**完全不加载/解码**，动画流畅，真正互不干扰。
  - 公告交互：移除右上角 X 关闭按钮，改为底部居中**「关闭」按钮** + **5 秒自动倒计时关闭**
    （显示"N 秒后自动关闭"）。点击窗口内除「关闭」按钮以外的任意区域**永久停止倒计时**
    （取消自动关闭，显示"已停止自动关闭"），方便认真阅读；窗口保持打开直到点击「关闭」或
    Escape。

## 2026-08-11

- **统一窗口关闭路径，减少退出时 WebView2 良性警告**：`on_window_event` 的 `CloseRequested`
  由"直接销毁窗口"改为 `prevent_close()` + 读取 `close_to_tray` 设置——开启时隐藏到托盘（不
  销毁 WebView2 窗口，避免 Chromium 窗口类注销与事件循环退出的竞态），关闭时才 `app.exit(0)`。
  修复"点窗口 X 绕过托盘设置直接销毁窗口"的不一致。注：真正 `exit` 时
  `Failed to unregister class Chrome_WidgetWin_0 (Error 1412)` 是 WebView2 框架层的良性退出
  日志，不影响功能，本改动减少了其最常见的触发场景。

## 2026-08-11

- **优化公告弹窗与后台加载的相互影响（消除卡顿）**：
  - 封面图 base64 → blob 解码改为 `requestIdleCallback` 空闲调度（`assets.ts` 新增
    `decodeBlobInIdle`，`loadOne`/`loadBatch` 逐张空闲解码），不再一次性同步解码阻塞主线程，
    与动画帧错开执行。
  - 公告 overlay / card 提升为独立合成层（`will-change: transform, opacity` +
    `contain: layout paint` + `translateZ(0)`），动画走 GPU 合成线程。
  - 移除公告 CSS 与 framer-motion 双重冲突的动画（`announceFadeIn/Out`、`announcePop/PopOut`
    keyframes），完全由 framer-motion 统一控制打开/关闭，消除抖动源。

## 2026-08-11

- **移除游戏库扫描导入，改为纯管理端手工添加**：删除目录扫描（`scan_directory`）与 Steam 库
  扫描（`scan_steam_library`）及对应 Tauri 命令（`scan_directory_command` /
  `import_scanned_games` / `scan_steam_command` / `import_steam_games`）。删除 `library.rs`
  模块、`ScannedGame` 模型。游戏统一由管理端控制台的「+ 新增游戏」手工添加（保留 `library_stats`
  统计命令）。前端移除 `scanFolder` / `scanSteam` / `importResults` 等 API 与 store 方法，
  清理三份 i18n 的导入向导文案与空状态提示（改为"游戏由管理端添加"）。

## 2026-08-11

- **新增系统架构图文档**：新增 `docs/architecture-diagram.md`（分层说明 + 数据流 + 关键决策），
  并配 `docs/diagram/architecture.svg` 可视化架构图（前端层 / Tauri IPC / Rust 核心库 /
  绿色存储 四层）。`docs/README.md` 文档索引同步补充。
- **新增 HTML 版架构图**：使用 `html-architecture-diagrams` skill 生成
  `docs/diagram/playnite-architecture.html` —— 自包含、响应式、可打印的交互式架构图
  （内联 SVG + 图例 + 数据流 + 关键决策，页脚带时间戳）。浏览器直接打开即可查看。

## 2026-08-11

- **配色库精简为 6 个精选方案**：`themeLibrary.ts` 从 96 个行业 palette 精简为 6 个手工设计的
  签名配色——明亮（`p-light`）、暗黑（`p-dark`）、中国红（`p-cn-red`）、中国蓝（`p-cn-blue`）、
  中国绿（`p-cn-green`）、中国水墨（`p-cn-ink`）。每个方案提供完整 shadcn token + 旧业务变量。
  `scripts/gen-themes.py` 加守卫，检测到精选库即拒绝覆盖，避免误重建 96 palette。
- **签名风格专属视觉特效（`data-fx`）**：`styleLibrary.ts` 的 `StyleVars` 新增可选 `fx` 字段，
  `applyStyleVars` 写入 `:root[data-fx]`，`globals.css` 用 `:root[data-fx="..."]` 提供强辨识度
  特效。
- **风格库精简为 7 个精选签名风格**：`styleLibrary.ts` 从 67 个风格精简为 7 个——苹果、软浮雕、
  毛玻璃、粗野硬朗、赛博朋克/科幻HUD、像素风、复古未来/蒸汽波。每个都有专属视觉：苹果（毛玻璃
  面板）、软浮雕（凹凸双投影）、毛玻璃（半透明面板 + blur）、粗野硬朗（粗黑边框 + 硬阴影 + 直角）、
  赛博朋克/科幻HUD（霓虹 + 扫描线网格）、像素风（锯齿像素边框 + 像素字体）、复古未来/蒸汽波
  （霓虹渐变文字）。`scripts/gen-styles.py` 加守卫，检测到 7 个精选风格即拒绝覆盖，避免误重建
  67 个风格。

## 2026-08-11

- **新增"苹果"风格与配色**：配色库 +1（苹果浅色极简：青白背景 + 青主色，来自 ui-ux-pro-max），
  风格库 +1（苹果：大圆角 + 毛玻璃 + 柔和阴影 + 系统字体）。为风格体系新增 **毛玻璃（blur）**
  能力：`applyStyleVars` 注入 `--blur` + `data-glass` 开关，玻璃表面用半透明背景 +
  `backdrop-filter` 实现。苹果配色 + 苹果风格组合即得完整苹果观感。

## 2026-08-11

- **界面炫酷化（阶段 A：纯 CSS）**：新增动态极光背景（`#root::before` 三层模糊色块缓慢流动，
  跟随配色）、游戏卡片 hover 上浮 + 封面流光扫过。仅用 transform/opacity（GPU 合成），不
  影响 GridView 虚拟化与懒加载性能。
- **界面炫酷化（阶段 B：Framer Motion）**：引入 `framer-motion`，为设置弹窗、公告弹窗增加
  打开/关闭的淡入缩放过渡，设置弹窗内 section 切换淡入上移，主内容区顶部 tab 切换淡入滑动。
- **界面炫酷化（阶段 C：WebGL 粒子背景）**：引入 `three.js`，主界面加入全屏固定 Three.js
  粒子星云背景（独立 canvas，z-index 0，pointer-events none，不干扰虚拟化网格与点击）。
  粒子颜色跟随主题强调色，低 GPU 占用、失焦暂停、卸载清理、无 WebGL 时自动降级。
- **主题系统重构为 96 配色 × 53 风格**：移除 next-themes 与 4 个基础主题，改为独立的两维
  选择器（96 配色 + 53 风格，均来自 ui-ux-pro-max 设计系统），点击即注入 `:root` CSS 变量并
  持久化。风格含圆角/发光/阴影/字体差异；移除了 14 个需 3D/WebGL/语音/AI 无法用 CSS 实现的
  风格。拟态（Neumorphism）实现为双层内外阴影，应用于所有卡片/面板表面。
- **主题中文化**：96 配色与 53 风格均提供通俗中文名并按领域/风格分类折叠展示，卡片式大尺寸
  可点击。

## 2026-08-10

- **主题系统切换到 shadcn+Tailwind+next-themes**（M0-M5 系列）：引入 Tailwind v4、语义 token、
  移除旧 12 主题手写体系，组件分批迁移到 Tailwind/shadcn。

## 2026-08-09

- **优化全局文字描边/荧光造成的模糊**：原"body 级"继承 `-webkit-text-stroke + text-shadow`
  让侧栏、设置项、卡片标题等所有文本都套上 0.5px 描边 + 多层荧光，在游戏封面等复杂背景上产生
  "霓虹糊字"伪影，整体清晰度明显下降。改为：(1) 移除 `body` 上的全局描边/荧光继承，恢复
  默认清爽渲染；(2) 新增 `.text-emphasis` 与 `.text-emphasis-glow` 两个工具类，
  采用"暗色可读性 halo + 软 accent 荧光"的 `text-shadow` 栈，需要时显式 opt-in。
- **游戏卡片加调试编号**：GridCard 左下角加 `#{index}` 半透明黑底小标签，显示该卡在
  `get_games` 结果中的全局序号，便于调试虚拟滚动的行序。
- **网格视图大列表虚拟滚动**：千级游戏库下不再一次性渲染所有封面卡片，改为**窗口化渲染**
  （只挂载视口附近的行）。新增 Hook `src/hooks/useVirtualGrid.ts`：用 ResizeObserver 按容器宽度
  推导每行列数，把"组头 + 卡片行"拍平成扁平行列表，再用 `@tanstack/react-virtual` 的
  `useVirtualizer` 做窗口化；行高按 16:9 封面 + 标题区确定性估算（无动态测量）。`GridView.tsx`
  改为消费该 Hook，`.vg-window`（`height: totalSize`）作为 `.content` 的唯一子节点承载
  滚动高度，绝对定位的 `.vg-row` 摆放可见行；`useLayoutEffect` 在 mount 后强制
  `virtualizer.measure()`，避免 ref 未及时挂载时虚拟化器卡在初始几行。修复了首版中
  ".vg-spacer + .vg-window"双节点结构偶发导致只渲染前几行的问题。第二轮修复：
  `getVirtualItems()` **不能** 用 `useMemo` 包——虚拟化器是外部 store，滚动触发 re-render
  时 React 依赖未必变化，但 visible window 依赖当前 scroll offset，必须在 render 中直接调用，
  否则滚动时窗口不更新，表现为"卡在中间 + 大片空白"。与既有的 `useLazyImage` 图片懒加载
  互补（懒加载省图片请求，虚拟化省 DOM 数量）。依赖新增 `@tanstack/react-virtual`。
  详见 [大列表虚拟滚动](./design/virtual-scrolling.md)。
- **全局文字"高亮+荧光+描边边框"（主题化）**：在 `body` 上统一应用文字描边+荧光
  （`-webkit-text-stroke` + `text-shadow`，CSS 变量驱动，可继承到所有文本节点），
  让每个主题的文字都有"带边框的荧光高亮"效果。新增主题变量 `--text-stroke`/
  `--text-stroke-color`（描边宽度/颜色，默认 `0px`/transparent，浅色主题不受影响）与
  `--text-glow`（荧光 shadow，默认 `none`）。`wow`/`lol`/`pubg` 三个深色主题各配置
  0.5px 深色描边 + 主题色双层荧光，实现游戏风的高亮文字。icon（SVG）不受描边影响。
  改动集中在 `src/styles/global.css`（`:root` 默认变量 + `body` 应用 + 三主题配置）。
- **新增三大游戏主题**：设置 → 主题增加 **魔兽世界（World of Warcraft）**、
  **英雄联盟（League of Legends）**、**绝地求生（PUBG）** 三个游戏风格主题，
  与现有的卡通/赛博朋克/孟菲斯/新拟态/美漫/吉卜力/中国风并列。色板与字体风格
  紧扣各自 IP 调性（艾泽拉斯羊皮纸金字、符文之地魔法蓝金、战场橄榄绿沙土褐）。
  实现遵循现有成熟模式：`src/utils/theme.ts` 的 `ThemeId` 与 `THEMES` 列表追加，
  `global.css` 追加 `[data-theme="wow|lol|pubg"]` 变量覆写，三份 locale 新增 6 个 key。
- **侧边栏可拖拽改宽度并持久化**：侧边栏右边新增 5px 拖拽手柄，鼠标按住可水平拖动
  调整宽度（范围 160..600px），宽度持久化到应用设置 `AppSettings::sidebar_width`（config.json，
  `#[serde(default)]` 保证旧配置兼容）。拖拽过程用本地 React state 做实时响应，松手再调
  `saveSettings` 落盘，避免每次 mousemove 都打后端。标签列表的 `auto-fill minmax(86px)`
  自动换行会跟着新宽度即时重排。
  改动：后端 `models.rs`（新增 `sidebar_width` + `default_sidebar_width` + Default 210）、
  前端 `types/models.ts` / `settingsStore.ts`（`sidebarWidth: 210`）、`Sidebar.tsx`
  （拖拽手柄 + 鼠标事件 + 本地 state）、`global.css`（`.sidebar` 加 `position: relative` +
  `.sidebar-resizer` 样式）、三份 locale 新增 `sidebar_resize` 文案。
- **侧边栏标签按宽度自动换行**：标签列表不再手动选列数，改为 **CSS Grid 自动换行**
  （`repeat(auto-fill, minmax(86px, 1fr))`）——sidebar 宽则多列、窄则少列，自动排布。
  标签项采用**列内垂直布局**（第一行 `#name` ellipsis，下方 `checkbox + count` 同行），
  padding 收紧到 5px6px，多列下清晰不覆盖。移除之前临时加入的手动列数机制
  （`AppSettings.tag_columns`、`Settings.tagColumns`、下拉框 UI 与 `tag_columns` 翻译 key）。
  改动：`Sidebar.tsx`（去掉下拉框/内联 grid）、`global.css`（`.sidebar-tag-list` 自动换行 +
  `.sidebar-tag` 垂直布局 + padding 紧凑）、回滚 `crates/.../models.rs`、`types/models.ts`、
  `settingsStore.ts` 及三份 locale。

## 2026-08-08

- **动态视频列表 API（`/api/videos`）**：详情页静态服务器新增 `GET /api/videos?dir=<游戏目录名>`，
  返回 `Game_Details/<游戏名>/videos/` 下视频的 JSON 列表（`{ root: [...], dirs: [{name, files}] }`），
  支持子文件夹分组与自然排序（`实况2` < `实况10`）。详情页（如 `Kenshi剑士/js/main.js`）
  `fetch("/api/videos?dir=" + location.pathname)` 即可自动渲染 DPlayer 播放列表——把视频丢进
  `videos/` 目录即可，无需手写 `<video>` 标签。复刻了早期 Node `server.js` 的行为，用
  `axum::extract::Query` + `std::fs::read_dir` + `serde_json` 实现在同一自包含服务器上（`game_server.rs`
  的 `api_videos` handler，约 60 行，不新增依赖）；`..`/绝对路径/空 `dir` 一律 403 防越界。
  文档：`docs/design/game-detail.md` 新增"动态视频列表 API"小节。

- **游戏静态详情页容器：彻底重写为成熟方案 `axum` + `tower-http::services::ServeDir`**
  （遵循项目"优先使用已有成熟方案"原则）。详情页服务器核心由约 210 行手写
  `std::net::TcpListener` + HTTP 解析/响应代码，全部删除，替换为 ~70 行
  `axum::Router::nest_service("/games", ServeDir::new(Game_Details))`。ServeDir 开箱即用提供：

  - **HTTP Range / 206 Partial Content**（视频 seek / 拖动播放必需）—— 解决 Kenshi 剑士
    `videos/实况1.mp4` 在 iframe 内无法加载的根因（旧手写服务器无 Range 支持）。
  - `GET` + `HEAD`—— 修复旧服务器对 HEAD 返回 405 导致 `XMLHttpRequest HEAD` 视频探测
    误判为 `status >= 400` 而显示"视频待添加"的问题。
  - 流式输出大文件（206MB 视频不读全内存）。
  - MIME 探测（含 `video/mp4` 等）、`If-Modified-Since` 304、路径穿越防护、`append_index_html_on_directories`。

  运行模型：`GameServer::start` 启动独立 `std::thread` + 自建 `tokio` runtime，
  不依赖 Tauri async_runtime 初始化时序。`base_url` 通过 `get_game_server_url` 暴露给前端。
  对比方案：`hyper-staticfile` / `actix-files` / 自实现 Range——`tower-http::ServeDir`
  是 Rust 生态静态文件服务的标准答案，被广泛生产使用，故采用。

  - **iframe 全屏授权**：`GameDetailPage` 的 iframe 增加 `allowFullScreen` +
    `allow="fullscreen; autoplay; encrypted-media; picture-in-picture"`——否则跨源 iframe 内
    的 DPlayer / `<video>` / YouTube 嵌入调用 `requestFullscreen()` 会被浏览器拦截，**全屏按钮无效**。

  新增文档 `docs/design/game-detail.md` 记录设计原则、URL 映射、能力清单与
  与"优先成熟方案"准则的对应关系；`docs/README.md` 索引加入该文档。
  新增依赖：`axum = "0.8"`、`tokio = { version = "1", features = ["rt-multi-thread", "net", "macros", "sync"] }`、
  `tower-http = { version = "0.6", features = ["fs"] }`；移除不再使用的 `tiny_http`。

- **确立开发准则"优先使用已有成熟方案"**：将"基础设施类与通用功能优先复用生态成熟 crate、
  不手写底层实现"写入 `docs/CONTRIBUTING.md`（新增"开发准则"小节）、`AGENTS.md`（开发规范第 11 条）、
  并作为 `docs/design/game-detail.md` 的顶层设计原则。`docs/design/architecture.md` 模块表补充
  `game_server` 模块与 `game_html` 命令。此准则源于本次详情页容器重写（手写 HTTP 服务器 → axum+ServeDir）
  的经验教训。

## 2026-08-07

- **游戏静态资料页（连接客户端，通用方案）**：每游戏独立静态详情页机制——游戏在数据目录
  `Game_Details/<游戏名>/` 放 `index.html` + `css/` + `js/` + `images/`。
  采用 **本地 HTTP 服务器**（`tiny_http`，监听 127.0.0.1 随机端口）服务 `Game_Details/`
  目录，URL 形如 `http://127.0.0.1:<port>/games/<游戏名>/index.html`。webview **原生**加载
  css/js/images、执行脚本、处理 `#anchor` 锚点跳转——无需内联、无需打补丁，对所有游戏
  页面通用（同 Playnite 等启动器的做法）。客户端 `GameDetailPage`：`get_game_server_url`
  取服务器地址 + `get_game_html_page` 检测是否存在；有资料页→返回按钮+全屏 iframe
  （`src = <base>/games/<游戏名>/index.html`），无资料页→返回按钮+**404 页面**。
  已生成《赛菲莉娅-网吧联机版》资料页（真实 Steam 截图 11 张，点击灯箱放大）。

## 2026-08-07

- **封面匹配修复**：`covers.rs` 的 `apply_covers` 对"已有封面"的判断从"路径非空"改为
  "路径非空 **且文件存在**"。当数据库存的封面文件被删除/改名（例如 `007.jpg` 换成
  `007.gif`）时，会重新扫描 `CoverImages/` 并按格式优先级（APNG > webp > gif > jpg > png）
  重新匹配新文件，避免显示失效路径导致封面空白。

- **注册表数据目录覆盖**：`AppPaths::config_root()` 新增 Windows 注册表读取，支持管理员
  指定数据/配置目录：
  - 注册表键：`HKEY_CURRENT_USER\Software\YunGame`，值名 `DataDir`（`REG_SZ` 绝对路径）。
  - 读取顺序：`DataDir` 存在且非空 → 用它作为所有数据（数据库、config.json、CoverImages、
    cache 等）的根目录；否则回退到原有逻辑（debug 指向 `<project>/release`，release 指向
    exe 所在目录）。
  - 效果：一处设定，全部路径派生自 `config_root()`，自动覆盖数据库 / 配置 / 封面 / 图片等。

- **管理端：游戏编辑器升级为多标签页 + 多启动项**：
  - 游戏编辑弹窗改为 **通用 / 指令 / 游戏库** 三个子标签页。
  - **指令标签页**：支持为单个游戏配置**多条启动项**（原版 / MOD / DX11 / DX12 等）：
    每条含名称、类型（文件 / URL）、路径、工作目录、启动参数、是否作为启动指令、
    是否追踪游玩时间；支持 **添加 / 上移 / 下移 / 移除**。启动指令为唯一（勾选一条自动取消其它）。
  - **游戏库标签页**：配置游戏库根目录列表，映射到 `{Gamelibrary1}`、`{Gamelibrary2}` … 占位符。
  - **新增顶层"游戏库管理"标签页（完整 CRUD）**：以**表格**列出所有游戏库
    （ID / 名称 / 路径 / 操作），支持新增、编辑、删除，与游戏管理一致；游戏库模型为
    `GameLibrary { id, name, path }`，name 可改（如"库1"、"库2"），path 为根目录。
    后端命令改为 `admin_get_game_libraries` / `admin_save_game_library` /
    `admin_delete_game_library`；旧纯字符串数组配置自动兼容升级。
  - **游戏编辑"通用"标签页补全字段**：新增版本 / 发行商 / 系列 / 发行日期 / 收藏 / 隐藏，
    以及简介 / 描述、HTML 攻略 / 玩法指南、备注；标签改为**标签选择器**（全库唯一标签
    chip 点选 + 自定义添加），不再用手打逗号分隔。
  - **表格统一显示 ID 列**：游戏管理、用户管理、游戏库管理三张表均展示 ID。
  - **修复保存命令参数键**：`save_game` 改为 `{ payload: { game } }`、`admin_set_game_level`
    改为 `{ game_id, level }`，与后端命令参数名对齐（此前参数键不匹配导致标签等保存失败）。
  - **文档新增"桌面端启动路径拼接"**：客户端启动时按名称匹配 `{名称}` 占位符 → 游戏库根
    目录 → 拼接剩余相对路径并归一化 → 启动进程。
  - **用户管理补全**：新增**用户类别**（个人用户 / 企业用户，`kind` 字段），列表展示类别
    标签；`admin_save_user` 支持 `kind` 参数；保存/删除带错误提示（新增必须填密码）。
  - **删除确认 + 撤销**：所有删除（游戏 / 用户 / 游戏库）改用**自定义确认弹窗**
    （替换不可靠的 `window.confirm`）；删除后底部弹出**撤销条**。用户删除为**软删除**
    （`users` 表新增 `deleted_at`，迁移自动补列），`admin_restore_user` 恢复；已删除用户
    不参与登录校验与列表展示。新增 `admin_restore_user` 命令。
  - **启动项可执行性真实校验**：新增 `admin_validate_action` 命令，对启动项路径做**真实
    文件系统校验**（解析占位符 → 绝对路径 → 存在性 / 非目录 / 可执行扩展名）。
    前端输入路径实时显示校验结果及解析后实际路径，保存时对 File 启动项再次校验，
    无效路径阻止保存。`process.rs` 的路径解析逻辑提取为共享的 `resolve_path` 供校验复用。
  - **设计修正：游戏只属于一个游戏库**：`Game` 模型新增 `gameLibrary: Option<String>`
    字段；**"所属游戏库"下拉移到"通用"标签页**（每个游戏单选一个库）；
    **"游戏库"子标签页移除**，库增删改统一只在顶层"游戏库管理"。
    指令标签页底部新增"此启动项引用的游戏库（只读）"自动展示 actions 中实际使用的 `{库名}`。
    启动路径解析逻辑不变。
  - **工作目录便捷按钮**：指令标签页工作目录旁加"**用 exe 所在目录**"按钮（解析 exe
    实际路径后取 parent 作为工作目录，默认应=exe 所在目录，填错游戏启动不了）。
  - **启动项校验改为手动触发**：路径右侧加"**校验**"按钮（手动触发，不阻塞保存——
    开发与部署环境路径不同，保存时校验会阻碍配置）。`saveGame` 加 try/catch 错误提示。
- **保存时缺失字段容错**：`saveGame` 构造 payload 时以"完整默认 Game"为基底，再合并
  `editingGame`（仅替换非 undefined 字段）——避免老数据缺字段（如 `installed`）时
  serde 反序列化失败。工作目录提示具体路径（如 `{Gamelibrary1}\bin`）而非"留空"，并强调
  工作目录**必须指定**（很多游戏是 exe 子目录如 `\bin`）。
- **弹窗关闭保护（基本规则）**：游戏 / 游戏库 / 用户编辑弹窗**点击外部一律不关闭**（无论
  有无改动），只通过明确的"保存 / 取消"按钮关闭，防止误点击丢失编辑内容。"取消"按钮在
  有未保存改动时先弹确认框。打开时对表单做 JSON 快照对比改动。
  - **数据自动迁移**：`init_app_db` 启动时自动执行 `migrate_gamelibrary_paths`（幂等，受
    `gamelibrary_migrated` 标记保护），把数据库所有启动项路径从旧的 `.\Gamelibrary\...`
    格式批量替换为 `{Gamelibrary1}\...` 占位符；同时提供 `admin_migrate_gamelibrary_placeholder`
    命令与编辑器内"迁移旧路径"按钮供手动触发。已对现有 1270 个游戏完成迁移。
  - 路径 / 工作目录 / 游戏库目录支持 **Tauri 文件选择对话框**（`@tauri-apps/plugin-dialog`）。
  - **后端**：新增 `admin_get_game_libraries` / `admin_set_game_libraries` /
    `admin_migrate_gamelibrary_placeholder` 命令；`AppSettings` 增加 `game_libraries: Vec<String>`
    字段（持久化到 `config.json`）；`process.rs` 的 `launch` 支持解析 `{GamelibraryN}` 占位符，
    替换为对应游戏库根目录后再做路径解析（绝对/相对）。
  - `launch_game` 命令读取 `settings.game_libraries` 传入 `process.launch` 以解析占位符。
  - 管理端游戏列表的"启动项"列改名为**"安装目录"**。
  - **移除管理端"企业配置"标签页**（企业用户 IP 匹配功能不再使用），导航栏仅保留
    游戏管理 / 用户管理 / 游戏库管理。

## 2026-08-05

- **彻底清除残留依赖**：从 `package.json` 移除已不使用的 shadcn/Tailwind 相关依赖
  （`tailwindcss`、`@tailwindcss/vite`、`@radix-ui/react-dialog`、`@radix-ui/react-slot`、
  `class-variance-authority`、`clsx`、`sonner`、`tailwind-merge`、`tw-animate-css`），
  并移除 `vite.config.ts` 中的 `@tailwindcss/vite` 插件。`npm install` 后共移除 40 个包。
  保留在用的 `@tanstack/react-query`、`react-router-dom`、`lucide-react` 等。
  同步更新 `AGENTS.md`、`README.md`、`docs/design/architecture.md` 的 UI 栈说明。

- **重构为 Cargo workspace monorepo（多项目结构，类似 .NET 解决方案）**：
  - 目录布局改为 **共享核心库 + 多个 Tauri 应用**：
    ```
    crates/yungame-core/   共享库：数据模型、db、auth、process、settings、covers、commands
    apps/desktop/          客户端 Tauri 应用（Playnite.DesktopApp.exe，frontendDist = ./dist）
    apps/admin/            管理端 Tauri 应用（Playnite.Admin.exe，frontendDist = ./dist-admin）
    ```
  - 每个 app 拥有**完全独立的 tauri.conf.json / build.rs / capabilities / icons / frontendDist**，
    各自 `tauri::generate_context!()` 只嵌入各自前端——彻底解决此前"管理端误加载客户端前端
    报 `library_stats not found`"、双窗口、cdylib GNU 链接失败等系列问题。
  - 共享业务代码集中在 `crates/yungame-core`（`run_client` / `run_admin` 工厂 + 全部命令）。
  - 新增根 `Cargo.toml` workspace（共享 release profile：thin-LTO + 16 codegen units + incremental）。
  - 前端：客户端 `vite.config.ts → dist/`，管理端 `vite.admin.config.ts → dist-admin/`（各自独立目录）。
  - `build.ps1` 支持 `-ClientOnly` / `-AdminOnly` / `-Debug`；`dev-client.bat` / `dev-admin.bat`
    提供前端 HMR + 后端增量编译的快速验证。
  - 移除旧的 `src-tauri/` 与 `src-tauri-admin/` 单 crate 结构。
  - **文档同步**：重写 `docs/design/architecture.md`（monorepo 架构）、`directory-structure.md`
    （新目录布局）、`build-script.md`（多 exe 构建 + dev 模式）；新增 `docs/design/admin.md`
    （管理端设计）；更新 `docs/README.md` 索引与根 `README.md`。

- **修复：管理端窗口错误加载客户端前端导致 `library_stats not found`**：
  Tauri v2 的 `tauri.conf.json` `windows[].url` 字段在 `generate_context!`
  编译时不被用于设置窗口 URL，admin bin 默认从 frontendDist 加载 `index.html`
  （客户端），从而触发未注册命令。改为在 `run_admin()` 的 setup 中用
  `WebviewWindowBuilder` 动态创建 admin 窗口并加载 `admin/index.html`。

- **管理端独立可执行程序（Playnite.Admin.exe）**：
  - 管理端与客户端共用同一套数据模型与后端命令，但作为**独立 Tauri 程序**构建，
    输出到独立的 `admin_release/` 目录，**不随客户端发布**。
  - 新增第二个 `[[bin]] name = "admin_app"`（`src/bin_admin.rs`）、`lib.rs::run_admin()`
    与独立配置 `tauri.admin.conf.json`（productName = `Playnite.Admin`，窗口加载
    `admin/index.html`）。
  - 新增 `capabilities/admin.json`（admin 窗口权限）。
  - `package.json` 新增 `build:admin` / `dev:admin` 脚本。
  - `build.ps1` 同时构建客户端与管理端；客户端输出 `release/Playnite.DesktopApp.exe`，
    管理端输出 `admin_release/Playnite.Admin.exe`（分开目录，仅客户端随发布分发）。
  - 绿色存储定位仍按 exe 所在目录：管理端运行时放到客户端同目录即可管理同一游戏库。
  - exe 文件名保留 Playnite 字样（遗留要求），内部代码/配置/UI 统一为 YunGame 无 Playnite。

- **管理端游戏管理：支持配置启动 Action**：
  - admin 前端游戏编辑弹窗新增"启动配置"区块（类型 File/URL、路径、工作目录、参数），
    优先支持**相对路径**（游戏与 YunGame.exe 同盘，用 `.` / `..` 定位）。
  - 游戏表格新增"启动路径"列，展示每个游戏的 play action。
  - `admin/lib.ts` `Game` 增加 `actions: GameAction[]`。
  - 后端 `process.rs` `launch` 增加相对路径解析：非绝对路径以 exe 所在目录为基准
    归一化（`normalize_path`），working_dir 为空时默认取 exe 的父目录。
  - `lib.rs` 注册 admin 业务命令（admin_list_users / admin_save_user / admin_delete_user /
    admin_get_settings / admin_set_enterprise_config / admin_preview_enterprise /
    admin_set_game_level），打通 admin 前端与共享后端。

- **品牌更名 Playnite → YunGame**：去除启动页 "Playnite loading" 字样；所有用户可见名称
  （窗口标题、托盘 tooltip、菜单、公告、应用名）统一为 `YunGame`。
  - Cargo/bin/lib/package 名改为 `yungame`；绿色可执行文件输出为 `YunGame.exe`。
  - `identifier` 改为 `yungame.desktop`；`auth.rs` 的密码盐前缀 `playnite-salt::` 保留以兼容既有用户数据。
  - 更新 `index.html`、`main.tsx`、`announcement.*`、`system.rs`、`lib.rs`、`tauri.conf.json`、`build.ps1`。
  - **公告秒加载优化**：公告 HTML 改为 Vite `?raw` 静态内联进前端 bundle，弹窗打开即同步渲染，
    消除 "Loading announcement..." 中间状态（不再依赖 IPC + 文件 I/O）。

- **标签页模式界面**：主界面改为顶部标签栏导航（主页 / 视频 / 额外工具）。
  - `uiStore` 新增 `activeTab` 状态（`home` / `videos` / `tools`）与 `setTab`。
  - 新增 `TabsBar` 顶部标签栏组件；`AppBody` 在主内容区上方渲染标签栏。
  - **视频页 `VideosView`**：遍历游戏库，展示各游戏关联的 `videos` 字段（`youtube` 转为可内嵌 iframe，`file`/`url` 显示外链卡片）。
  - **额外工具页 `ToolsView`**：占位工具卡片（屏幕录制 / 游戏加速 / 游戏增强），带启用开关，功能后续逐步实现。
  - `MainContent` 按 `activeTab` 渲染对应视图；新增 i18n 三语文案。
  （[views](./design/views.md)）

## 2026-08-04

- **图片懒加载与 UI 性能优化**（千级游戏库专项）：解决启动卡死、滚动卡顿。
  - 后端新增 `read_images_batch` **一次 IPC 批量读取**多张图片 + **进程级图片缓存**
    （`OnceLock<Mutex<HashMap>>`，重复路径零读盘）+ `spawn_blocking` 后台 I/O
    （`read_image`/`read_images_batch` 改 async，文件读取不在主线程阻塞）。
  - 前端移除启动时 `preloadGameImages` **全量预加载**（`gamesStore.load` 不再预加载图片，
    主界面秒开）；`imageUrl()` 改为纯同步、不主动加载。
  - **IntersectionObserver 渐进懒加载**（`useLazyImage`，rootMargin 600px + `requestIdleCallback`
    空闲调度）→ 滚动时图片**逐张淡入**；前端 LRU blob URL 池（上限 220，超限 revoke）+ 单图并发限制。
  - 封面 `<img>` 加 `loading="lazy"`/`decoding="async"` + 淡入动画（`cover-fade-in 0.35s`）。
  - 效果：启动秒开、滚动流畅、图片逐渐出现、双缓存复用零成本。
  （[image-loading-performance](./design/image-loading-performance.md)、[covers](./design/covers.md)）
- **设置迁移到 `config.json`**：应用偏好（语言、主题、卡片大小/间距、渲染模式、企业配置路径等）
  不再存 SQLite，改为 `config.rs` 读写应用目录下的 `config.json`（漂亮的 JSON，用户可直接编辑）。
  数据库只存游戏库、用户等业务数据。首次启动自动把旧数据库设置迁移到 `config.json`。
  （[green-storage](./design/green-storage.md)）

## 2026-08-03

- **新增三份设计文档**（规划阶段，未实现代码）：
  - [修改器整合](./design/trainers.md) — `GameTrainer` 模型、`trainers/` 目录、启动/导入命令
  - [备份游戏存档（Backup Saves）](./design/backup-save.md) — `SaveBackupConfig`、本地 + 多种云途径（WebDAV/SFTP/OneDrive/Google Drive 等）存档备份/恢复
  - [图文/视频攻略整合](./design/guides.md) — `GuideSection` 章节化、`guides/` 本地库、内嵌视频

本文件按时间记录每次功能变更。格式：`日期 - 变更内容（相关文档）`。

---

## 2026-08-03

- **封面图库（CoverImages）自动匹配**：在应用目录的 `CoverImages` 目录放入图片，文件名与
  游戏中文名一致即可自动设置为封面。后端新增 `covers.rs`：扫描目录建立规范化文件名索引，
  按游戏的中文名/多名称/别名/原名多候选匹配，只填充空封面、不覆盖手动设置的封面；
  `get_games` 时自动应用并持久化。**本地图片加载改为后端 `read_image` 命令**（读取字节 +
  MIME 返回），前端用 `URL.createObjectURL(blob)` 生成 blob URL 并缓存每个文件只读一次，
  `get_games` 后批量预加载所有本地封面/背景/图标/截图。原 asset 协议方案在 Windows 绿色版
  上对绝对路径的 glob 匹配不稳定（不同 Tauri 2 patch 版本行为差异），故改为后端读取。
  新增 `imageUrl()` 统一处理本地/远程图片；设置→外观新增"封面图库"面板（目录、文件数、
  重新扫描）。**效率优化**：文件名索引缓存（目录 mtime 变化才重建）+ HashMap O(1) 查找。 **格式优先级**：同名多格式封面按 `APNG > webp > gif > jpg > png` 自动选，动画优先。
- **侧边栏自动隐藏 + 标签筛选（多选 checkbox）**：侧边栏默认收起，
  鼠标悬停左侧手柄滑出；`onMouseLeave` 自动收起（可点折叠按钮关闭）。
  标签分区用 checkbox 多选（`#第一人称 (342)` 样式），多选语义为 **AND**（游戏需同时
  包含所有选中标签才显示）；标题栏有"清空"按钮与搜索框（>6 个标签时显示）。
  （[data-models](./design/data-models.md)、[green-storage](./design/green-storage.md)、[covers](./design/covers.md)）

## 2026-08-03

- **新增 5 种界面风格**：在原有"卡通 / 赛博朋克"基础上，新增 **孟菲斯、新拟态、美国漫画、
  吉卜力、中国风** 5 套主题。均以 CSS 变量驱动（`data-theme` + `global.css` 变量块 + 各主题
  专属打磨样式，如新拟态内嵌投影、美漫粗描边、孟菲斯圆点底纹、中国风纸墨肌理等）。
  `theme.ts` 改为通用 i18n key 驱动（`labelKey`/`descKey`），`ThemesSection` 不再硬编码
  卡通/赛博朋克，预览色块与强调色可配置。切换即时生效并持久化。
  （[theming](./design/theming.md)）

## 2026-08-03

- **卡片间距设置**：`AppSettings` 新增 `cardGap`（0–20px，默认 8）。图片区域保持 **16:9** 比例
  （`grid-card .cover` 的 `aspect-ratio: 16 / 9`，图片 `object-fit: cover`），设置界面新增
  "卡片间距"滑块，实时应用到网格视图的 `gap`。（[data-models](./design/data-models.md)、[views](./design/views.md)）

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
