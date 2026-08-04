// Toolbar: search box only. Settings lives in the TitleBar app menu now.

import { useGamesStore } from "../stores/gamesStore";
import { useI18n } from "../i18n";

export default function Toolbar() {
  const searchQuery = useGamesStore((s) => s.searchQuery);
  const setSearch = useGamesStore((s) => s.setSearch);
  const { t } = useI18n();

  return (
    <div className="toolbar">
      <div className="search-box">
        <input
          type="text"
          placeholder={t("toolbar_searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
    </div>
  );
}