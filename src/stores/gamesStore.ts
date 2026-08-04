// Central store for games, view mode, filtering, sorting & selection.

import { create } from "zustand";
import { api } from "../api/client";
import { useAuthStore } from "./authStore";
import { preloadImages } from "../utils/assets";
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
  /** Tags checked in the sidebar (AND semantics: keep games that contain all of them). */
  selectedTags: string[];
  /** Whether the sidebar is expanded. Auto-hides by default. */
  sidebarVisible: boolean;

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
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  setSidebarVisible: (v: boolean) => void;
  toggleSidebar: () => void;
  clearFilters: () => void;
  selectGame: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  toggleFavorite: (id: string) => Promise<void>;
  toggleHiddenGame: (id: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  launchGame: (id: string) => Promise<boolean>;
  saveGame: (game: Game) => Promise<void>;
  rescanCovers: () => Promise<{ matched: number; coverFiles: number; considered: number; dirExists: boolean; dirPath: string }>;
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
  selectedTags: [],
  sidebarVisible: false,

  load: async () => {
    set({ loading: true });
    try {
      const games = await api.getGames();
      set({ games, loading: false, error: undefined });
      // Images load lazily via IntersectionObserver in the grid (see
      // GridView). We deliberately do NOT preload all covers at startup,
      // since a 1000+ game library would otherwise flood the backend IPC
      // and stall the UI for many seconds.
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
  toggleTag: (tag) =>
    set((s) => {
      const has = s.selectedTags.includes(tag);
      return {
        selectedTags: has ? s.selectedTags.filter((t) => t !== tag) : [...s.selectedTags, tag],
      };
    }),
  clearTags: () => set({ selectedTags: [] }),
  setSidebarVisible: (v) => set({ sidebarVisible: v }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
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
      selectedTags: [],
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
    const game = get().games.find((g) => g.id === id);
    if (game) {
      // Front-end access check (backend enforces too). Show a friendly toast
      // if the current user's level is too low to play this game.
      const canPlay = useAuthStore.getState().canPlay(game.gameLevel);
      if (!canPlay) {
        void api.showNotification(
          "等级不足",
          `你的用户等级（${useAuthStore.getState().userLevel}）无法游玩《${game.name}》`
        );
        return false;
      }
    }
    return api.launchGame(id);
  },

  saveGame: async (game) => {
    const before = get().games.find((g) => g.id === game.id);
    const saved = await api.saveGame(game);
    set({
      games: get().games.map((g) => (g.id === saved.id ? saved : g)),
    });
    // If the cover image changed, preload the new local image so the view
    // re-renders with the blob URL.
    if (before?.coverImage !== saved.coverImage && saved.coverImage) {
      void preloadImages([saved.coverImage]).then(() => {
        set({ games: [...get().games] });
      });
    }
  },

  rescanCovers: async () => {
    const res = await api.scanCovers();
    set({ games: res.games });
    // Image loading is handled lazily by GridView's IntersectionObserver;
    // no need to warm the entire cover cache after a rescan.
    return res.outcome;
  },
}));
