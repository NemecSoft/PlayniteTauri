# 大列表虚拟滚动（虚拟化游戏网格）

## 目标

当游戏库规模达到数百到上千款时，网格视图（`GridView`）如果一次性渲染全部卡片，
会产生大量常驻 DOM 节点，导致滚动卡顿、布局/重绘频繁、内存占用偏高。

本方案的目标是**只渲染视口附近的行**（窗口化 / 虚拟滚动），在保留现有"分组网格"
视觉与交互的前提下，显著降低千级游戏库下的 DOM 数量与滚动开销。

> 前置说明：封面图片的**加载**开销此前已通过 `useLazyImage`
> （IntersectionObserver 懒加载）解决（见 `docs/design/image-loading-performance.md`）。
> 但懒加载只解决"图片带宽 / IPC 洪水"，**不会减少已渲染的 DOM 节点数**——卡片容器仍会
> 全部挂载。虚拟滚动解决的是后者，两者互补。

## 方案对比

遵循"优先使用成熟方案、并对比候选"的开发准则，评估了以下虚拟化思路：

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| 原生图片懒加载 + 全量 DOM | 当前状态；只省图片请求，DOM 节点仍全量存在 | ❌ 不解决 DOM 数量 |
| 每分组独立滚动容器 + 各自虚拟化 | 多个滚动容器，状态割裂、组间跳转需手动同步，体验差 | ❌ 不采用 |
| 全量拍平 + 单一 `useVirtualizer` 行虚拟化 | 把"组头 + 卡片行"拍平成扁平行列表，单一滚动容器窗口化渲染 | ✅ 采用 |
| 数据库分页 + 无限滚动（`get_games_page`） | 需改造后端 + TanStack Query 分页，改动面大，且与现有"全量 `get_games`"数据流冲突 | ⏸ 可作为后续备选 |

**选择理由**：第 3 种方案与 Playnite 等主流启动器"保留分组语义 + 窗口化"的做法一致，
对现有数据流（`get_games` 全量返回 → 前端 `filter/sort/group`）**零侵入**，只改动渲染层，
并直接复用 `@tanstack/react-virtual`（与 `light-c` 使用的成熟虚拟化库一致）。

## 实现方案

### 依赖

- `@tanstack/react-virtual`（v3）——成熟、被广泛生产使用的窗口化库。

### 核心 Hook：`src/hooks/useVirtualGrid.ts`

`useVirtualGrid` 把"分组网格"转化为"扁平行列表"并做窗口化：

1. **列数推导**：用 `ResizeObserver` 监听滚动容器 `.content` 的**内容盒宽度**
   （`clientWidth` 减去水平 padding），按 `cardWidth`（最小列宽）与 `gap` 计算每行列数 `cols`。
2. **拍平**：对每个分组，先压入一个 `header` 行（含 `groupGap` 底部留白，等价原 `.group-section` 的
   `margin-bottom`），再按 `cols` 把游戏切成若干 `cards` 行。
3. **行高**：封面为 16:9，卡片行高 = `colWidth * 9/16 + titleHeight + gap`；组头行高 =
   `headerHeight + groupGap`。行高是确定值，`useVirtualizer` 用 `estimateSize(i)` 返回，无动态测量。
4. **窗口化**：`useVirtualizer` 返回可见行，`items` 携带 `row` + `offset`（起点像素）。

### 渲染：`src/components/views/GridView.tsx`

```
.content (scroll 容器, ref=scrollRef, position:relative, overflow-y:auto)
└── .vg-window (position:relative; height: totalSize)   ← 唯一子节点, 承载总高
    └── .vg-row ×N  (position:absolute; top:0; transform:translateY(offset))
        ├── header 行 → .group-header
        └── cards 行 → .game-grid (grid-template-columns: repeat(cols, minmax(0,1fr)))
```

关键点：

- `.vg-window` 是 `.content` 的**唯一**子节点，显式 `height = totalSize`，保证 `.content`
  的 `scrollHeight` 与虚拟化器报告的总高一致，滚动条出现且可滚动。
- 行用 `position: absolute; top: 0; transform: translateY(offset)` 精确摆放在 `.vg-window` 内。
- `.game-grid` 的列数由 JS 内联设置（`repeat(cols, minmax(0,1fr))`），每行卡片数量确定；
- 组头行占用 `headerHeight + groupGap`，等价原 `.group-section { margin-bottom }` 的呼吸感；
- 卡片行高预留 `titleHeight`（含标题 + 别名行），避免实际内容溢出覆盖相邻行。
- 测量保证：`useLayoutEffect` 在 mount 后调用 `virtualizer.measure()`，并在 `allRows.length`
  / `rowHeight` 变化时再次强制重测，避免 ref 未及时挂载或行数变化后虚拟化器未刷新。
- **不要 memoize `getVirtualItems()`**：虚拟化器是外部 store，滚动/尺寸变化会触发 React
  re-render，但 `getVirtualItems()` 的返回值依赖当前 scroll offset，与 React 依赖无关联。
  在 render 中直接调用（不包 `useMemo`），保证窗口与滚动条同步——否则会出现"卡在前几行"或
  "空白过多"的虚假表现。

### CSS：`src/styles/global.css`

- `.vg-window`（relative, width 100%）和 `.vg-row`（transform 加速）两个新类。
- 原 `.group-section` 样式被移除（GridView 已不再用它）。

## 关键点与权衡

- **行高确定性**：虚拟化要求行高可估。当前用 16:9 + 固定标题区估算，若未来卡片布局高度
  变化（如多行标题、更大的别名区），需同步调整 `useVirtualGrid` 的 `titleHeight` / `headerHeight`
  参数，避免行间重叠或出现空隙。
- **overscan**：`overscan: 6`，在视口外多预渲染若干行，快速滚动时减少白屏。
- **与懒加载协作**：被卸载的行上的封面 blob URL 仍保留在 `useLazyImage` 缓存中，滚回时
  立即命中缓存，无重复 IPC 请求。
- **未做后端分页**：仍一次拉全量 `get_games`，仅渲染层虚拟化。若未来单机库达到数万级，
  可再评估"数据库分页 + 无限滚动"（方案对比表中备选）。

## 相关文件

- `src/hooks/useVirtualGrid.ts` —— 虚拟网格 Hook（列数推导 / 拍平 / 窗口化）
- `src/components/views/GridView.tsx` —— 消费 `useVirtualGrid` 渲染窗口化分组网格
- `src/styles/global.css` —— 虚拟网格的定位/占位样式
- 依赖：`@tanstack/react-virtual`

## 参考

- [视图系统](./views.md) —— 网格视图整体说明
- [封面图片懒加载](./image-loading-performance.md) —— 与之互补的图片加载优化
