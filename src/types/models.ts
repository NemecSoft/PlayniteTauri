// Mirrors the Rust backend models (see src-tauri/src/models.rs).

export interface Platform {
  id: string;
  name: string;
  specificationId?: string;
  icon?: string;
}

export interface GameAction {
  id: string;
  name: string;
  type: "File" | "URL";
  path?: string;
  workingDir?: string;
  arguments?: string;
  isPlayAction: boolean;
  trackGame: boolean;
}

export interface GameLink {
  name: string;
  url: string;
}

/** A localized/alternate name tagged with a language code. */
export interface GameName {
  language: string;
  name: string;
}

export interface Game {
  id: string;
  /** Primary display name (usually the original English title). */
  name: string;
  sortName?: string;
  /** Localized names across languages (zh-CN, zh-TW, ja, ko, ...). */
  localizedNames?: GameName[];
  /** Unofficial nicknames / colloquial aliases without a language tag. */
  alternateNames?: string[];
  gameId?: string;
  installed: boolean;
  installDirectory?: string;
  playTask?: string;
  otherTasks: string[];
  lastPlayed?: string;
  playCount: number;
  lastActivity?: string;
  playtime: number;
  added: string;
  modified: string;
  category: string[];
  genre: string[];
  developer: string[];
  publisher: string[];
  tags: string[];
  series: string[];
  ageRating: string[];
  region: string[];
  source: string[];
  features: string[];
  releaseDate?: string;
  communityScore?: number;
  criticScore?: number;
  userScore?: number;
  hidden: boolean;
  favorite: boolean;
  backgroundImage?: string;
  coverImage?: string;
  icon?: string;
  description?: string;
  notes?: string;
  version?: string;
  platform: string[];
  emulator?: string;
  completionStatus?: string;
  userScoreSet: boolean;
  manualGame: boolean;
  pluginId?: string;
  links: GameLink[];
  actions: GameAction[];
  featuresEnabled: boolean;
}

export interface AppSettings {
  startupBehavior: string;
  enableTray: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  theme: string;
  language: string;
  firstTimeWizardComplete: boolean;
  databasePath?: string;
  autoBackupEnabled: boolean;
  gridViewImage: string;
  detailsViewImage: string;
  listViewImage: string;
  showInstalledOnly: boolean;
  showHidden: boolean;
  showFavorites: boolean;
  sortOrder: string;
  sortDirection: string;
  fullscreenMode: boolean;
  controllerSupport: boolean;
  /** Whether the login screen is shown on startup. */
  loginEnabled: boolean;
  /** Login method: "wechat" (QR scan) or "account" (username/password). */
  loginType: string;
  /** Whether the current session is logged in. */
  loggedIn: boolean;
  /** Logged-in username (for account login). */
  username?: string;
}

export interface LibraryStats {
  totalGames: number;
  installedGames: number;
  installedPct: number;
  totalPlaytime: number;
  totalSize: number;
  favoriteGames: number;
  hiddenGames: number;
  platformBreakdown: { name: string; count: number }[];
  genreBreakdown: { name: string; count: number }[];
}

export interface LibraryPluginInfo {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
}

export interface ScannedGame {
  path: string;
  name: string;
  installDirectory: string;
  isInstalled: boolean;
}

export interface RunningGame {
  gameId: string;
  gameName: string;
  startedAt: number;
}
