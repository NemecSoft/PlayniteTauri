// List view: sortable table grouped by the active grouping.

import { useGamesStore } from "../../stores/gamesStore";
import type { Group } from "../../utils/selectors";
import { displayName } from "../../utils/display";
import { Star, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { useI18n } from "../../i18n";

interface Props {
  groups: Group[];
}

function formatPlaytime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function ListView({ groups }: Props) {
  const selected = useGamesStore((s) => s.selectedGameIds);
  const selectGame = useGamesStore((s) => s.selectGame);
  const launchGame = useGamesStore((s) => s.launchGame);
  const sortOrder = useGamesStore((s) => s.sortOrder);
  const sortDirection = useGamesStore((s) => s.sortDirection);
  const setSort = useGamesStore((s) => s.setSort);
  const { t } = useI18n();

  const arrow = (key: string) =>
    sortOrder === key ? (sortDirection === "ascending" ? "▲" : "▼") : "";

  return (
    <div className="content">
      {groups.map((group) => (
        <div className="group-section" key={group.key}>
          <div className="group-header">
            {group.label}
            <span className="count">{group.games.length}</span>
          </div>
          <table className="game-table">
            <thead>
              <tr>
                <th style={{ width: 50 }} />
                <th onClick={() => setSort("name", sortDirection)}>{t("list_name")} {arrow("name")}</th>
                <th onClick={() => setSort("platform" as any, sortDirection)}>{t("list_platform")}</th>
                <th>{t("list_genres")}</th>
                <th onClick={() => setSort("playtime", sortDirection)}>{t("list_playtime")} {arrow("playtime")}</th>
                <th onClick={() => setSort("lastPlayed", sortDirection)}>{t("list_lastPlayed")} {arrow("lastPlayed")}</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {group.games.map((game) => (
                <tr
                  key={game.id}
                  className={selected.includes(game.id) ? "selected" : ""}
                  onClick={(e) => selectGame(game.id, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => launchGame(game.id)}
                >
                  <td className="icon-cell">
                    {game.icon || game.coverImage ? (
                      <img src={game.icon || game.coverImage} alt="" />
                    ) : (
                      <div className="placeholder">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{game.favorite && <Star size={11} className="fav-star" fill="currentColor" style={{ marginRight: 4, verticalAlign: 1 }} />}
                      {displayName(game)}
                    </div>
                    {(game.localizedNames?.length || game.alternateNames?.length) ? (
                      <div className="list-alt-names" title={[
                        ...((game.localizedNames || []).map((ln) => `${ln.language}: ${ln.name}`)),
                        ...((game.alternateNames || [])),
                      ].join("\n")}>
                        {game.localizedNames?.slice(0, 2).map((ln) => (
                          <span className="alt-name" key={ln.language}>{ln.name}</span>
                        ))}
                        {game.alternateNames?.slice(0, 1).map((alt) => (
                          <span className="alt-name alias" key={alt}>{alt}</span>
                        ))}
                        {((game.localizedNames?.length || 0) + (game.alternateNames?.length || 0)) > 3 ? (
                          <span className="alt-name more">
                            +{((game.localizedNames?.length || 0) + (game.alternateNames?.length || 0)) - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td>{game.platform.join(", ") || "—"}</td>
                  <td>{game.genre.slice(0, 3).join(", ") || "—"}</td>
                  <td>{formatPlaytime(game.playtime)}</td>
                  <td>{game.lastPlayed ? new Date(game.lastPlayed).toLocaleDateString() : "—"}</td>
                  <td>{game.installed && <CheckCircle2 size={15} className="installed" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
