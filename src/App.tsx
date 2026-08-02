// Root application shell: loads settings & data, wires the title bar and
// optional login screen.

import { useEffect } from "react";
import { HashRouter } from "react-router-dom";
import TitleBar from "./components/TitleBar";
import AppBody from "./components/AppBody";
import LoginScreen from "./components/LoginScreen";
import ToastContainer from "./components/ToastContainer";
import { useSettingsStore } from "./stores/settingsStore";
import { useGamesStore } from "./stores/gamesStore";
import { useLibraryStore } from "./stores/libraryStore";
import { applyTheme } from "./utils/theme";
import { useI18n, type LanguageCode } from "./i18n";

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadPlatforms = useSettingsStore((s) => s.loadPlatforms);
  const loadGames = useGamesStore((s) => s.load);
  const loadStats = useLibraryStore((s) => s.loadStats);
  const theme = useSettingsStore((s) => s.settings.theme);
  const language = useSettingsStore((s) => s.settings.language);
  const loginEnabled = useSettingsStore((s) => s.settings.loginEnabled);
  const loggedIn = useSettingsStore((s) => s.settings.loggedIn);
  const { setLang } = useI18n();

  useEffect(() => {
    loadSettings();
    loadPlatforms();
    loadGames();
    loadStats();
  }, [loadSettings, loadPlatforms, loadGames, loadStats]);

  // Apply the active theme instantly whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sync the persisted language to the i18n context (instant switching).
  useEffect(() => {
    setLang(language as LanguageCode);
  }, [language, setLang]);

  // Show the login screen first when enabled and not yet logged in.
  const needsLogin = loginEnabled && !loggedIn;

  if (needsLogin) {
    return <LoginScreen onLogin={() => undefined} />;
  }

  return (
    <HashRouter>
      <div className="app">
        <TitleBar />
        <AppBody />
        <ToastContainer />
      </div>
    </HashRouter>
  );
}
