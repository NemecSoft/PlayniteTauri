import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "./api/client";
import { restoreLibraryTheme } from "./utils/themeApply";
import { themeLibrary } from "./utils/themeLibrary";
// Initialize i18next (imported for its side effect).
import "./i18n/config";
import "./styles/global.css";
// New shadcn/Tailwind token layer (semantic CSS variables + theme mapping).
// Loaded alongside the legacy global.css during migration.
import "./styles/globals.css";

/**
 * One-time migration: legacy config.json `theme` value → next-themes
 * localStorage `theme` key.
 *
 * Must run BEFORE React mounts (and before next-themes reads localStorage), so
 * the new token theme is applied from the very first frame. Reads the still
 * present `theme` field from the backend AppSettings, maps it to the new 4-theme
 * vocabulary, and writes it to localStorage. Runs once — afterwards the
 * `theme` key exists and this is a no-op.
 */
const LEGACY_THEME_MAP: Record<string, string> = {
  cyberpunk: "cyberpunk",
  Cyberpunk: "cyberpunk",
  chinese: "chinese",
  Chinese: "chinese",
  Dark: "dark",
  Light: "light",
  Default: "dark",
};

async function migrateLegacyTheme(): Promise<void> {
  try {
    const STORAGE_KEY = "theme";
    if (localStorage.getItem(STORAGE_KEY) !== null) return; // already migrated
    const settings = await api.getSettings();
    const legacy = (settings as any).theme as string | undefined;
    if (!legacy) {
      localStorage.setItem(STORAGE_KEY, "dark");
      return;
    }
    localStorage.setItem(STORAGE_KEY, LEGACY_THEME_MAP[legacy] || "dark");
  } catch {
    localStorage.setItem("theme", "dark");
  }
}

// TanStack Query client (part of the upgraded tech stack).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function showBoot(msg: string, keep = true) {
  const el = document.getElementById("boot");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  if (keep) el.dataset.keep = "1";
}

// If an error occurs, show it and never hide the boot screen afterwards.
window.addEventListener("error", (e) => {
  showBoot("JS ERROR: " + (e.error?.message || e.message || "unknown"));
  document.title = "ERR: " + (e.error?.message || e.message || "unknown");
});
window.addEventListener("unhandledrejection", (e) => {
  showBoot("JS REJECTION: " + (e.reason?.message || String(e.reason)));
});

try {
  // Migrate the legacy config.json theme to localStorage BEFORE React mounts,
  // so next-themes picks up the correct theme on first paint.
  await migrateLegacyTheme();

  // Restore the user's previously chosen library palette (injected on :root)
  // before first paint, if any.
  restoreLibraryTheme(themeLibrary);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );

  // Only hide the boot screen when #root actually has rendered content.
  // If React crashes, the boot screen stays visible with any error.
  const timer = setInterval(() => {
    const rootEl = document.getElementById("root");
    const bootEl = document.getElementById("boot");
    if (!rootEl || !bootEl) return;
    if (bootEl.dataset.keep) {
      clearInterval(timer);
      return;
    }
    if (rootEl.childElementCount > 0) {
      bootEl.classList.add("hidden");
      clearInterval(timer);
    }
  }, 100);

  // Safety timeout: hide after 5s if it seems rendered but the interval missed.
  setTimeout(() => {
    const rootEl = document.getElementById("root");
    const bootEl = document.getElementById("boot");
    if (bootEl && !bootEl.dataset.keep && rootEl && rootEl.childElementCount > 0) {
      bootEl.classList.add("hidden");
    }
  }, 5000);

  document.title = "YunGame";
} catch (err: any) {
  showBoot("MOUNT ERR: " + (err?.message || String(err)));
}
