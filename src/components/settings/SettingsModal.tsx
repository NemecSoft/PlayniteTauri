// Settings dialog with sections mirroring Playnite's settings window.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  const sectionContent = () => {
    switch (section) {
      case "general":
        return <GeneralSection />;
      case "appearance":
        return <AppearanceSection />;
      case "themes":
        return <ThemesSection />;
      case "login":
        return <LoginSection />;
      case "library":
        return <LibrarySection />;
      case "plugins":
        return <PluginsSection />;
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        style={{ minWidth: 720, maxWidth: 860, height: "82vh" }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
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
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
              >
                {sectionContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
