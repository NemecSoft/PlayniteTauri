// Grid view: cover cards grouped by the active grouping.

import { useState } from "react";
import { useGamesStore } from "../../stores/gamesStore";
import type { Group } from "../../utils/selectors";
import type { Game } from "../../types/models";
import { displayName } from "../../utils/display";
import { Image as ImageIcon, Star } from "lucide-react";
import GameContextMenu from "../GameContextMenu";
import GameEditModal from "../GameEditModal";

interface Props {
  groups: Group[];
}

export default function GridView({ groups }: Props) {
  const selected = useGamesStore((s) => s.selectedGameIds);
  const selectGame = useGamesStore((s) => s.selectGame);
  const launchGame = useGamesStore((s) => s.launchGame);

  const [menu, setMenu] = useState<{ game: Game; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<Game | null>(null);

  return (
    <div className="content">
      {groups.map((group) => (
        <div className="group-section" key={group.key}>
          <div className="group-header">
            {group.label}
            <span className="count">{group.games.length}</span>
          </div>
          <div className="game-grid">
            {group.games.map((game) => (
              <div
                key={game.id}
                className={`grid-card ${selected.includes(game.id) ? "selected" : ""}`}
                onClick={(e) => selectGame(game.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => launchGame(game.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ game, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="cover">
                  {game.coverImage ? (
                    <img src={game.coverImage} alt={game.name} />
                  ) : (
                    <div className="placeholder">
                      <ImageIcon size={30} />
                    </div>
                  )}
                  {game.favorite && (
                    <span className="fav-flag">
                      <Star size={14} fill="currentColor" />
                    </span>
                  )}
                  {game.installed && <span className="installed-dot" />}
                </div>
                <div className="title">{displayName(game)}</div>
                {(game.localizedNames?.length || game.alternateNames?.length) ? (
                  <div className="alt-names" title={[
                    ...((game.localizedNames || []).map((ln) => `${ln.language}: ${ln.name}`)),
                    ...((game.alternateNames || [])),
                  ].join("\n")}>
                    {game.localizedNames?.slice(0, 1).map((ln) => (
                      <span className="alt-name" key={ln.language}>{ln.name}</span>
                    ))}
                    {game.alternateNames?.slice(0, 1).map((alt) => (
                      <span className="alt-name alias" key={alt}>{alt}</span>
                    ))}
                    {((game.localizedNames?.length || 0) + (game.alternateNames?.length || 0)) > 2 ? (
                      <span className="alt-name more">
                        +{((game.localizedNames?.length || 0) + (game.alternateNames?.length || 0)) - 2}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      {menu && (
        <GameContextMenu
          game={menu.game}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setEditing(menu.game);
            setMenu(null);
          }}
        />
      )}
      {editing && <GameEditModal game={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
