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
import { Button } from "../components/ui/button";

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

  const backButton = (
    <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
      <ArrowLeft size={15} /> {t("details_back")}
    </Button>
  );

  if (!game) {
    return (
      <div className="h-full overflow-y-auto p-[16px_24px_48px]">
        {backButton}
        <div className="p-10 text-center text-dim">{t("details_notFound")}</div>
      </div>
    );
  }

  // Every game links to Game_Details/<游戏名>/index.html:
  //  - loading  → brief spinner
  //  - found    → back button + the page (iframe)
  //  - missing  → back button + a 404 page
  const detailTopbar = (
    <div className="flex items-center gap-2 border-b border-border bg-base px-5 py-3.5">
      {backButton}
    </div>
  );

  if (htmlLoading) {
    return (
      <div className="h-full overflow-y-auto">
        {detailTopbar}
        <div className="flex items-center justify-center p-10 text-sm text-secondary-text">
          {t("details_loading")}
        </div>
      </div>
    );
  }

  if (htmlFound) {
    return (
      <div className="h-full overflow-y-auto">
        {detailTopbar}
        <iframe
          className="block h-[calc(100vh-56px)] w-full border-0 bg-white"
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
    <div className="h-full overflow-y-auto">
      {detailTopbar}
      <div className="flex flex-col items-center p-10 text-center">
        <div className="mb-2 text-[72px] font-extrabold leading-none text-accent">404</div>
        <p className="m-0">{t("details_page404", { name: game.name })}</p>
        <p className="text-[13px] text-secondary-text">{t("details_page404hint")}</p>
      </div>
    </div>
  );
}
