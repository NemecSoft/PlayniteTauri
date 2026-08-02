// Custom title bar (frame-less window) with app logo and window controls.

import { Minimize, Square, X } from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

// Custom window title bar (auto-build smoke test).

export default function TitleBar() {
  const { t } = useI18n();

  return (
    <header className="titlebar">
      <div className="title">
        <img src="/icons/icon.png" alt="Playnite" />
        {t("appTitle")}
      </div>
      <div className="drag-spacer" />
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
