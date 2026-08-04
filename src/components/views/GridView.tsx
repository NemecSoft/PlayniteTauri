// Grid view: 16:9 cover cards grouped by the active grouping.
// Each card shows the cover (GIF supported) plus Play and Details buttons.
// Cover images load lazily via IntersectionObserver so a 1000+ game library
// does not flood the IPC bridge at startup.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGamesStore } from "../../stores/gamesStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Group } from "../../utils/selectors";
import type { Game } from "../../types/models";
import { displayName } from "../../utils/display";
import { imageUrl } from "../../utils/assets";
import { useI18n } from "../../i18n";
import { Image as ImageIcon, Play, Info } from "lucide-react";
import GameContextMenu from "../GameContextMenu";
import { useLazyImage } from "../../hooks/useLazyImage";

interface Props {
  groups: Group[];
}

export default function GridView({ groups }: Props) {
  const navigate = useNavigate();
  const selected = useGamesStore((s) => s.selectedGameIds);
  const selectGame = useGamesStore((s) => s.selectGame);
  const launchGame = useGamesStore((s) => s.launchGame);
  const cardWidth = useSettingsStore((s) => s.settings.cardWidth);
  const cardGap = useSettingsStore((s) => s.settings.cardGap);

  const [menu, setMenu] = useState<{ game: Game; x: number; y: number } | null>(null);

  const openDetails = (game: Game) => navigate(`/game/${game.id}`);

  // Dynamic grid columns based on the configured card width & gap.
  const gap = Math.max(0, Math.min(20, cardGap ?? 8));
  const gridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(120, cardWidth || 180)}px, 1fr))`,
    gap: `${gap}px`,
  } as React.CSSProperties;

  return (
    <div className="content">
      {groups.map((group) => (
        <div className="group-section" key={group.key}>
          <div className="group-header">
            {group.label}
            <span className="count">{group.games.length}</span>
          </div>
          <div className="game-grid" style={gridStyle}>
            {group.games.map((game) => (
              <GridCard
                key={game.id}
                game={game}
                selected={selected.includes(game.id)}
                onSelect={(multi) => selectGame(game.id, multi)}
                onLaunch={() => launchGame(game.id)}
                onDetails={() => openDetails(game)}
                onContextMenu={(x, y) => setMenu({ game, x, y })}
              />
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
        />
      )}
    </div>
  );
}

function GridCard({
  game,
  selected,
  onSelect,
  onLaunch,
  onDetails,
  onContextMenu,
}: {
  game: Game;
  selected: boolean;
  onSelect: (multi: boolean) => void;
  onLaunch: () => void;
  onDetails: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const { t } = useI18n();
  const { ref: coverRef } = useLazyImage(game.coverImage);
  // imageUrl() is synchronous: it returns the cached blob URL or undefined.
  // While the IntersectionObserver hasn't fired yet, the placeholder is
  // shown. Once the card scrolls near, ensureImageLoaded() warms the cache
  // and a re-render swaps in the real image with a fade-in.
  const src = imageUrl(game.coverImage);

  return (
    <div
      className={`grid-card ${selected ? "selected" : ""}`}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
    >
      <div className="cover" ref={coverRef as unknown as React.Ref<HTMLDivElement>}>
        {src ? (
          <img src={src} alt={game.name} loading="lazy" decoding="async" />
        ) : (
          <div className="placeholder">
            <ImageIcon size={30} />
          </div>
        )}
        {game.installed && <span className="installed-dot" />}
        <div className="cover-actions">
          <button
            className="cover-btn play"
            title={t("grid_play")}
            onClick={(e) => {
              e.stopPropagation();
              onLaunch();
            }}
          >
            <Play size={16} fill="currentColor" />
            <span>{t("grid_play")}</span>
          </button>
          <button
            className="cover-btn details"
            title={t("grid_details")}
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
          >
            <Info size={16} />
            <span>{t("grid_details")}</span>
          </button>
        </div>
      </div>
      <div className="title">{displayName(game)}</div>
      {(game.localizedNames?.length || game.alternateNames?.length) ? (
        <div
          className="alt-names"
          title={[
            ...((game.localizedNames || []).map((ln) => `${ln.language}: ${ln.name}`)),
            ...((game.alternateNames || [])),
          ].join("\n")}
        >
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
  );
}
