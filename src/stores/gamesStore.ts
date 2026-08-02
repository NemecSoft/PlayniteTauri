// Central store for games, view mode, filtering, sorting & selection.

import { create } from "zustand";
import { api } from "../api/client";
import type { Game } from "../types/models";

export type ViewMode = "grid" | "list" | "details";
export type SortOrder = "name" | "added" | "lastPlayed" | "playtime" | "releaseDate";
export type SortDirection = "ascending" | "descending";

/** Top-level page shown in the main area: the game library or the news page. */
export type ActivePage = "library" | "news";

interface GamesState {
  games: Game[];
  loading: boolean;
  error?: string;

  activePage: ActivePage;
  selectedGameIds: string[];
  viewMode: ViewMode;
  searchQuery: string;
  sortOrder: SortOrder;
  sortDirection: SortDirection;
  showInstalledOnly: boolean;
  showHidden: boolean;
  showFavorites: boolean;
  groupBy: string;
  activePlatformFilter: string;
  activeCategoryFilter: string;
  activeGenreFilter: string;
  activeDeveloperFilter: string;

  // actions
  load: () => Promise<void>;
  setPage: (p: ActivePage) => void;
  setViewMode: (m: ViewMode) => void;
  setSearch: (q: string) => void;
  setSort: (o: SortOrder, d: SortDirection) => void;
  toggleInstalledOnly: () => void;
  toggleHidden: () => void;
  toggleFavorites: () => void;
  setGroupBy: (g: string) => void;
  setPlatformFilter: (p: string) => void;
  setCategoryFilter: (c: string) => void;
  setGenreFilter: (g: string) => void;
  setDeveloperFilter: (d: string) => void;
  clearFilters: () => void;
  selectGame: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  toggleFavorite: (id: string) => Promise<void>;
  toggleHiddenGame: (id: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  launchGame: (id: string) => Promise<boolean>;
  saveGame: (game: Game) => Promise<void>;
}

export const useGamesStore = create<GamesState>((set, get) => ({
  games: [],
  loading: false,

  activePage: "library",
  selectedGameIds: [],
  viewMode: "grid",
  searchQuery: "",
  sortOrder: "name",
  sortDirection: "ascending",
  showInstalledOnly: false,
  showHidden: false,
  showFavorites: false,
  groupBy: "none",
  activePlatformFilter: "all",
  activeCategoryFilter: "all",
  activeGenreFilter: "all",
  activeDeveloperFilter: "all",

  load: async () => {
    set({ loading: true });
    try {
      const games = await api.getGames();
      set({ games, loading: false, error: undefined });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setPage: (p) => set({ activePage: p }),
  setViewMode: (m) => set({ viewMode: m }),
  setSearch: (q) => set({ searchQuery: q }),
  setSort: (o, d) => set({ sortOrder: o, sortDirection: d }),
  toggleInstalledOnly: () => set((s) => ({ showInstalledOnly: !s.showInstalledOnly })),
  toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  toggleFavorites: () => set((s) => ({ showFavorites: !s.showFavorites })),
  setGroupBy: (g) => set({ groupBy: g }),
  setPlatformFilter: (p) => set({ activePlatformFilter: p }),
  setCategoryFilter: (c) => set({ activeCategoryFilter: c }),
  setGenreFilter: (g) => set({ activeGenreFilter: g }),
  setDeveloperFilter: (d) => set({ activeDeveloperFilter: d }),
  clearFilters: () =>
    set({
      searchQuery: "",
      showInstalledOnly: false,
      showHidden: false,
      showFavorites: false,
      activePlatformFilter: "all",
      activeCategoryFilter: "all",
      activeGenreFilter: "all",
      activeDeveloperFilter: "all",
    }),

  selectGame: (id, multi = false) =>
    set((s) => {
      if (multi) {
        const has = s.selectedGameIds.includes(id);
        return {
          selectedGameIds: has
            ? s.selectedGameIds.filter((x) => x !== id)
            : [...s.selectedGameIds, id],
        };
      }
      return { selectedGameIds: [id] };
    }),

  clearSelection: () => set({ selectedGameIds: [] }),

  toggleFavorite: async (id) => {
    const game = get().games.find((g) => g.id === id);
    if (!game) return;
    const updated = { ...game, favorite: !game.favorite, modified: new Date().toISOString() };
    await api.saveGame(updated);
    set({ games: get().games.map((g) => (g.id === id ? updated : g)) });
  },

  toggleHiddenGame: async (id) => {
    const game = get().games.find((g) => g.id === id);
    if (!game) return;
    const updated = { ...game, hidden: !game.hidden, modified: new Date().toISOString() };
    await api.saveGame(updated);
    set({ games: get().games.map((g) => (g.id === id ? updated : g)) });
  },

  deleteGame: async (id) => {
    await api.deleteGame(id);
    set({
      games: get().games.filter((g) => g.id !== id),
      selectedGameIds: get().selectedGameIds.filter((x) => x !== id),
    });
  },

  launchGame: async (id) => {
    return api.launchGame(id);
  },

  saveGame: async (game) => {
    const saved = await api.saveGame(game);
    set({
      games: get().games.map((g) => (g.id === saved.id ? saved : g)),
    });
  },
}));
