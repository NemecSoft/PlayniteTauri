// Root application shell: loads settings & data, wires the title bar and
// optional login screen.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import TopBar from "./components/TopBar";
import AppBody from "./components/AppBody";
import LoginScreen from "./components/LoginScreen";
import AnnouncementModal from "./components/AnnouncementModal";
import LaunchActionModal from "./components/LaunchActionModal";
import SettingsModal from "./components/settings/SettingsModal";
import ToastContainer from "./components/ToastContainer";
import ImageProgressBar from "./components/ImageProgressBar";
import GameDetailPage from "./pages/GameDetailPage";
import { useSettingsStore } from "./stores/settingsStore";
import { useGamesStore } from "./stores/gamesStore";
import { useLibraryStore } from "./stores/libraryStore";
import { useAuthStore } from "./stores/authStore";
import { useUIStore } from "./stores/uiStore";
import { useI18n, type LanguageCode } from "./i18n";

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadPlatforms = useSettingsStore((s) => s.loadPlatforms);
  const loadGames = useGamesStore((s) => s.load);
  const loadStats = useLibraryStore((s) => s.loadStats);
  const loadAuth = useAuthStore((s) => s.load);
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

  // Theme is fully driven by the 96-palette + 67-style library (injected on
  // :root by themeApply.ts). No next-themes / legacy applyTheme.

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

  // 需要登录时，不显示公告。
  const loginEnabled = useSettingsStore((s) => s.settings.loginEnabled);
  const loggedIn = useAuthStore((s) => s.currentUser !== null);
  const needsLogin = loginEnabled && !loggedIn;

  // 公告的显示时机。
  // 之前公告一进 App 就弹出来，正好赶上主界面在加载游戏数据、渲染游戏网格，
  // 这些活很占主线程，导致公告打开时鼠标点了要好一会儿才反应（用户觉得"要使劲
  // 按才能停止"）。所以这里改成：等主界面的游戏数据加载完成、界面稳定之后，
  // 再弹出公告。这样公告打开时主线程是空闲的，点击立即响应。
  const loading = useGamesStore((s) => s.loading);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const announceTimer = useRef<number | null>(null);
  useEffect(() => {
    // 还在加载数据，先等。
    if (loading) return;
    // 需要登录时，不弹公告。
    if (needsLogin) return;
    // 数据加载完了，再稍微等一下，让界面先渲染稳定，然后弹出公告。
    announceTimer.current = window.setTimeout(() => {
      setShowAnnouncement(true);
    }, 600);
    return () => {
      if (announceTimer.current !== null) window.clearTimeout(announceTimer.current);
    };
  }, [loading, needsLogin]);

  // Close the announcement and hand focus back to the search box.
  const closeAnnouncement = () => {
    setShowAnnouncement(false);
    window.dispatchEvent(new Event("yungame:focus-search"));
  };

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
        <AnimatePresence>
          {settingsOpen && <SettingsModal onClose={closeSettings} />}
          {showAnnouncement && (
            <AnnouncementModal onClose={closeAnnouncement} />
          )}
          <LaunchActionModal />
        </AnimatePresence>
      </div>
  );
}
