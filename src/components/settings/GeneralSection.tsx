// General settings section.

import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n, type LanguageCode } from "../../i18n";

export default function GeneralSection() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const { t } = useI18n();

  const LANGUAGES: { code: LanguageCode; label: string }[] = [
    { code: "en-US", label: t("settings_langEnglish") },
    { code: "zh-CN", label: t("settings_langSimplified") },
    { code: "zh-TW", label: t("settings_langTraditional") },
  ];

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>{t("settings_general_header")}</h3>

      <div className="field">
        <label>{t("settings_startupBehavior")}</label>
        <select
          value={settings.startupBehavior}
          onChange={(e) => save({ startupBehavior: e.target.value })}
        >
          <option value="StartNormal">{t("settings_startNormal")}</option>
          <option value="StartMinimized">{t("settings_startMinimized")}</option>
          <option value="StartMinimizedTray">{t("settings_startMinimizedTray")}</option>
        </select>
      </div>

      <div className="field checkbox">
        <input
          type="checkbox"
          id="tray"
          checked={settings.enableTray}
          onChange={(e) => save({ enableTray: e.target.checked })}
        />
        <label htmlFor="tray">{t("settings_enableTray")}</label>
      </div>

      <div className="field checkbox">
        <input
          type="checkbox"
          id="closeToTray"
          checked={settings.closeToTray}
          onChange={(e) => save({ closeToTray: e.target.checked })}
        />
        <label htmlFor="closeToTray">{t("settings_closeToTray")}</label>
      </div>

      <div className="field">
        <label>{t("settings_language")}</label>
        <select
          value={settings.language}
          onChange={(e) => save({ language: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field checkbox">
        <input
          type="checkbox"
          id="autoBackup"
          checked={settings.autoBackupEnabled}
          onChange={(e) => save({ autoBackupEnabled: e.target.checked })}
        />
        <label htmlFor="autoBackup">{t("settings_autoBackup")}</label>
      </div>
    </div>
  );
}
