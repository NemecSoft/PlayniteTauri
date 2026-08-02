// Left sidebar: library quick-filters and filterable facets.

import {
  LayoutGrid,
  Star,
  Layers,
  Gamepad2,
  Tag,
  Folder,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useGamesStore } from "../stores/gamesStore";
import { useLibraryStore } from "../stores/libraryStore";
import { useI18n } from "../i18n";

export default function Sidebar() {
  const games = useGamesStore((s) => s.games);
  const activePage = useGamesStore((s) => s.activePage);
  const setPage = useGamesStore((s) => s.setPage);
  const showHidden = useGamesStore((s) => s.showHidden);
  const showFavorites = useGamesStore((s) => s.showFavorites);
  const toggleHidden = useGamesStore((s) => s.toggleHidden);
  const toggleFavorites = useGamesStore((s) => s.toggleFavorites);
  const activePlatform = useGamesStore((s) => s.activePlatformFilter);
  const setPlatformFilter = useGamesStore((s) => s.setPlatformFilter);
  const activeCategory = useGamesStore((s) => s.activeCategoryFilter);
  const setCategoryFilter = useGamesStore((s) => s.setCategoryFilter);
  const activeGenre = useGamesStore((s) => s.activeGenreFilter);
  const setGenreFilter = useGamesStore((s) => s.setGenreFilter);
  const activeDeveloper = useGamesStore((s) => s.activeDeveloperFilter);
  const setDeveloperFilter = useGamesStore((s) => s.setDeveloperFilter);
  const scanSteam = useLibraryStore((s) => s.scanSteam);
  const reloadGames = useGamesStore((s) => s.load);
  const { t } = useI18n();

  const categories = Array.from(new Set(games.flatMap((g) => g.category)));
  const genres = Array.from(new Set(games.flatMap((g) => g.genre)));
  const platforms = Array.from(new Set(games.flatMap((g) => g.platform)));
  const developers = Array.from(new Set(games.flatMap((g) => g.developer)));

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <button
          className={`sidebar-item ${activePage === "news" ? "active" : ""}`}
          onClick={() => setPage(activePage === "news" ? "library" : "news")}
        >
          <Sparkles size={16} />
          {t("news_title")}
        </button>
        <button
          className={`sidebar-item ${activePage !== "news" && !showFavorites && !showHidden ? "active" : ""}`}
          onClick={() => {
            setPage("library");
            toggleFavorites();
          }}
        >
          <LayoutGrid size={16} />
          {t("sidebar_allGames")}
          <span className="count">{games.length}</span>
        </button>
        <button
          className={`sidebar-item ${showFavorites ? "active" : ""}`}
          onClick={() => {
            setPage("library");
            toggleFavorites();
          }}
        >
          <Star size={16} />
          {t("sidebar_favorites")}
        </button>
        <button
          className={`sidebar-item ${showHidden ? "active" : ""}`}
          onClick={() => {
            setPage("library");
            toggleHidden();
          }}
        >
          <Layers size={16} />
          {t("sidebar_hidden")}
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">
          <Gamepad2 size={14} />
          {t("sidebar_platforms")}
        </div>
        {platforms.map((p) => (
          <button
            key={p}
            className={`sidebar-item small ${activePlatform === p ? "active" : ""}`}
            onClick={() => {
              setPage("library");
              setPlatformFilter(activePlatform === p ? "all" : p);
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">
          <Folder size={14} />
          {t("sidebar_categories")}
        </div>
        {categories.map((c) => (
          <button
            key={c}
            className={`sidebar-item small ${activeCategory === c ? "active" : ""}`}
            onClick={() => {
              setPage("library");
              setCategoryFilter(activeCategory === c ? "all" : c);
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">
          <Tag size={14} />
          {t("sidebar_genres")}
        </div>
        {genres.map((g) => (
          <button
            key={g}
            className={`sidebar-item small ${activeGenre === g ? "active" : ""}`}
            onClick={() => {
              setPage("library");
              setGenreFilter(activeGenre === g ? "all" : g);
            }}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">
          <Layers size={14} />
          {t("sidebar_developers")}
        </div>
        {developers.map((d) => (
          <button
            key={d}
            className={`sidebar-item small ${activeDeveloper === d ? "active" : ""}`}
            onClick={() => {
              setPage("library");
              setDeveloperFilter(activeDeveloper === d ? "all" : d);
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button
          className="btn primary block"
          onClick={async () => {
            await scanSteam();
            await reloadGames();
          }}
        >
          <RefreshCw size={14} />
          {t("sidebar_scanLibrary")}
        </button>
      </div>
    </aside>
  );
}
