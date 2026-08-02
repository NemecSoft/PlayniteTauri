// Main content area: toolbar + active view (grid/list/details) or news page.

import Toolbar from "./Toolbar";
import GamesView from "./views/GamesView";
import NewsView from "./views/NewsView";
import { useGamesStore } from "../stores/gamesStore";

export default function MainContent() {
  const loading = useGamesStore((s) => s.loading);
  const activePage = useGamesStore((s) => s.activePage);

  return (
    <main className="main-area">
      {activePage === "news" ? (
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
