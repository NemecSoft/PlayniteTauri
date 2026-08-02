// Details view: shows the first selected game with full metadata and a play button.

import { useMemo, useState } from "react";
import { useGamesStore } from "../../stores/gamesStore";
import type { Group } from "../../utils/selectors";
import { Play, Star, Pencil, Image as ImageIcon } from "lucide-react";
import GameEditModal from "../GameEditModal";
import { useI18n } from "../../i18n";

function formatPlaytime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

interface Props {
  groups: Group[];
}

export default function DetailsView({ groups }: Props) {
  const allGames = groups.flatMap((g) => g.games);
  const selectedIds = useGamesStore((s) => s.selectedGameIds);
  const launchGame = useGamesStore((s) => s.launchGame);
  const toggleFavorite = useGamesStore((s) => s.toggleFavorite);
  const { t } = useI18n();

  const [showEdit, setShowEdit] = useState(false);

  const selected = useMemo(
    () => allGames.find((g) => g.id === selectedIds[0]) || allGames[0],
    [allGames, selectedIds]
  );

  if (!selected) return null;

  return (
    <div className="content">
      <div className="details-view">
        <div className="cover-panel">
          {selected.coverImage || selected.backgroundImage ? (
            <img src={selected.coverImage || selected.backgroundImage} alt={selected.name} />
          ) : (
            <div
              className="placeholder"
              style={{
                width: "100%",
                aspectRatio: "3/4",
                display: "grid",
                placeItems: "center",
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-dim)",
              }}
            >
              <ImageIcon size={48} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={() => toggleFavorite(selected.id)}>
              <Star size={15} fill={selected.favorite ? "currentColor" : "none"} color={selected.favorite ? "var(--warning)" : "inherit"} />
              {selected.favorite ? t("details_favorited") : t("details_favorite")}
            </button>
            <button className="btn" onClick={() => setShowEdit(true)}>
              <Pencil size={15} /> {t("details_edit")}
            </button>
          </div>
        </div>

        <div className="info">
          <h1>{selected.name}</h1>
          <div className="meta">
            {selected.developer.join(", ") || t("details_unknownDeveloper")}
            {selected.releaseDate ? ` • ${new Date(selected.releaseDate).getFullYear()}` : ""}
            {selected.installed ? ` • ${t("details_installed")}` : ` • ${t("details_notInstalled")}`}
          </div>

          <button className="play-btn" onClick={() => launchGame(selected.id)}>
            <Play size={16} fill="currentColor" /> {t("details_play")}
          </button>

          {selected.communityScore != null && (
            <span className="score-badge" style={{ marginRight: 8 }}>
              {t("details_score", { score: selected.communityScore })}
            </span>
          )}
          {selected.playtime > 0 && (
            <span style={{ color: "var(--text-secondary)" }}>
              {t("details_played", {
                time: formatPlaytime(selected.playtime),
                count: selected.playCount,
              })}
            </span>
          )}

          <div className="section" style={{ marginTop: 14 }}>
            <h3>{t("details_platforms")}</h3>
            <div className="chip-list">
              {selected.platform.map((p) => (
                <span className="chip" key={p}>
                  {p}
                </span>
              ))}
              {selected.platform.length === 0 && <span className="chip">{t("details_unknown")}</span>}
            </div>
          </div>

          {selected.genre.length > 0 && (
            <div className="section">
              <h3>{t("details_genres")}</h3>
              <div className="chip-list">
                {selected.genre.map((g) => (
                  <span className="chip" key={g}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selected.tags.length > 0 && (
            <div className="section">
              <h3>{t("details_tags")}</h3>
              <div className="chip-list">
                {selected.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selected.publisher.length > 0 && (
            <div className="section">
              <h3>{t("details_publisher")}</h3>
              <div>{selected.publisher.join(", ")}</div>
            </div>
          )}

          {selected.description && (
            <div className="section">
              <h3>{t("details_description")}</h3>
              <div className="description">{selected.description}</div>
            </div>
          )}

          {selected.installDirectory && (
            <div className="section">
              <h3>{t("details_installLocation")}</h3>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{selected.installDirectory}</div>
            </div>
          )}
        </div>
      </div>

      {showEdit && <GameEditModal game={selected} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
