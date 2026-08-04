// Game detail page (route /game/:id).
// Rich HTML content: play button, description, developer / release date /
// rating, how-to-play guide (HTML), screenshot gallery (GIF supported) and
// gameplay videos. Fully localized via i18n.

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGamesStore } from "../stores/gamesStore";
import { displayName } from "../utils/display";
import { imageUrl } from "../utils/assets";
import { useI18n } from "../i18n";
import {
  Play,
  ArrowLeft,
  CalendarDays,
  Gauge,
  Image as ImageIcon,
  Film,
  Building2,
} from "lucide-react";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const games = useGamesStore((s) => s.games);
  const launchGame = useGamesStore((s) => s.launchGame);

  const game = useMemo(() => games.find((g) => g.id === id), [games, id]);

  if (!game) {
    return (
      <div className="detail-page">
        <button className="btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> {t("details_back")}
        </button>
        <div className="detail-not-found">{t("details_notFound")}</div>
      </div>
    );
  }

  const screenshots = game.screenshots || [];
  const videos = game.videos || [];

  // Convert a YouTube watch URL to an embeddable URL.
  const embedYoutube = (url: string) => {
    const m = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  };

  return (
    <div className="detail-page">
      <div className="detail-topbar">
        <button className="btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> {t("details_back")}
        </button>
      </div>

      {/* Hero header with backdrop */}
      <div className="detail-hero">
        {imageUrl(game.backgroundImage) ? (
          <div
            className="detail-hero-bg"
            style={{ backgroundImage: `url(${imageUrl(game.backgroundImage)})` }}
          />
        ) : null}
        <div className="detail-hero-inner">
          <div className="detail-cover">
            {imageUrl(game.coverImage) ? (
              <img src={imageUrl(game.coverImage)} alt={game.name} />
            ) : (
              <div className="placeholder"><ImageIcon size={40} /></div>
            )}
          </div>
          <div className="detail-title-block">
            <h1>{displayName(game)}</h1>
            <div className="detail-meta">
              <span><Building2 size={14} /> {game.developer.join(", ") || t("details_unknown")}</span>
              {game.releaseDate && (
                <span><CalendarDays size={14} /> {new Date(game.releaseDate).toLocaleDateString()}</span>
              )}
              {game.communityScore != null && (
                <span className="score"><Gauge size={14} /> {game.communityScore}%</span>
              )}
              {game.ageRating.length > 0 && <span className="rating">{game.ageRating.join("/")}</span>}
              <span className={`inst ${game.installed ? "yes" : "no"}`}>
                {game.installed ? t("details_installed") : t("details_notInstalled")}
              </span>
            </div>
            <button className="detail-play" onClick={() => launchGame(game.id)}>
              <Play size={20} fill="currentColor" /> {t("details_play")}
            </button>
          </div>
        </div>
      </div>

      <div className="detail-body">
        {/* Description */}
        {game.description && (
          <section className="detail-section">
            <h2>{t("details_about")}</h2>
            <p className="detail-desc">{game.description}</p>
          </section>
        )}

        {/* Platform / genre chips */}
        <section className="detail-section">
          <h2>{t("details_info")}</h2>
          <div className="chip-list">
            {game.platform.map((p) => <span className="chip" key={p}>{p}</span>)}
            {game.genre.map((g) => <span className="chip" key={g}>{g}</span>)}
            {game.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
          </div>
        </section>

        {/* How-to-play guide (HTML) */}
        {game.guide && (
          <section className="detail-section">
            <h2>{t("details_howToPlay")}</h2>
            <div
              className="detail-guide"
              dangerouslySetInnerHTML={{ __html: game.guide }}
            />
          </section>
        )}

        {/* Screenshots gallery (GIF supported) */}
        {screenshots.length > 0 && (
          <section className="detail-section">
            <h2>{t("details_gallery")}</h2>
            <div className="detail-gallery">
              {screenshots.map((s, i) => (
                <div className="gallery-item" key={i}>
                  <img src={imageUrl(s)} alt={`screenshot ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Gameplay videos */}
        {videos.length > 0 && (
          <section className="detail-section">
            <h2><Film size={18} /> {t("details_videos")}</h2>
            <div className="detail-videos">
              {videos.map((v, i) => (
                <div className="video-item" key={i}>
                  <div className="video-label">{v.name || `${t("details_videos")} ${i + 1}`}</div>
                  {v.type === "youtube" ? (
                    <iframe
                      src={embedYoutube(v.url)}
                      title={v.name || "video"}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video src={v.url} controls />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
