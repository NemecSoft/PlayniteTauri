// Browser-style top bar:
//   [Settings]  [Home | Videos | Tools]  ............  [YunGame - Gold]  [− □ ×]
//
// - Left: a hamburger/menu button that opens a dropdown (Settings, Regenerate
//   Tags, Reload). This replaces the old standalone TitleBar.
// - Middle: top-level tabs (Home / Videos / Tools).
// - Right of the tabs: the resolved current-user edition label
//   (e.g. "YunGame——黄金版").
// - Far right: window controls (minimize / maximize / close).
//
// The whole bar is draggable for the frameless window; interactive controls
// set `-webkit-app-region: no-drag` so clicks still work.

import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Minimize,
  Square,
  X,
  Settings as SettingsIcon,
  Tags as TagsIcon,
  RefreshCw as RefreshIcon,
  Home,
  Clapperboard,
  Wrench,
} from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { useAuthStore } from "../stores/authStore";
import { useGamesStore } from "../stores/gamesStore";
import { useUIStore, type ActiveTab } from "../stores/uiStore";
import { resolveEditionName } from "../utils/edition";

const TABS: { key: ActiveTab; labelKey: string; icon: typeof Home }[] = [
  { key: "home", labelKey: "tab_home", icon: Home },
  { key: "videos", labelKey: "tab_videos", icon: Clapperboard },
  { key: "tools", labelKey: "tab_tools", icon: Wrench },
];

export default function TopBar() {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.currentUser);
  const loadGames = useGamesStore((s) => s.load);

  const menuOpen = useUIStore((s) => s.menuOpen);
  const toggleMenu = useUIStore((s) => s.toggleMenu);
  const closeMenu = useUIStore((s) => s.closeMenu);
  const openSettings = useUIStore((s) => s.openSettings);
  const activeTab = useUIStore((s) => s.activeTab);
  const setTab = useUIStore((s) => s.setTab);

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

  // Build the edition label (right side). Always a non-empty Chinese label,
  // never the literal "Playnite" / "Guest".
  const rawName = currentUser?.name?.trim() ?? "";
  const isGuest =
    !currentUser ||
    currentUser.kind === "guest" ||
    rawName === "" ||
    rawName === "Guest";

  let titleText = isGuest
    ? t("default_edition")
    : resolveEditionName(rawName, currentUser!.level);

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
    <header className="topbar">
      {/* Far left: settings / app menu (circle 2 in the reference image) */}
      <div className="topbar-left" ref={menuRef}>
        <button
          className="topbar-menu-btn"
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

      {/* Middle: top-level tabs */}
      <nav className="topbar-tabs" aria-label="Main tabs">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            className={`topbar-tab ${activeTab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            <Icon size={15} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* Right of the tabs: edition label (circle 1 in the reference image) */}
      <div className="topbar-edition" title={titleText}>
        {titleText}
      </div>

      {/* Far right: window controls */}
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