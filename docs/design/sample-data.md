# 示例游戏

## 目标

首次启动应用时，若游戏库为空，自动播种一组示例游戏，使用户"打开就能看到"丰富内容，
并能体验多名称 / 拼音搜索 / 三种视图等功能。

## 实现

- 模块：`src-tauri/src/sample_data.rs`，导出 `sample_games() -> Vec<Game>`。
- 在 `lib.rs` 的 `setup` 中调用：

```rust
if db.count_games().unwrap_or(0) == 0 {
    let _ = db.upsert_games(&sample_data::sample_games());
}
```

仅当数据库为空时播种，**不覆盖用户已有数据**。

## 示例游戏列表

| 游戏 | 英文名 | 本地化名（zh-CN） | 别名 | 类型 |
| --- | --- | --- | --- | --- |
| GTA V | Grand Theft Auto V | 侠盗猎车手V | 三男一狗 / 车枪大战 | 开放世界 / 动作 |
| 星际争霸II | StarCraft II | 星际争霸II | 星海争霸 | 即时战略 |
| 赛博朋克2077 | Cyberpunk 2077 | 赛博朋克2077 | 夜之城 | RPG / 开放世界 |
| 巫师3 | The Witcher 3 | 巫师3：狂猎 | 昆特牌启动器 | RPG / 动作 |
| 艾尔登法环 | Elden Ring | 艾尔登法环 | 老头环 | 魂系 / 开放世界 |
| 蔚蓝 | Celeste | 蔚蓝 | 蔚蓝 | 平台跳跃 |
| 哈迪斯 | Hades | 哈迪斯 | 黑帝斯 | Roguelike |

## 设计要点

- 每个示例游戏都包含 `localizedNames`（zh-CN / zh-TW / ja / ko）与 `alternateNames`，
  展示多名称能力，并让**拼音首字母搜索**（如 `xjzb` → 星际争霸）开箱即用。
- 每个游戏带一个 `URL` 类型的启动动作（指向商店页），无需安装即可体验"开始游戏"。
- `favorite` / `installed` / 评分等字段设置各异，便于展示筛选、排序与详情视图。
