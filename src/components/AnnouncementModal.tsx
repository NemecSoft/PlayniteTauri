// Startup announcement dialog.
// The HTML is **statically inlined at build time** via Vite's `?raw` import, so
// the dialog renders synchronously on first open — no IPC round-trip, no
// "Loading announcement..." flicker. If the bundle ever fails to embed the
// file, a tiny fallback snippet is shown.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import announcementHtml from "../../announcements/announcement.html?raw";

interface Props {
  onClose: () => void;
}

export default function AnnouncementModal({ onClose }: Props) {
  const [closing, setClosing] = useState(false);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const html = announcementHtml && announcementHtml.trim().length > 0
    ? announcementHtml
    : "<div class=\"announcement-hero\"><h1>Welcome</h1><p>Your game library, reimagined.</p></div>";

  return (
    <div className={`announcement-overlay ${closing ? "closing" : ""}`} onClick={close}>
      {/* Decorative animated background */}
      <div className="announcement-aurora" />
      <div className="announcement-card" onClick={(e) => e.stopPropagation()}>
        <button className="announcement-close" onClick={close} title="Close">
          <X size={18} />
        </button>
        <div className="announcement-scroll">
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}