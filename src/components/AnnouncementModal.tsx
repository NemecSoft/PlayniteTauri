// Startup announcement dialog.
// Reads the announcement HTML (from the app's `announcements/announcement.html`
// file via the backend) and renders it with cool entrance animations.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api/client";

interface Props {
  onClose: () => void;
}

export default function AnnouncementModal({ onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    api
      .getAnnouncement()
      .then((a) => setHtml(a.html))
      .catch(() => setHtml(null));
  }, []);

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

  return (
    <div className={`announcement-overlay ${closing ? "closing" : ""}`} onClick={close}>
      {/* Decorative animated background */}
      <div className="announcement-aurora" />
      <div className="announcement-card" onClick={(e) => e.stopPropagation()}>
        <button className="announcement-close" onClick={close} title="Close">
          <X size={18} />
        </button>
        <div className="announcement-scroll">
          {html ? (
            <div
              className="announcement-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="announcement-loading">Loading announcement...</div>
          )}
        </div>
      </div>
    </div>
  );
}
