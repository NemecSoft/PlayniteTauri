// Main content area: renders the active top-level tab.
//   home   -> toolbar + library views (grid/list/details) or news page
//   videos -> videos tab
//   tools  -> extra tools tab

import Toolbar from "./Toolbar";
import GamesView from "./views/GamesView";
import NewsView from "./views/NewsView";
import VideosView from "./views/VideosView";
import ToolsView from "./views/ToolsView";
import { useGamesStore } from "../stores/gamesStore";
import { useUIStore } from "../stores/uiStore";

export default function MainContent() {
  const loading = useGamesStore((s) => s.loading);
  const activePage = useGamesStore((s) => s.activePage);
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <main className="main-area">
      {activeTab === "videos" ? (
        <VideosView />
      ) : activeTab === "tools" ? (
        <ToolsView />
      ) : activePage === "news" ? (
        <NewsView />
      ) : (
        <>
          <Toolbar />
          {loading ? (
            <div className="center-loading">
              <div className="spinner" />
            </div>
          ) : (
            <GamesView />
          )}
        </>
      )}
    </main>
  );
}
