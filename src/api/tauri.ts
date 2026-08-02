// Thin wrapper around the Tauri invoke bridge with proper typing.

import { invoke } from "@tauri-apps/api/core";

export function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}
