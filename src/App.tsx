// Root application shell: loads settings & data, wires the title bar and
// optional login screen.

import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import TitleBar from "./components/TitleBar";
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
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const closeSettings = useUIStore((s) => s.closeSettings);
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

  // Show the startup announcement once the main UI is visible.
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  useEffect(() => {
    if (needsLogin) return;
    // Small delay so the main UI paints first, then pop the announcement.
    const t = setTimeout(() => setShowAnnouncement(true), 400);
    return () => clearTimeout(t);
  }, [needsLogin]);

  if (needsLogin) {
    return <LoginScreen onLogin={() => undefined} />;
  }

  return (
    <HashRouter>
      <div className="app">
        <TitleBar />
        <Routes>
          <Route path="/" element={<AppBody />} />
          <Route path="/game/:id" element={<GameDetailPage />} />
        </Routes>
        <ToastContainer />
        <ImageProgressBar />
        {settingsOpen && <SettingsModal onClose={closeSettings} />}
        {showAnnouncement && (
          <AnnouncementModal onClose={() => setShowAnnouncement(false)} />
        )}
      </div>
    </HashRouter>
  );
}
