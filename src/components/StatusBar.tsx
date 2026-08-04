// Bottom status bar: shows the local IP, the public (external) IP, and the
// cafe name matched from the public IP via the enterprise config (D:/1.json).

import { useEffect, useState } from "react";
import { Network, Globe, MapPin } from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

interface StatusBarData {
  localIp: string;
  publicIp: string;
  cafeName: string;
  cafeMatched: boolean;
}

export default function StatusBar() {
  const { t } = useI18n();
  const [data, setData] = useState<StatusBarData | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getStatusBar()
      .then((r) => {
        if (!alive) return;
        setData({
          localIp: r.localIp,
          publicIp: r.publicIp,
          cafeName: r.cafeName,
          cafeMatched: r.cafeMatched,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const cafe = data?.cafeMatched && data.cafeName
    ? data.cafeName
    : t("status_unknownCafe");

  return (
    <div className="status-bar">
      <span className="status-item">
        <Network size={13} />
        <span>{data?.localIp || "—"}</span>
      </span>
      <span className="status-sep" />
      <span className="status-item">
        <Globe size={13} />
        <span>{data?.publicIp || "—"}</span>
      </span>
      <span className="status-sep" />
      <span className="status-item">
        <MapPin size={13} />
        <span>{cafe}</span>
      </span>
    </div>
  );
}
