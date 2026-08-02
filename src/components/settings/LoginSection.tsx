// Login settings: enable/disable the startup login screen and choose method.

import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../i18n";

export default function LoginSection() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const { t } = useI18n();

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>{t("settings_login_header")}</h3>

      <div className="field checkbox">
        <input
          type="checkbox"
          id="loginEnabled"
          checked={settings.loginEnabled}
          onChange={(e) => save({ loginEnabled: e.target.checked })}
        />
        <label htmlFor="loginEnabled">{t("settings_loginEnable")}</label>
      </div>

      <div className="field">
        <label>{t("settings_loginMethod")}</label>
        <select
          value={settings.loginType}
          onChange={(e) => save({ loginType: e.target.value })}
          disabled={!settings.loginEnabled}
        >
          <option value="wechat">{t("login_wechat")}</option>
          <option value="account">{t("login_account")}</option>
        </select>
      </div>

      {settings.loggedIn && (
        <div style={{ color: "var(--success)", fontSize: 13, marginTop: 8 }}>
          {t("settings_loginLoggedIn")} {settings.username ? `（${settings.username}）` : ""}
          <button
            className="link-btn"
            style={{ marginLeft: 8 }}
            onClick={() => save({ loggedIn: false })}
          >
            {t("settings_loginLogout")}
          </button>
        </div>
      )}
    </div>
  );
}
