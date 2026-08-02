# 公告页面（最近新增）

## 目标

提供一个"公告 / 最近新增"页面，按**加入库的时间倒序**展示最近新增的游戏动态。

## 实现

- **页面切换**：游戏 store 新增 `activePage`（`"library" | "news"`）与 `setPage()`，
  `MainContent` 根据 `activePage` 渲染游戏库视图或新闻视图。
- **侧边栏入口**：侧边栏顶部新增"最近新增"按钮（`Sparkles` 图标），点击切换；
  其他侧边栏项点击时自动回到 `library` 页。
- **`NewsView` 组件**（`src/components/views/NewsView.tsx`）：
  - 取所有非隐藏游戏，按 `added` 时间戳降序排序。
  - 渲染垂直信息流：封面（或无封面时显示名称首字母占位）、主名称、年份、
    开发商、平台、简介（最多 3 行截断）、"开始游戏"按钮。
  - 空态提示。

## 交互

- 点击卡片内"开始游戏" → 调用 `launchGame` 启动。
- 显示游戏 `releaseDate` 的年份作为日期徽标。

## 多语言

标题"最近新增"、空态文案均通过 i18n（`news_title` / `news_empty`）。
