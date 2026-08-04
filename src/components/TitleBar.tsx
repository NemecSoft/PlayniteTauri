// Custom frame-less title bar.
// Layout: [menu] ........ [centered title] ........ [window controls]
//   * Left: an "app menu" button that drops down a list of menu items
//     (Settings, Regenerate Tags, Reload).
//   * Center: the resolved current-user name, picking edition (黄金版/钻石版)
//     from the user's level; falls back to "黄金版" when no real user is
//     matched (guest / empty name), per requirements.
//   * Right: minimize / maximize / close.

import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Minimize,
  Square,
  X,
  Settings as SettingsIcon,
  Tags as TagsIcon,
  RefreshCw as RefreshIcon,
} from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { useAuthStore } from "../stores/authStore";
import { useGamesStore } from "../stores/gamesStore";
import { useUIStore } from "../stores/uiStore";
import { resolveEditionName } from "../utils/edition";

export default function TitleBar() {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.currentUser);
  const loadGames = useGamesStore((s) => s.load);

  const menuOpen = useUIStore((s) => s.menuOpen);
  const toggleMenu = useUIStore((s) => s.toggleMenu);
  const closeMenu = useUIStore((s) => s.closeMenu);
  const openSettings = useUIStore((s) => s.openSettings);

  const menuRef = useRef<HTMLDivElement>(null);
  const [regenBusy, setRegenBusy] = useState(false);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen, closeMenu]);

  // Build the centered title text. We always want a non-empty Chinese label
  // and never the literal "Playnite" or "Guest".
  const rawName = currentUser?.name?.trim() ?? "";
  const isGuest = !currentUser || currentUser.kind === "guest" || rawName === "" || rawName === "Guest";

  let titleText = isGuest
    ? t("default_edition")
    : resolveEditionName(rawName, currentUser!.level);

  // Ensure the "YunGame" prefix (and the —— separator) appears regardless of
  // where the name came from.
  const PREFIX = "YunGame——";
  if (!titleText.startsWith("YunGame")) {
    titleText = PREFIX + titleText;
  }

  async function regenerateTags() {
    if (regenBusy) return;
    setRegenBusy(true);
    closeMenu();
    try {
      const n = await api.regenerateTags();
      await loadGames();
      await api.showNotification(
        t("titlebar_menu_regen_tags_done"),
        t("titlebar_menu_regen_tags_done_body", { count: n })
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await api.showNotification(t("titlebar_menu_regen_tags_failed"), msg);
    } finally {
      setRegenBusy(false);
    }
  }

  return (
    <header className="titlebar">
      <div className="titlebar-left" ref={menuRef}>
        <button
          className="titlebar-menu-btn"
          aria-label={t("titlebar_menu")}
          title={t("titlebar_menu")}
          onClick={toggleMenu}
        >
          <Menu size={16} />
        </button>
        {menuOpen && (
          <div className="titlebar-menu">
            <button
              className="titlebar-menu-item"
              onClick={() => openSettings()}
            >
              <SettingsIcon size={14} />
              <span>{t("titlebar_menu_settings")}</span>
            </button>
            <button
              className="titlebar-menu-item"
              disabled={regenBusy}
              onClick={regenerateTags}
              title={t("titlebar_menu_regen_tags_title")}
            >
              <TagsIcon size={14} />
              <span>{t("titlebar_menu_regen_tags")}</span>
            </button>
            <button
              className="titlebar-menu-item"
              disabled={regenBusy}
              onClick={async () => {
                closeMenu();
                await loadGames();
              }}
              title={t("titlebar_menu_reload_title")}
            >
              <RefreshIcon size={14} />
              <span>{t("titlebar_menu_reload")}</span>
            </button>
          </div>
        )}
      </div>

      <div className="titlebar-center" title={titleText}>
        {titleText}
      </div>

      <div className="window-controls">
        <button title="Minimize" onClick={() => api.minimizeWindow()}>
          <Minimize size={15} />
        </button>
        <button title="Maximize" onClick={() => api.maximizeWindow()}>
          <Square size={13} />
        </button>
        <button className="close" title="Close" onClick={() => api.closeWindow()}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}