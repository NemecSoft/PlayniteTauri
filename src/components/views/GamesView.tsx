// Applies filtering / sorting / grouping and renders grid, list or details view.

import { useMemo } from "react";
import { useGamesStore } from "../../stores/gamesStore";
import { filterGames, sortGames, groupGames, type SortKey } from "../../utils/selectors";
import GridView from "./GridView";
import ListView from "./ListView";
import DetailsView from "./DetailsView";
import EmptyState from "./EmptyState";
import { useI18n } from "../../i18n";

export default function GamesView() {
  const { t } = useI18n();
  const games = useGamesStore((s) => s.games);
  const viewMode = useGamesStore((s) => s.viewMode);
  const searchQuery = useGamesStore((s) => s.searchQuery);
  const showInstalledOnly = useGamesStore((s) => s.showInstalledOnly);
  const showHidden = useGamesStore((s) => s.showHidden);
  const showFavorites = useGamesStore((s) => s.showFavorites);
  const sortOrder = useGamesStore((s) => s.sortOrder);
  const sortDirection = useGamesStore((s) => s.sortDirection);
  const groupBy = useGamesStore((s) => s.groupBy);
  const activePlatformFilter = useGamesStore((s) => s.activePlatformFilter);
  const activeCategoryFilter = useGamesStore((s) => s.activeCategoryFilter);
  const activeGenreFilter = useGamesStore((s) => s.activeGenreFilter);
  const activeDeveloperFilter = useGamesStore((s) => s.activeDeveloperFilter);

  const groups = useMemo(() => {
    const filtered = filterGames(games, {
      searchQuery,
      showInstalledOnly,
      showHidden,
      showFavorites,
      platformFilter: activePlatformFilter,
      categoryFilter: activeCategoryFilter,
      genreFilter: activeGenreFilter,
      developerFilter: activeDeveloperFilter,
    });
    const sorted = sortGames(filtered, sortOrder as SortKey, sortDirection);
    return groupGames(sorted, groupBy as any, {
      all: t("group_all"),
      unknown: t("group_unknown"),
      uncategorized: t("group_uncategorized"),
      manual: t("group_manual"),
      favorites: t("group_favorites"),
      other: t("group_other"),
    });
  }, [
    games,
    searchQuery,
    showInstalledOnly,
    showHidden,
    showFavorites,
    sortOrder,
    sortDirection,
    groupBy,
    activePlatformFilter,
    activeCategoryFilter,
    activeGenreFilter,
    activeDeveloperFilter,
    t,
  ]);

  const total = groups.reduce((acc, g) => acc + g.games.length, 0);

  if (total === 0) {
    return <EmptyState hasGames={games.length > 0} />;
  }

  if (viewMode === "grid") {
    return <GridView groups={groups} />;
  }
  if (viewMode === "list") {
    return <ListView groups={groups} />;
  }
  return <DetailsView groups={groups} />;
}
