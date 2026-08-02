// Settings store, loaded/saved through the backend.

import { create } from "zustand";
import { api } from "../api/client";
import type { AppSettings, Platform } from "../types/models";

const DEFAULT_SETTINGS: AppSettings = {
  startupBehavior: "StartNormal",
  enableTray: true,
  minimizeToTray: false,
  closeToTray: false,
  theme: "Default",
  language: "en-US",
  firstTimeWizardComplete: false,
  databasePath: undefined,
  autoBackupEnabled: true,
  gridViewImage: "Cover",
  detailsViewImage: "Background",
  listViewImage: "Icon",
  showInstalledOnly: false,
  showHidden: false,
  showFavorites: false,
  sortOrder: "Name",
  sortDirection: "Ascending",
  fullscreenMode: false,
  controllerSupport: false,
  loginEnabled: false,
  loginType: "wechat",
  loggedIn: false,
  username: undefined,
};

interface SettingsState {
  settings: AppSettings;
  platforms: Platform[];
  loaded: boolean;

  load: () => Promise<void>;
  save: (s: Partial<AppSettings>) => Promise<void>;
  loadPlatforms: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  platforms: [],
  loaded: false,

  load: async () => {
    const settings = await api.getSettings();
    set({ settings, loaded: true });
  },

  save: async (partial) => {
    const next = { ...get().settings, ...partial };
    const saved = await api.saveSettings(next);
    set({ settings: saved });
  },

  loadPlatforms: async () => {
    const platforms = await api.getPlatforms();
    set({ platforms });
  },
}));
