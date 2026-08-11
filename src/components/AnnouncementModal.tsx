// Startup announcement dialog.
// The HTML is **statically inlined at build time** via Vite's `?raw` import, so
// the dialog renders synchronously on first open — no IPC round-trip, no
// "Loading announcement..." flicker. If the bundle ever fails to embed the
// file, a tiny fallback snippet is shown.

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import announcementHtml from "../../announcements/announcement.html?raw";

interface Props {
  onClose: () => void;
}

export default function AnnouncementModal({ onClose }: Props) {
  // Close on Escape (unmount handled by AnimatePresence in App).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const html = announcementHtml && announcementHtml.trim().length > 0
    ? announcementHtml
    : "<div class=\"announcement-hero\"><h1>Welcome</h1><p>Your game library, reimagined.</p></div>";

  return (
    <motion.div
      className="announcement-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      {/* Decorative animated background */}
      <div className="announcement-aurora" />
      <motion.div
        className="announcement-card"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="announcement-close" onClick={onClose} title="Close">
          <X size={18} />
        </button>
        <div className="announcement-scroll">
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}