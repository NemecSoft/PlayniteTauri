// Library settings: database path, default filters.

import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../i18n";

export default function LibrarySection() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const { t } = useI18n();

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>{t("settings_library_header")}</h3>

      <div className="field">
        <label>{t("settings_databaseLocation")}</label>
        <input
          type="text"
          value={settings.databasePath || ""}
          onChange={(e) => save({ databasePath: e.target.value })}
          placeholder={t("settings_defaultLocation")}
        />
      </div>

      <div className="field checkbox">
        <input
          type="checkbox"
          id="installedOnly"
          checked={settings.showInstalledOnly}
          onChange={(e) => save({ showInstalledOnly: e.target.checked })}
        />
        <label htmlFor="installedOnly">{t("settings_showInstalledOnly")}</label>
      </div>
    </div>
  );
}
