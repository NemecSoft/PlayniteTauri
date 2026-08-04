// Tauri IPC bridge + types shared with the admin backend commands.
import { invoke } from "@tauri-apps/api/core";

export function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

export interface Game {
  id: string;
  name: string;
  gameLevel: number;
  favorite?: boolean;
  hidden?: boolean;
  coverImage?: string | null;
  icon?: string | null;
  developer: string[];
  genre: string[];
  platform: string[];
  category: string[];
  modified?: string;
}

export interface PublicUser {
  id: string;
  account: string;
  name: string;
  level: number;
  createdAt: string;
}

export interface AppSettings {
  language: string;
  theme: string;
  loginEnabled: boolean;
  enterpriseConfigPath: string;
}

export interface EnterprisePreview {
  path: string;
  exists: boolean;
  records: number;
  matchedIp?: string;
  matchedName: string;
  matchedLevel: number;
}
