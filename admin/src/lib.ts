// Tauri IPC bridge + types shared with the admin backend commands.
import { invoke } from "@tauri-apps/api/core";

export function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

export interface GameAction {
  id: string;
  name: string;
  type: string; // "File" | "URL"
  path?: string | null;
  workingDir?: string | null;
  arguments?: string | null;
  isPlayAction: boolean;
  trackGame: boolean;
}

/** A named game library: a unique id + a user-editable name + a root dir path. */
export interface GameLibrary {
  id: string;
  name: string;
  path: string;
}

export interface GameLink {
  name: string;
  url: string;
}

export interface GameVideo {
  type: string;
  url: string;
  name?: string | null;
}

export interface Game {
  id: string;
  name: string;
  gameLevel: number;
  sortName?: string | null;
  localizedNames?: unknown[];
  alternateNames?: string[];
  gameId?: string | null;
  installed?: boolean;
  installDirectory?: string | null;
  playTask?: string | null;
  otherTasks?: string[];
  lastPlayed?: string | null;
  playCount?: number;
  lastActivity?: string | null;
  playtime?: number;
  added?: string;
  modified?: string;
  category: string[];
  genre: string[];
  developer: string[];
  publisher?: string[];
  tags?: string[];
  series?: string[];
  ageRating?: string[];
  region?: string[];
  source?: string[];
  features?: string[];
  releaseDate?: string | null;
  communityScore?: number | null;
  criticScore?: number | null;
  userScore?: number | null;
  hidden?: boolean;
  favorite?: boolean;
  backgroundImage?: string | null;
  coverImage?: string | null;
  icon?: string | null;
  description?: string | null;
  notes?: string | null;
  version?: string | null;
  platform: string[];
  emulator?: string | null;
  completionStatus?: string | null;
  userScoreSet?: boolean;
  manualGame?: boolean;
  pluginId?: string | null;
  links?: GameLink[];
  actions?: GameAction[];
  featuresEnabled?: boolean;
  /** Name of the single game library this game belongs to. */
  gameLibrary?: string | null;
  guide?: string | null;
  screenshots?: string[];
  videos?: GameVideo[];
}

export interface PublicUser {
  id: string;
  account: string;
  name: string;
  level: number;
  kind?: string; // "personal" | "enterprise"
  createdAt: string;
}

export interface AppSettings {
  language: string;
  loginEnabled: boolean;
  enterpriseConfigPath: string;
  gameLibraries: GameLibrary[];
}

export interface EnterprisePreview {
  path: string;
  exists: boolean;
  records: number;
  matchedIp?: string;
  matchedName: string;
  matchedLevel: number;
}
