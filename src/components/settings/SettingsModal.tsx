// Settings dialog with sections mirroring Playnite's settings window.

import { useState } from "react";
import { X, Settings, Palette, Database, Plug, Brush, Lock } from "lucide-react";
import GeneralSection from "./GeneralSection";
import AppearanceSection from "./AppearanceSection";
import LibrarySection from "./LibrarySection";
import PluginsSection from "./PluginsSection";
import ThemesSection from "./ThemesSection";
import LoginSection from "./LoginSection";
import { Button } from "../ui/button";
import { useI18n } from "../../i18n";

interface Props {
  onClose: () => void;
}

type SectionId = "general" | "appearance" | "themes" | "login" | "library" | "plugins";

export default function SettingsModal({ onClose }: Props) {
  const [section, setSection] = useState<SectionId>("themes");
  const { t } = useI18n();

  const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: t("settings_general"), icon: <Settings size={15} /> },
    { id: "appearance", label: t("settings_appearance"), icon: <Palette size={15} /> },
    { id: "themes", label: t("settings_themes"), icon: <Brush size={15} /> },
    { id: "login", label: t("settings_login"), icon: <Lock size={15} /> },
    { id: "library", label: t("settings_library"), icon: <Database size={15} /> },
    { id: "plugins", label: t("settings_plugins"), icon: <Plug size={15} /> },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 720, maxWidth: 860, height: "82vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("settings_title")}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>
        <div className="settings-layout">
          <div className="settings-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`sidebar-item ${section === s.id ? "active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
          <div className="settings-content">
            {section === "general" && <GeneralSection />}
            {section === "appearance" && <AppearanceSection />}
            {section === "themes" && <ThemesSection />}
            {section === "login" && <LoginSection />}
            {section === "library" && <LibrarySection />}
            {section === "plugins" && <PluginsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
