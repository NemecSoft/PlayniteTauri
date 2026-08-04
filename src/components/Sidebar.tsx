// Left sidebar: only the tag list (no title, no search box, no collapse
// button). Auto-hides on mouseleave; re-appears when the user moves the mouse
// onto the vertical hint strip on the left edge.

import { useMemo } from "react";
import { useGamesStore } from "../stores/gamesStore";
import { useI18n } from "../i18n";

export default function Sidebar() {
  const games = useGamesStore((s) => s.games);
  const selectedTags = useGamesStore((s) => s.selectedTags);
  const toggleTag = useGamesStore((s) => s.toggleTag);
  const sidebarVisible = useGamesStore((s) => s.sidebarVisible);
  const setSidebarVisible = useGamesStore((s) => s.setSidebarVisible);
  const { t } = useI18n();

  // Aggregate tags from all games with counts (sorted by frequency).
  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of games) {
      for (const tag of g.tags) {
        const k = tag.trim();
        if (!k) continue;
        map.set(k, (map.get(k) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [games]);

  return (
    <>
      <div
        className={`sidebar-handle ${sidebarVisible ? "hidden" : ""}`}
        onMouseEnter={() => setSidebarVisible(true)}
        onClick={() => setSidebarVisible(true)}
        title={t("sidebar_open")}
      >
        {t("sidebar_handle_hint")}
      </div>

      <aside
        className={`sidebar ${sidebarVisible ? "" : "collapsed"}`}
        onMouseLeave={() => setSidebarVisible(false)}
      >
        <div className="sidebar-tag-list">
          {tagStats.map(({ name, count }) => {
            const checked = selectedTags.includes(name);
            return (
              <label
                key={name}
                className={`sidebar-tag ${checked ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTag(name)}
                />
                <span className="sidebar-tag-name">#{name}</span>
                <span className="count">{count}</span>
              </label>
            );
          })}
          {tagStats.length === 0 && (
            <div className="sidebar-empty">{t("sidebar_noTags")}</div>
          )}
        </div>
      </aside>
    </>
  );
}