# 搜索系统（含拼音首字母）

## 目标

游戏库搜索应覆盖：
1. **主名称**（英文原名）
2. **多语言本地化名称**（`localizedNames`，如 zh-CN / zh-TW / ja / ko）
3. **别名 / 俗称**（`alternateNames`，如"三男一狗"、"车枪大战"）
4. **中文拼音首字母**：输入 `xjzb` 能搜到"星际争霸"
5. **中文全拼**：输入 `xingjizhengba` 也能搜到
6. **元数据字段**：类型（genre）、开发商、发行商、标签、平台、系列

## 实现方案（`src/utils/search.ts`）

采用行业推荐方案，引入 **`pinyin-pro`** 库（中文拼音转换，精准、轻量、支持首字母与多音字）。

### 核心函数

```ts
// 1) 中文首字母提取
pinyinInitials("星际争霸") // -> "xjzb"

// 2) 收集一个游戏的所有名称变体（主名 + 本地化名 + 别名）
gameNameVariants(game)

// 3) 为每个游戏构建单一搜索"haystack"（索引字符串）
gameSearchHaystack(game)

// 4) 匹配
matchSearch(game, query)
```

### Haystack 构成

对**每个名称变体** `v`，向 haystack 追加：
- `v`（原样）
- `pinyinInitials(v)`（中文首字母，如 `xjzb`）
- 全拼 `pinyin(v)`（如 `xingjizhengba`）

再追加元数据字段：`genre + developer + publisher + tags + platform + series`。

最终 `normalize`（小写 + 去重音符号）后，`matchSearch` 用 `includes(q)` 做子串匹配。

### 性能优化

- **内存缓存**：`getSearchHaystack(game)` 用 `Map<gameId, haystack>` 缓存结果，
  避免每次按键都重算拼音；缓存超 2000 条时清空。
- 搜索在 `filterGames`（`selectors.ts`）中调用，与平台/类型等过滤器串联。

### 交互验证示例

| 输入 | 能搜到 |
| --- | --- |
| `gta` | Grand Theft Auto V |
| `三男一狗` / `车枪大战` | GTA V（若已录入别名） |
| `xjzb` | 星际争霸 |
| `xingjizhengba` | 星际争霸 |
| `shooter` | 含 "shooter" 类型的游戏 |

### 依赖

- `pinyin-pro`（^3.x），已加入 `package.json`。
