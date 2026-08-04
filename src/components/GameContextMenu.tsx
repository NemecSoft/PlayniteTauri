// Right-click context menu for a game, mirroring Playnite's game menu.

import { useEffect, useRef } from "react";
import type { Game } from "../types/models";
import { Play, Copy } from "lucide-react";
import { useGamesStore } from "../stores/gamesStore";
import { useI18n } from "../i18n";

interface Props {
  game: Game;
  x: number;
  y: number;
  onClose: () => void;
}

export default function GameContextMenu({ game, x, y, onClose }: Props) {
  const launchGame = useGamesStore((s) => s.launchGame);
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [onClose]);

  const item = (label: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
    <button
      className={`context-menu-item ${danger ? "danger" : ""}`}
      onClick={() => {
        onClick();
        onClose();
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {item(t("menu_play"), <Play size={14} />, () => launchGame(game.id))}
      {item(t("menu_copyPath"), <Copy size={14} />, () => navigator.clipboard?.writeText(game.installDirectory || ""))}
    </div>
  );
}
