// Login screen shown on startup when login is enabled.
// Supports two methods (industry-standard, client-side demo flow for a fully
// green/offline app):
//   1. WeChat QR scan (微信扫码) - renders a QR code pointing at a mock login
//      confirm page; scanning it simulates login.
//   2. Account / password (账号密码) - local demo authentication.

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Gamepad2, QrCode, User, Lock, MessageCircle, LogIn } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { useI18n } from "../i18n";

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const { t } = useI18n();

  const [mode, setMode] = useState<"wechat" | "account">(
    settings.loginType === "account" ? "account" : "wechat"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  // Mock WeChat QR: a URL that represents the login confirm page. In a real
  // deployment this would be replaced by a backend-issued WeChat OAuth QR.
  const mockWechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=demo&redirect_uri=playnite%3A%2F%2Flogin&session=${Date.now()}`;

  // Simulate "scanned & confirmed" after the user clicks the QR (offline demo).
  useEffect(() => {
    if (!scanning) return;
    const id = setTimeout(() => {
      setScanning(false);
      finishLogin("wechat-user");
    }, 1500);
    return () => clearTimeout(id);
  }, [scanning]);

  const finishLogin = async (name: string) => {
    await save({ loggedIn: true, username: name, loginType: mode });
    onLogin();
  };

  const handleAccount = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t("login_enterCredentials"));
      return;
    }
    setError("");
    await finishLogin(username.trim());
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <Gamepad2 size={40} color="var(--accent)" />
          <h1>{t("appTitle")}</h1>
          <p>{t("login_welcome")}</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === "wechat" ? "active" : ""}`}
            onClick={() => setMode("wechat")}
          >
            <QrCode size={16} /> {t("login_wechat")}
          </button>
          <button
            className={`login-tab ${mode === "account" ? "active" : ""}`}
            onClick={() => setMode("account")}
          >
            <User size={16} /> {t("login_account")}
          </button>
        </div>

        <div className="login-body">
          {mode === "wechat" ? (
            <div className="wechat-login">
              <div className="qr-wrap">
                <QRCodeSVG value={mockWechatUrl} size={170} fgColor="#202124" />
                <div className="qr-mask" onClick={() => setScanning(true)}>
                  <MessageCircle size={22} />
                  {scanning ? t("login_scanning") : t("login_scanToLogin")}
                </div>
              </div>
              <p className="hint">{t("login_wechatHint")}</p>
            </div>
          ) : (
            <div className="account-login">
              <div className="login-field">
                <User size={16} />
                <input
                  type="text"
                  placeholder={t("login_username")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="login-field">
                <Lock size={16} />
                <input
                  type="password"
                  placeholder={t("login_password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAccount()}
                />
              </div>
              {error && <div className="login-error">{error}</div>}
              <button className="btn primary block" onClick={handleAccount}>
                <LogIn size={16} /> {t("login_signIn")}
              </button>
            </div>
          )}
        </div>

        {settings.loginEnabled && (
          <div className="login-skip">
            <button className="link-btn" onClick={() => onLogin()}>
              {t("login_skip")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
