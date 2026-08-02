// Appearance settings: theme, default view images.

import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../i18n";

export default function AppearanceSection() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const { t } = useI18n();

  const imageOptions = [
    { value: "Cover", label: t("settings_imageCover") },
    { value: "Background", label: t("settings_imageBackground") },
    { value: "Icon", label: t("settings_imageIcon") },
  ];

  const imageSelect = (label: string, key: "gridViewImage" | "detailsViewImage" | "listViewImage") => (
    <div className="field">
      <label>{label}</label>
      <select
        value={settings[key]}
        onChange={(e) => save({ [key]: e.target.value } as any)}
      >
        {imageOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>{t("settings_appearance_header")}</h3>

      <div className="field">
        <label>{t("settings_defaultImage")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>{imageSelect(t("settings_gridView"), "gridViewImage")}</div>
          <div style={{ flex: 1 }}>{imageSelect(t("settings_detailsView"), "detailsViewImage")}</div>
          <div style={{ flex: 1 }}>{imageSelect(t("settings_listView"), "listViewImage")}</div>
        </div>
      </div>
    </div>
  );
}
