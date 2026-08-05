// Videos tab: lists every video attached to the library's games.
// A game's videos come from the `videos` field on the Game model
// (type: "youtube" | "file" | "url").

import { useMemo } from "react";
import { Clapperboard, Play, ExternalLink } from "lucide-react";
import { useGamesStore } from "../../stores/gamesStore";
import { displayName } from "../../utils/display";
import { imageUrl } from "../../utils/assets";
import { useI18n } from "../../i18n";
import type { GameVideo } from "../../types/models";

interface VideoEntry {
  gameId: string;
  gameName: string;
  cover?: string | null;
  video: GameVideo;
}

/** Convert a YouTube watch URL to its embeddable form. */
function toEmbedUrl(v: GameVideo): string | null {
  if (v.type === "youtube") {
    try {
      const u = new URL(v.url);
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        let id = u.searchParams.get("v");
        if (!id && u.hostname.includes("youtu.be")) {
          id = u.pathname.split("/").filter(Boolean)[0] || null;
        }
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
    } catch {
      /* fall through */
    }
    return null;
  }
  // Local files / generic URLs: can't embed reliably here, show as a link.
  return null;
}

export default function VideosView() {
  const games = useGamesStore((s) => s.games);
  const { t } = useI18n();

  const entries = useMemo<VideoEntry[]>(() => {
    const out: VideoEntry[] = [];
    for (const g of games) {
      if (g.hidden || !g.videos || g.videos.length === 0) continue;
      for (const video of g.videos) {
        out.push({
          gameId: g.id,
          gameName: displayName(g),
          cover: g.coverImage || g.icon,
          video,
        });
      }
    }
    return out;
  }, [games]);

  return (
    <div className="content">
      <div className="videos-header">
        <Clapperboard size={22} color="var(--accent)" />
        <h2>{t("videos_title")}</h2>
        <span className="count">{entries.length}</span>
      </div>

      {entries.length === 0 && (
        <div className="empty-state">
          <div className="big-icon">
            <Clapperboard size={48} />
          </div>
          {t("videos_empty")}
        </div>
      )}

      <div className="videos-grid">
        {entries.map((entry, idx) => {
          const embed = toEmbedUrl(entry.video);
          const videoName = entry.video.name || entry.gameName;
          return (
            <div className="video-card" key={`${entry.gameId}-${idx}`}>
              <div className="video-thumb">
                {embed ? (
                  <iframe
                    src={embed}
                    title={videoName}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <div className="video-thumb-fallback">
                    {entry.cover ? (
                      <img src={imageUrl(entry.cover)} alt={videoName} />
                    ) : (
                      <Play size={40} />
                    )}
                    <span className="video-file-badge">
                      <ExternalLink size={12} /> {entry.video.type}
                    </span>
                  </div>
                )}
              </div>
              <div className="video-info">
                <span className="video-name" title={videoName}>
                  {videoName}
                </span>
                <span className="video-game" title={entry.gameName}>
                  {entry.gameName}
                </span>
              </div>
              {!embed && entry.video.url && (
                <a
                  className="video-open-link"
                  href={entry.video.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("videos_open")}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
