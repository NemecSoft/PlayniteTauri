// Add Games wizard: scan a folder or Steam library, then import results.

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderSearch, Gamepad2, X, Check, Loader2 } from "lucide-react";
import { useLibraryStore } from "../stores/libraryStore";
import { useGamesStore } from "../stores/gamesStore";
import { useI18n } from "../i18n";

interface Props {
  onClose: () => void;
}

export default function ImportWizard({ onClose }: Props) {
  const scanResults = useLibraryStore((s) => s.scanResults);
  const scanning = useLibraryStore((s) => s.scanning);
  const importing = useLibraryStore((s) => s.importing);
  const scanFolder = useLibraryStore((s) => s.scanFolder);
  const scanSteam = useLibraryStore((s) => s.scanSteam);
  const importResults = useLibraryStore((s) => s.importResults);
  const reloadGames = useGamesStore((s) => s.load);
  const reloadStats = useLibraryStore((s) => s.loadStats);
  const { t } = useI18n();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>("");

  const handleFolder = async () => {
    const dir = await open({ directory: true });
    if (typeof dir === "string") {
      setStatus(t("import_scanning"));
      await scanFolder(dir);
      setSelected(new Set(scanResults.map((g) => g.path)));
      setStatus("");
    }
  };

  const handleSteam = async () => {
    setStatus(t("import_scanningSteam"));
    await scanSteam();
    setSelected(new Set(scanResults.map((g) => g.path)));
    setStatus("");
  };

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const doImport = async () => {
    const games = scanResults.filter((g) => selected.has(g.path));
    setStatus(t("import_importing", { count: games.length }));
    const n = await importResults();
    await reloadGames();
    await reloadStats();
    setStatus(t("import_imported", { count: n }));
    setTimeout(onClose, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("import_title")}</h2>
          <button className="tb-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button className="btn" onClick={handleFolder}>
              <FolderSearch size={15} /> {t("import_scanFolder")}
            </button>
            <button className="btn" onClick={handleSteam}>
              <Gamepad2 size={15} /> {t("import_scanSteam")}
            </button>
          </div>

          {status && (
            <div style={{ color: "var(--text-secondary)", marginBottom: 10 }}>
              {status}
            </div>
          )}

          {scanning && (
            <div className="center-loading" style={{ height: 120 }}>
              <Loader2 className="spinner" size={24} />
            </div>
          )}

          {!scanning && scanResults.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
                {t("import_found", { count: scanResults.length })}
              </div>
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                }}
              >
                {scanResults.map((g) => (
                  <label
                    key={g.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(g.path)}
                      onChange={() => toggle(g.path)}
                    />
                    <span>{g.name}</span>
                    <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 11 }}>
                      {g.installDirectory}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!scanning && scanResults.length === 0 && !status && (
            <div className="empty-state" style={{ height: 120 }}>
              <div className="big-icon">🎮</div>
              {t("import_scanHint")}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {scanResults.length > 0 && (
            <button
              className="btn primary"
              onClick={doImport}
              disabled={importing || selected.size === 0}
            >
              <Check size={15} /> {t("import_importBtn", { count: selected.size })}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            {t("import_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
