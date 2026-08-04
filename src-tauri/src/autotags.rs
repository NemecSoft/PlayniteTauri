//! Auto-generate user-visible tags for a game based on its display name.
//!
//! Used both at import time (`import_game_catalog`) and by the "重新生成标签"
//! command to refresh tags on existing library entries. Keywords cover common
//! Chinese / English descriptors found in cafe-game titles.

/// One auto-tag: the tag label users see, and the substrings (case
/// insensitive) that, when found in the game name, cause this tag to be added.
const AUTO_TAGS: &[(&str, &[&str])] = &[
    // Masterpiece / big-budget / classic
    ("神作", &["神作", "masterpiece", "classic", "经典"]),
    ("大作", &["大作", " AAA", "3A ", "AAA"]),

    // Connectivity / social
    ("联机", &["联机", "联网", "online", "Online", "OL ", "OL版", "online版", "网络版"]),
    ("多人", &["多人", "multiplayer", "multi-player", "multi player"]),
    ("合作", &["合作", "co-op", "coop", "COOP", "Co-op"]),
    ("PVP", &["PVP", "pvp", "对战", "玩家对战"]),
    ("PVE", &["PVE", "pve"]),

    // Tone / mood
    ("恐怖", &["恐怖", "horror", "HORROR", "惊悚", "scary", "鬼", "僵尸", "Zombie", "zombie"]),
    ("血腥", &["血腥", "blood", "暴力"]),

    // Camera / perspective
    ("第一人称", &["第一人称", "FPS ", "FPS版", "1st person", "first-person", "first person", " 1P ", "1P版"]),
    ("第三人称", &["第三人称", "TPS", "third-person", "third person"]),
    ("俯视角", &["俯视角", "俯视", "top-down", "top down", "topdown", " isometric", "等距", "上帝视角", "鸟瞰"]),

    // Visual style
    ("2D", &["2D ", "2D版", "2D横版", "横版", "横屏", "side-scroller", "横版过关"]),
    ("3D", &["3D ", "3D版"]),
    ("像素", &["像素", "pixel", "Pixel", "8-bit", "8bit", "复古像素"]),
    ("复古", &["复古", "retro", "Retro"]),

    // Origin / scope
    ("独立", &["独立", "indie", "Indie", "国产独立"]),
    ("国产", &["国产", "中国", "chinese", "国服", "国行"]),

    // Genre
    ("RPG", &["RPG", "rpg", "角色扮演", "ARPG"]),
    ("动作", &["动作", "Action", "ACT", "act "]),
    ("射击", &["射击", "shooter", "Shooter", "STG", "枪战", "狙击", "狙击手"]),
    ("策略", &["策略", "Strategy", "strategy", "战略"]),
    ("模拟", &["模拟", "Simulation", "simulation", "SIM", "模拟器"]),
    ("冒险", &["冒险", "Adventure", "adventure", "AVG", "avg"]),
    ("解谜", &["解谜", "Puzzle", "puzzle", "益智", "密室"]),
    ("竞速", &["竞速", "赛车", "racing", "Racing", "race", "Race", "driving", "Driving", "GT ", "卡丁车", "拉力"]),
    ("格斗", &["格斗", "Fighting", "fighting", "FTG", "ftg", "拳皇", "对战格斗"]),
    ("平台跳跃", &["平台跳跃", "platformer", "Platformer"]),
    ("回合制", &["回合制", "turn-based", "Turn-Based", "回合"]),
    ("即时战略", &["即时战略", "RTS", "rts", "real-time", "real time"]),
    ("卡牌", &["卡牌", "Card", "card", "TCG", "tcg", "集换", "卡组"]),
    ("生存", &["生存", "Survival", "survival"]),
    ("沙盒", &["沙盒", "sandbox", "Sandbox"]),
    ("开放世界", &["开放世界", "open world", "Open World", "openworld"]),
    ("休闲", &["休闲", "Casual", "casual", "轻松"]),
    ("竞技", &["竞技", "competitive", "Competitive", "电竞赛", "锦标赛"]),
    ("弹幕", &["弹幕", "bullet hell", "Bullet Hell", "STG", "弹幕射击"]),
    ("塔防", &["塔防", "tower defense", "Tower Defense", "TD "]),
    ("肉鸽", &["肉鸽", "Rogue", "rogue", "Rougelike", "Roguelike", "Rogue-like", "Rogue-like"]),
    ("挂机", &["挂机", "idle", "Idle", "放置"]),
    ("模拟经营", &["模拟经营", "tycoon", "Tycoon", "经理", "管理", "经营"]),
    ("战棋", &["战棋", "SRPG", "srpg", "战术", "战棋版", "棋盘"]),
    ("音乐", &["音乐", "Music", "music", "节奏", "Rhythm"]),
    ("体育", &["体育", "Sports", "sports", "足球", "篮球", "FIFA", "NBA", "棒球", "高尔夫"]),
    ("恋爱", &["恋爱", "Romance", "romance", "GAL", "galgame", "Galgame", "视觉小说", "VN "]),
    ("动漫", &["动漫", "Anime", "anime", "二次元"]),
    ("教育", &["教育", "Education", "education", "儿童", "Kids", "kids"]),
    ("模拟飞行", &["飞行模拟", "flight sim", "Flight Sim", "模拟飞行"]),
    ("武侠", &["武侠", "江湖", "仙侠", "修真", "古风", "中国风"]),
    ("三国", &["三国", "Three Kingdoms", "ThreeKingdoms", "三国志"]),
    ("二战", &["二战", "WWII", "WW2", "World War"]),
    ("科幻", &["科幻", "Sci-Fi", "sci-fi", "sci fi", "未来", "太空"]),
    ("魔幻", &["魔幻", "Fantasy", "fantasy", "魔法", "巫师", "龙与"]),
    ("都市", &["都市", "Modern", "城市", "city"]),
    ("僵尸", &["僵尸", "Zombie", "zombie", "末日"]),
    ("忍者", &["忍者", "Ninja", "ninja", "武士", "Samurai"]),
    ("海盗", &["海盗", "Pirate", "pirate"]),
    ("赛车", &["赛车", "Racing", "racing", "GT", "卡丁"]),
    ("桌游", &["桌游", "Board Game", "boardgame", "棋盘"]),
    ("麻将", &["麻将", "Mahjong", "mahjong"]),
    ("扑克", &["扑克", "Poker", "poker"]),
];

/// Produce a de-duplicated list of auto-tags for the given game name (and
/// optionally its existing categories/genres to seed the matcher).
pub fn auto_tags_for(name: &str) -> Vec<String> {
    let lower = name.to_lowercase();
    let mut out: Vec<String> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (tag, kws) in AUTO_TAGS {
        let hit = kws.iter().any(|kw| {
            let kl = kw.to_lowercase();
            // Use plain substring match (case insensitive via the lowered view).
            if kl.chars().all(|c| c.is_ascii()) {
                lower.contains(&kl)
            } else {
                name.contains(kw)
            }
        });
        if hit && seen.insert(tag.to_string()) {
            out.push((*tag).to_string());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finds_known_tags() {
        let tags = auto_tags_for("绝地潜兵1-网吧联机版");
        assert!(tags.contains(&"联机".to_string()));
    }
    #[test]
    fn no_dup() {
        let tags = auto_tags_for("Co-op Online multiplayer");
        let mut uniq = tags.clone();
        uniq.sort();
        uniq.dedup();
        assert_eq!(tags.len(), uniq.len());
    }
}