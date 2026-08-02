// Library import & statistics store.

import { create } from "zustand";
import { api } from "../api/client";
import type { LibraryStats, ScannedGame } from "../types/models";

interface LibraryState {
  stats: LibraryStats | null;
  scanResults: ScannedGame[];
  scanning: boolean;
  importing: boolean;

  loadStats: () => Promise<void>;
  scanFolder: (path: string, depth?: number) => Promise<void>;
  scanSteam: () => Promise<void>;
  clearScan: () => void;
  importResults: () => Promise<number>;
  importScanned: (games: ScannedGame[]) => Promise<number>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  stats: null,
  scanResults: [],
  scanning: false,
  importing: false,

  loadStats: async () => {
    const stats = await api.libraryStats();
    set({ stats });
  },

  scanFolder: async (path, depth = 2) => {
    set({ scanning: true });
    const results = await api.scanDirectory(path, depth);
    set({ scanResults: results, scanning: false });
  },

  scanSteam: async () => {
    set({ scanning: true });
    const results = await api.scanSteam();
    set({ scanResults: results, scanning: false });
  },

  clearScan: () => set({ scanResults: [] }),

  importResults: async () => {
    set({ importing: true });
    const n = await api.importScannedGames(get().scanResults);
    set({ scanResults: [], importing: false });
    return n;
  },

  importScanned: async (games) => {
    set({ importing: true });
    const n = await api.importScannedGames(games);
    set({ importing: false });
    return n;
  },
}));
