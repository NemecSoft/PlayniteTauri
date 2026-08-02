// Plugins / extensions management.

import { useEffect, useState } from "react";
import { Plug, RefreshCw, Trash2 } from "lucide-react";
import type { LibraryPluginInfo } from "../../types/models";
import { api } from "../../api/client";
import { useI18n } from "../../i18n";

export default function PluginsSection() {
  const [plugins, setPlugins] = useState<LibraryPluginInfo[]>([]);
  const { t } = useI18n();

  const load = async () => {
    const p = await api.discoverPlugins();
    setPlugins(p);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>{t("settings_plugins_header")}</h3>

      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={load}>
          <RefreshCw size={15} /> {t("settings_rescanPlugins")}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {plugins.length === 0 && (
          <div style={{ color: "var(--text-dim)" }}>
            {t("settings_noPlugins")}{" "}
            <code>./extensions/plugins</code>.
          </div>
        )}
        {plugins.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          >
            <Plug size={16} style={{ color: "var(--accent-hover)" }} />
            <span style={{ fontWeight: 600 }}>{p.name}</span>
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{p.id}</span>
            <span style={{ marginLeft: "auto", fontSize: 12 }}>
              {p.enabled ? (
                <span style={{ color: "var(--success)" }}>{t("settings_enabled")}</span>
              ) : (
                t("settings_disabled")
              )}
            </span>
            <button
              className="tb-btn"
              onClick={async () => {
                await api.deleteLibraryPlugin(p.id);
                await load();
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
