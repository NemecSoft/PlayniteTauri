// Toolbar: search, view mode toggle, add games, settings, sort.

import { Search, LayoutGrid, List, Rows3, Plus, ArrowDownUp, Settings } from "lucide-react";
import { useState } from "react";
import { useGamesStore } from "../stores/gamesStore";
import ImportWizard from "./ImportWizard";
import SettingsModal from "./settings/SettingsModal";
import { useI18n } from "../i18n";

export default function Toolbar() {
  const viewMode = useGamesStore((s) => s.viewMode);
  const setViewMode = useGamesStore((s) => s.setViewMode);
  const searchQuery = useGamesStore((s) => s.searchQuery);
  const setSearch = useGamesStore((s) => s.setSearch);
  const { t } = useI18n();

  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder={t("toolbar_searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="tb-btn" title={t("toolbar_sort")}>
          <ArrowDownUp size={15} />
        </button>

        <button className="tb-btn" onClick={() => setShowSettings(true)}>
          <Settings size={15} />
        </button>

        <button className="tb-btn primary" onClick={() => setShowImport(true)}>
          <Plus size={15} />
          {t("toolbar_addGames")}
        </button>

        <div className="view-toggle">
          <button
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
            title={t("settings_gridView")}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
            title={t("settings_listView")}
          >
            <List size={15} />
          </button>
          <button
            className={viewMode === "details" ? "active" : ""}
            onClick={() => setViewMode("details")}
            title={t("settings_detailsView")}
          >
            <Rows3 size={15} />
          </button>
        </div>
      </div>

      {showImport && <ImportWizard onClose={() => setShowImport(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
