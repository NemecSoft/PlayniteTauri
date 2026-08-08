// Typed API client for all backend commands.

import { call } from "./tauri";
import type {
  AppSettings,
  CurrentUser,
  EnterprisePreview,
  Game,
  LibraryPluginInfo,
  LibraryStats,
  Platform,
  PublicUser,
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
  regenerateTags: () => call<number>("regenerate_tags"),

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

  // covers
  scanCovers: () =>
    call<{ games: Game[]; outcome: { matched: number; coverFiles: number; considered: number; dirExists: boolean; dirPath: string } }>("scan_covers"),
  getCoverDirInfo: () =>
    call<{ dirPath: string; dirExists: boolean; coverFiles: number; images: string[] }>("get_cover_dir_info"),
  readImage: (path: string) =>
    call<{ data: string; mime: string }>("read_image", { path }),
  readImagesBatch: (paths: string[]) =>
    call<Array<{ data: string; mime: string } | null>>("read_images_batch", { paths }),
  clearImageCache: () => call<number>("clear_image_cache"),

  // auth (client)
  getCurrentUser: () => call<CurrentUser>("get_current_user"),
  resolveEnterprise: () => call<CurrentUser | null>("resolve_enterprise"),
  loginPersonal: (account: string, password: string) =>
    call<CurrentUser | null>("login_personal", { account, password }),
  logout: () => call<void>("logout"),
  checkCanPlay: (gameLevel: number) => call<boolean>("check_can_play", { gameLevel }),
  getStatusBar: () =>
    call<{ localIp: string; publicIp: string; cafeName: string; cafeMatched: boolean; configPath: string; configExists: boolean }>("get_status_bar"),

  // admin
  adminListUsers: () => call<PublicUser[]>("admin_list_users"),
  adminSaveUser: (args: { id: string; account: string; name: string; level: number; password: string }) =>
    call<PublicUser>("admin_save_user", args),
  adminDeleteUser: (id: string) => call<void>("admin_delete_user", { id }),
  adminGetSettings: () => call<AppSettings>("admin_get_settings"),
  adminSetEnterpriseConfig: (configPath: string) =>
    call<AppSettings>("admin_set_enterprise_config", { configPath }),
  adminPreviewEnterprise: (configPath: string) =>
    call<EnterprisePreview>("admin_preview_enterprise", { configPath }),
  adminSetGameLevel: (gameId: string, level: number) =>
    call<void>("admin_set_game_level", { gameId, level }),

  // announcement
  getAnnouncement: () => call<{ html: string; fromFile: boolean }>("get_announcement"),

  // Check whether a game has a static detail page (Game_Details/<name>/index.html).
  // The page itself is loaded via the `yungame-game://` custom scheme.
  getGameHtmlPage: (name: string) =>
    call<{ name: string; found: boolean }>("get_game_html_page", { name }),

  // Base URL of the local HTTP server that serves Game_Details/ pages.
  getGameServerUrl: () => call<string>("get_game_server_url"),

  // system
  getAppInfo: () => call<{ appName: string; version: string; os: string; arch: string }>("get_app_info"),
  minimizeWindow: () => call<void>("minimize_window"),
  maximizeWindow: () => call<boolean>("maximize_window"),
  isMaximized: () => call<boolean>("is_maximized"),
  isFullscreen: () => call<boolean>("is_fullscreen"),
  toggleFullscreen: () => call<boolean>("toggle_fullscreen"),
  closeWindow: () => call<void>("close_window"),
  hideWindow: () => call<void>("hide_window"),
  showWindow: () => call<void>("show_window"),
  showNotification: (title: string, body: string) => call<void>("show_notification", { title, body }),
  quit: () => call<void>("quit"),
};
