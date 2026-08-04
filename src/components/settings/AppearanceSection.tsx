// Appearance settings: theme, default view images, card size/gap & cover library.

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useGamesStore } from "../../stores/gamesStore";
import { api } from "../../api/client";
import { FONT_OPTIONS } from "../../utils/fonts";
import { useI18n } from "../../i18n";

export default function AppearanceSection() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const rescanCovers = useGamesStore((s) => s.rescanCovers);
  const { t } = useI18n();

  const [coverInfo, setCoverInfo] = useState<{ dirPath: string; dirExists: boolean; coverFiles: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getCoverDirInfo()
      .then((info) => alive && setCoverInfo(info))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleRescan = async () => {
    setScanning(true);
    setLastResult(null);
    try {
      const outcome = await rescanCovers();
      setLastResult(
        `${t("settings_coverMatched")}: ${outcome.matched} / ${outcome.considered}`
      );
      const info = await api.getCoverDirInfo();
      setCoverInfo(info);
    } catch {
      setLastResult(t("settings_coverScanError"));
    } finally {
      setScanning(false);
    }
  };

  const imageOptions = [
    { value: "Cover", label: t("settings_imageCover") },
    { value: "Background", label: t("settings_imageBackground") },
    { value: "Icon", label: t("settings_imageIcon") },
  ];

  const imageSelect = (label: string, key: "gridViewImage") => (
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
        </div>
      </div>

      <div className="field">
        <label>
          {t("settings_cardSize")}:{" "}
          <strong>{settings.cardWidth}px</strong>
        </label>
        <input
          type="range"
          min={120}
          max={320}
          step={10}
          value={settings.cardWidth}
          onChange={(e) => save({ cardWidth: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", fontSize: 11 }}>
          <span>120</span>
          <span>320</span>
        </div>
      </div>

      <div className="field">
        <label>{t("settings_font")}</label>
        <select
          value={settings.fontFamily}
          onChange={(e) => save({ fontFamily: e.target.value })}
          style={{ fontFamily: settings.fontFamily || undefined }}
        >
          {FONT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} style={{ fontFamily: o.value || undefined }}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
        <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 4 }}>
          {t("settings_fontHint")}
        </div>
      </div>

      <div className="field">
        <label>
          {t("settings_cardGap")}:{" "}
          <strong>{settings.cardGap}px</strong>
        </label>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={settings.cardGap}
          onChange={(e) => save({ cardGap: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", fontSize: 11 }}>
          <span>0</span>
          <span>20</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("settings_coverLibrary")}</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 10 }}>
          {t("settings_coverLibraryHint")}
        </div>
        {coverInfo && (
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--text-dim)",
              wordBreak: "break-all",
              marginBottom: 10,
              padding: 8,
              borderRadius: 6,
              background: "var(--bg-input)",
            }}
          >
            {coverInfo.dirPath}
            {coverInfo.dirExists ? `  (${coverInfo.coverFiles})` : `  (${t("settings_coverNoDir")})`}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn" onClick={handleRescan} disabled={scanning}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            {scanning ? t("settings_coverScanning") : t("settings_coverRescan")}
          </button>
          {lastResult && (
            <span style={{ fontSize: 12, color: "var(--accent)" }}>{lastResult}</span>
          )}
        </div>
      </div>
    </div>
  );
}
