// Tools tab: placeholder cards for extra utilities (screen recording, game
// enhancement, etc.). Functional implementations will be added incrementally.

import { useState } from "react";
import { Wrench, MonitorPlay, Gamepad2, Rocket, Cog } from "lucide-react";
import { useI18n } from "../../i18n";

interface ToolDef {
  id: string;
  titleKey: string;
  descKey: string;
  icon: typeof MonitorPlay;
  badge?: string;
}

const TOOLS: ToolDef[] = [
  {
    id: "screen-recorder",
    titleKey: "tools_recorder_title",
    descKey: "tools_recorder_desc",
    icon: MonitorPlay,
  },
  {
    id: "game-boost",
    titleKey: "tools_boost_title",
    descKey: "tools_boost_desc",
    icon: Rocket,
  },
  {
    id: "game-enhance",
    titleKey: "tools_enhance_title",
    descKey: "tools_enhance_desc",
    icon: Gamepad2,
  },
];

export default function ToolsView() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  return (
    <div className="content">
      <div className="tools-header">
        <Wrench size={22} color="var(--accent)" />
        <h2>{t("tools_title")}</h2>
      </div>
      <p className="tools-subtitle">{t("tools_subtitle")}</p>

      <div className="tools-grid">
        {TOOLS.map(({ id, titleKey, descKey, icon: Icon }) => {
          const isOn = !!enabled[id];
          return (
            <div className={`tool-card ${isOn ? "enabled" : ""}`} key={id}>
              <div className="tool-card-icon">
                <Icon size={26} />
              </div>
              <div className="tool-card-body">
                <span className="tool-card-title">{t(titleKey)}</span>
                <p className="tool-card-desc">{t(descKey)}</p>
              </div>
              <div className="tool-card-actions">
                <button
                  className="btn"
                  onClick={() => setEnabled((s) => ({ ...s, [id]: !s[id] }))}
                >
                  {isOn ? t("tools_disable") : t("tools_enable")}
                </button>
                <span className="tool-status">{t("tools_comingSoon")}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tools-note">
        <Cog size={15} />
        <span>{t("tools_note")}</span>
      </div>
    </div>
  );
}
