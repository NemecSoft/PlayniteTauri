// Typed API client for all backend commands.

import { call } from "./tauri";
import type {
  AppSettings,
  Game,
  LibraryPluginInfo,
  LibraryStats,
  Platform,
  ScannedGame,
} from "../types/models";

export const api = {
  // games
  getGames: () => call<Game[]>("get_games"),
  getGame: (id: string) => call<Game | null>("get_game", { id }),
  saveGame: (game: Game) => call<Game>("save_game", { payload: { game } }),
  deleteGame: (id: string) => call<void>("delete_game", { id }),
  launchGame: (id: string) => call<boolean>("launch_game", { id }),
  stopGameTracking: (id: string) => call<number>("stop_game_tracking", { id }),
  runningGames: () => call<{ gameId: string; gameName: string; startedAt: number }[]>("running_games"),

  // library
  scanDirectory: (root: string, depth?: number) =>
    call<ScannedGame[]>("scan_directory_command", { root, depth }),
  importScannedGames: (scanned: ScannedGame[]) =>
    call<number>("import_scanned_games", { scanned }),
  scanSteam: () => call<ScannedGame[]>("scan_steam_command"),
  importSteamGames: (games: ScannedGame[]) => call<number>("import_steam_games", { games }),
  libraryStats: () => call<LibraryStats>("library_stats"),

  // settings
  getSettings: () => call<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) => call<AppSettings>("save_settings", { settings }),
  getPlatforms: () => call<Platform[]>("get_platforms"),
  getBuiltinPlatforms: () => call<Platform[]>("get_builtin_platforms"),
  savePlatform: (platform: Platform) => call<Platform>("save_platform", { platform }),

  // plugins
  discoverPlugins: () => call<LibraryPluginInfo[]>("discover_plugins"),
  getPluginGames: () => call<Game[]>("get_plugin_games"),
  saveLibraryPlugin: (plugin: LibraryPluginInfo) =>
    call<LibraryPluginInfo>("save_library_plugin", { plugin }),
  deleteLibraryPlugin: (id: string) => call<void>("delete_library_plugin", { id }),

  // system
  getAppInfo: () => call<{ appName: string; version: string; os: string; arch: string }>("get_app_info"),
  minimizeWindow: () => call<void>("minimize_window"),
  maximizeWindow: () => call<boolean>("maximize_window"),
  closeWindow: () => call<void>("close_window"),
  hideWindow: () => call<void>("hide_window"),
  showWindow: () => call<void>("show_window"),
  showNotification: (title: string, body: string) => call<void>("show_notification", { title, body }),
  quit: () => call<void>("quit"),
};
