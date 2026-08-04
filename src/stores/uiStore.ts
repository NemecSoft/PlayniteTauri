// Cross-component UI state (modals, menus) so any view can trigger them
// without prop drilling.

import { create } from "zustand";

interface UIState {
  /** Whether the settings modal is open. */
  settingsOpen: boolean;

  /** Whether the app menu (TitleBar leading) is open. */
  menuOpen: boolean;

  openSettings: () => void;
  closeSettings: () => void;

  toggleMenu: () => void;
  closeMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  menuOpen: false,

  openSettings: () => set({ settingsOpen: true, menuOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),

  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  closeMenu: () => set({ menuOpen: false }),
}));