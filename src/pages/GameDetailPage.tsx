// Game detail page (route /game/:id).
// Rich HTML content: play button, description, developer / release date /
// rating, how-to-play guide (HTML), screenshot gallery (GIF supported) and
// gameplay videos. Fully localized via i18n.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGamesStore } from "../stores/gamesStore";
import { useI18n } from "../i18n";
import { api } from "../api/client";
import { ArrowLeft } from "lucide-react";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const games = useGamesStore((s) => s.games);

  const game = useMemo(() => games.find((g) => g.id === id), [games, id]);

  // Every game links to its standalone static detail page
  // (Game_Details/<游戏名>/index.html), served by the `yungame-game://` custom
  // scheme so the webview natively loads css/js/images and handles anchors.
  // If none exists, show a 404.
  const [htmlFound, setHtmlFound] = useState(false);
  const [htmlLoading, setHtmlLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState("");
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    setHtmlLoading(true);
    api
      .getGameHtmlPage(game.name)
      .then((r) => {
        if (!cancelled) {
          setHtmlFound(r.found);
          setHtmlLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtmlFound(false);
          setHtmlLoading(false);
        }
      });
    api
      .getGameServerUrl()
      .then((u) => {
        if (!cancelled) setServerUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Absolute URL for the game's page, served by the local HTTP server.
  const gamePageUrl =
    game && serverUrl
      ? `${serverUrl}/games/${encodeURIComponent(game.name)}/index.html`
      : "";

  if (!game) {
    return (
      <div className="detail-page">
        <button className="btn" onClick={() => navigate("/")}>
          <ArrowLeft size={15} /> {t("details_back")}
        </button>
        <div className="detail-not-found">{t("details_notFound")}</div>
      </div>
    );
  }

  // Every game links to Game_Details/<游戏名>/index.html:
  //  - loading  → brief spinner
  //  - found    → back button + the page (iframe)
  //  - missing  → back button + a 404 page
  const detailTopbar = (
    <div className="detail-topbar">
      <button className="btn" onClick={() => navigate("/")}>
        <ArrowLeft size={15} /> {t("details_back")}
      </button>
    </div>
  );

  if (htmlLoading) {
    return (
      <div className="detail-page detail-page-html">
        {detailTopbar}
        <div className="detail-loading">{t("details_loading")}</div>
      </div>
    );
  }

  if (htmlFound) {
    return (
      <div className="detail-page detail-page-html">
        {detailTopbar}
        <iframe
          className="detail-game-html-full"
          title={`${game.name} page`}
          src={gamePageUrl}
          // Allow the embedded static page's own player (DPlayer / <video> /
          // YouTube embed) to enter fullscreen. Without this, the browser
          // blocks `requestFullscreen()` inside a cross-origin iframe.
          allowFullScreen
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        />
      </div>
    );
  }

  // 404: no static page for this game.
  return (
    <div className="detail-page detail-page-html">
      {detailTopbar}
      <div className="detail-404">
        <div className="detail-404-code">404</div>
        <p>{t("details_page404", { name: game.name })}</p>
        <p className="detail-404-hint">{t("details_page404hint")}</p>
      </div>
    </div>
  );
}
