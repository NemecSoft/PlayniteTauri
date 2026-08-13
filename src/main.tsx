import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { restoreLibraryTheme, restoreStyle, getStoredThemeId } from "./utils/themeApply";
import { themeLibrary } from "./utils/themeLibrary";
import { styleLibrary } from "./utils/styleLibrary";
// Initialize i18next (imported for its side effect).
import "./i18n/config";
import { i18n as i18nInstance, type LanguageCode } from "./i18n/config";
import "./styles/global.css";
// New shadcn/Tailwind token layer (semantic CSS variables + theme mapping).
// Loaded alongside the legacy global.css during migration.
import "./styles/globals.css";

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
  // Restore the user's previously chosen library palette + style before first
  // paint, if any (both are injected on :root).
  // 启动时从 localStorage 拿选中的 palette id，查出对应 gradientClass 一并
  // 恢复（用于钻石版/5 套新渐变配色这些带专属背景的 palette）。
  const storedId = getStoredThemeId();
  const initialGradientClass = storedId
    ? themeLibrary.find((t) => t.id === storedId)?.gradientClass
    : undefined;
  restoreLibraryTheme(themeLibrary, initialGradientClass);
  restoreStyle(styleLibrary);

  // 启动时序（治本：避免"先闪英文再切中文"的闪烁）：
  // 1) 在 React 渲染之前，先同步从后端拿到用户设置（最多几十 ms，可接受）。
  // 2) 立刻用该语言同步切换 i18n（资源已加载到 i18next，不涉及网络）。
  // 3) 把预加载的 settings 写入 store，避免 App.tsx 里的 loadSettings 再次
  //    invoke 触发又一轮异步设置语言 → 又一次闪烁。
  // 这样 React 第一次渲染时 i18n 已经是正确语言，不再闪。
  void (async () => {
    const FALLBACK_LANG: LanguageCode = "zh-CN";
    let initialLang: LanguageCode = FALLBACK_LANG;
    let preloadedSettings: unknown = null;
    try {
      // 用直接 invoke，避免循环 import；不通过 api/client 以便尽早发起请求。
      const { invoke } = await import("@tauri-apps/api/core");
      // 设一个 1.5s 的上限：万一后端卡住，1.5s 后直接用 fallback 渲染，
      // 不至于让白屏时间过长。
      const settingsPromise = invoke<{ language?: string }>("get_settings");
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("get_settings timeout")), 1500),
      );
      const settings = await Promise.race([settingsPromise, timeout]);
      if (settings && typeof settings.language === "string") {
        initialLang = settings.language as LanguageCode;
      }
      preloadedSettings = settings;
    } catch {
      // invoke 失败或超时：用 fallback（zh-CN）渲染，不再阻塞
    }
    // 同步切换 i18n 资源（i18next 资源已加载，changeLanguage 是同步的）
    try {
      i18nInstance.changeLanguage(initialLang);
    } catch {
      // ignore
    }
    // 把预加载的 settings 直接喂给 store，让 App 第一次渲染就拿到正确语言。
    if (preloadedSettings) {
      try {
        const { useSettingsStore } = await import("./stores/settingsStore");
        // useSettingsStore 是 zustand 的 vanilla store，setState 同步生效。
        useSettingsStore.setState({
          settings: preloadedSettings as never,
          loaded: true,
        });
      } catch {
        // ignore
      }
    }
    // 渲染根组件
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    );

    // Hide boot screen after render
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
    setTimeout(() => {
      const rootEl = document.getElementById("root");
      const bootEl = document.getElementById("boot");
      if (bootEl && !bootEl.dataset.keep && rootEl && rootEl.childElementCount > 0) {
        bootEl.classList.add("hidden");
      }
    }, 5000);
    document.title = "YunGame";
  })();
} catch (err: any) {
  showBoot("MOUNT ERR: " + (err?.message || String(err)));
}
