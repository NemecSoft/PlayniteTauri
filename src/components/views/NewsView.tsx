// News / announcements page showing the most recently added games.
// Sorts all games by their `added` timestamp (newest first) and renders a
// vertical feed with cover, name, release date and a short description.

import { useMemo } from "react";
import { useGamesStore } from "../../stores/gamesStore";
import { displayName } from "../../utils/display";
import { Sparkles, CalendarDays, Play } from "lucide-react";
import { useI18n } from "../../i18n";

export default function NewsView() {
  const games = useGamesStore((s) => s.games);
  const launchGame = useGamesStore((s) => s.launchGame);
  const { t } = useI18n();

  // Newest first by `added`.
  const recent = useMemo(() => {
    return [...games]
      .filter((g) => !g.hidden)
      .sort((a, b) => {
        const ta = a.added ? new Date(a.added).getTime() : 0;
        const tb = b.added ? new Date(b.added).getTime() : 0;
        return tb - ta;
      });
  }, [games]);

  return (
    <div className="content">
      <div className="news-header">
        <Sparkles size={22} color="var(--accent)" />
        <h2>{t("news_title")}</h2>
        <span className="count">{recent.length}</span>
      </div>

      {recent.length === 0 && (
        <div className="empty-state">
          <div className="big-icon">
            <Sparkles size={48} />
          </div>
          {t("news_empty")}
        </div>
      )}

      <div className="news-feed">
        {recent.map((g) => (
          <div className="news-item" key={g.id}>
            <div className="news-cover">
              {g.coverImage || g.icon ? (
                <img src={g.coverImage || g.icon} alt={g.name} />
              ) : (
                <div className="placeholder">{g.name.charAt(0)}</div>
              )}
            </div>
            <div className="news-body">
              <div className="news-title-row">
                <span className="news-name">{displayName(g)}</span>
                {g.releaseDate && (
                  <span className="news-date">
                    <CalendarDays size={13} />
                    {new Date(g.releaseDate).getFullYear()}
                  </span>
                )}
              </div>
              <div className="news-meta">
                {g.developer.length > 0 && <span>{g.developer.join(", ")}</span>}
                {g.platform.length > 0 && <span>• {g.platform.join(", ")}</span>}
              </div>
              {g.description && <p className="news-desc">{g.description}</p>}
              <button className="btn primary small" onClick={() => launchGame(g.id)}>
                <Play size={14} fill="currentColor" /> {t("details_play")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
