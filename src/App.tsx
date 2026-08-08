// Root application shell: loads settings & data, wires the title bar and
// optional login screen.

import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import TopBar from "./components/TopBar";
import AppBody from "./components/AppBody";
import LoginScreen from "./components/LoginScreen";
import AnnouncementModal from "./components/AnnouncementModal";
import SettingsModal from "./components/settings/SettingsModal";
import ToastContainer from "./components/ToastContainer";
import ImageProgressBar from "./components/ImageProgressBar";
import GameDetailPage from "./pages/GameDetailPage";
import { useSettingsStore } from "./stores/settingsStore";
import { useGamesStore } from "./stores/gamesStore";
import { useLibraryStore } from "./stores/libraryStore";
import { useAuthStore } from "./stores/authStore";
import { useUIStore } from "./stores/uiStore";
import { applyTheme } from "./utils/theme";
import { useI18n, type LanguageCode } from "./i18n";

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadPlatforms = useSettingsStore((s) => s.loadPlatforms);
  const loadGames = useGamesStore((s) => s.load);
  const loadStats = useLibraryStore((s) => s.loadStats);
  const loadAuth = useAuthStore((s) => s.load);
  const theme = useSettingsStore((s) => s.settings.theme);
  const language = useSettingsStore((s) => s.settings.language);
  const loginEnabled = useSettingsStore((s) => s.settings.loginEnabled);
  const loggedIn = useSettingsStore((s) => s.settings.loggedIn);
  const fontFamily = useSettingsStore((s) => s.settings.fontFamily);
  const { setLang } = useI18n();

  useEffect(() => {
    loadSettings();
    loadPlatforms();
    loadGames();
    loadStats();
    loadAuth();
  }, [loadSettings, loadPlatforms, loadGames, loadStats, loadAuth]);

  // Apply the active theme instantly whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply the user-selected font instantly (no restart). Setting the inline
  // CSS variable overrides each theme's default --font-ui.
  useEffect(() => {
    const el = document.documentElement;
    if (fontFamily && fontFamily.trim()) {
      el.style.setProperty("--font-ui", `${fontFamily.trim()}, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif`);
    } else {
      el.style.removeProperty("--font-ui");
    }
  }, [fontFamily]);

  // Sync the persisted language to the i18n context (instant switching).
  useEffect(() => {
    setLang(language as LanguageCode);
  }, [language, setLang]);

  // Show the login screen first when enabled and not yet logged in.
  const needsLogin = loginEnabled && !loggedIn;

  // Show the startup announcement is managed inside AppShell (it needs the
  // announcement modal to live inside HashRouter). Skip when needs login.

  if (needsLogin) {
    return <LoginScreen onLogin={() => undefined} />;
  }

  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

/** Inner component: lives inside HashRouter so it can use react-router hooks.
 *  Wires up global UI (top bar, body, toast, image progress) and reacts to
 *  "game just launched" by navigating to the detail page. */
function AppShell() {
  const navigate = useNavigate();
  const lastLaunchedId = useGamesStore((s) => s.lastLaunchedId);
  const clearLastLaunched = useGamesStore((s) => s.clearLastLaunched);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const closeSettings = useUIStore((s) => s.closeSettings);

  // Show the startup announcement once the main UI is visible.
  // The announcement HTML is statically inlined into the bundle (see
  // AnnouncementModal), so we can show it immediately — no IPC, no
  // "Loading announcement..." flash.
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  // Close the announcement and hand focus back to the search box.
  const closeAnnouncement = () => {
    setShowAnnouncement(false);
    window.dispatchEvent(new Event("yungame:focus-search"));
  };

  // Auto-hide the announcement once the user is logged in.
  const loginEnabled = useSettingsStore((s) => s.settings.loginEnabled);
  const loggedIn = useAuthStore((s) => s.currentUser !== null);
  const needsLogin = loginEnabled && !loggedIn;
  useEffect(() => {
    if (needsLogin) setShowAnnouncement(false);
  }, [needsLogin]);

  // When a game has just been launched, jump to its detail page so the user
  // can read the guide / instructions while playing (Steam / Playnite-style).
  useEffect(() => {
    if (lastLaunchedId) {
      navigate(`/game/${lastLaunchedId}`);
      clearLastLaunched();
    }
  }, [lastLaunchedId, navigate, clearLastLaunched]);

  return (
      <div className="app">
        <TopBar />
        <Routes>
          <Route path="/" element={<AppBody />} />
          <Route path="/game/:id" element={<GameDetailPage />} />
        </Routes>
        <ToastContainer />
        <ImageProgressBar />
        {settingsOpen && <SettingsModal onClose={closeSettings} />}
        {showAnnouncement && (
          <AnnouncementModal onClose={closeAnnouncement} />
        )}
      </div>
  );
}
