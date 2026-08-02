// Right-click context menu for a game, mirroring Playnite's game menu.

import { useEffect, useRef } from "react";
import type { Game } from "../types/models";
import {
  Play,
  Star,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import { useGamesStore } from "../stores/gamesStore";
import { useI18n } from "../i18n";

interface Props {
  game: Game;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
}

export default function GameContextMenu({ game, x, y, onClose, onEdit }: Props) {
  const launchGame = useGamesStore((s) => s.launchGame);
  const toggleFavorite = useGamesStore((s) => s.toggleFavorite);
  const toggleHiddenGame = useGamesStore((s) => s.toggleHiddenGame);
  const deleteGame = useGamesStore((s) => s.deleteGame);
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
      <div className="context-menu-sep" />
      {item(
        game.favorite ? t("menu_removeFromFavorites") : t("menu_addToFavorites"),
        <Star size={14} />,
        () => toggleFavorite(game.id)
      )}
      {item(
        game.hidden ? t("menu_unhideGame") : t("menu_hideGame"),
        game.hidden ? <Eye size={14} /> : <EyeOff size={14} />,
        () => toggleHiddenGame(game.id)
      )}
      {item(t("menu_edit"), <Pencil size={14} />, onEdit)}
      <div className="context-menu-sep" />
      {item(t("menu_copyPath"), <Copy size={14} />, () => navigator.clipboard?.writeText(game.installDirectory || ""))}
      {item(t("menu_delete"), <Trash2 size={14} />, () => deleteGame(game.id), true)}
    </div>
  );
}
