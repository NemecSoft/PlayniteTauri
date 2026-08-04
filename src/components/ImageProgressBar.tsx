// Modal progress dialog shown while local cover images are being preloaded.
// A prominent popup with a spinner + "loading images x/y" + progress bar so the
// user always sees the loading state instead of a barely-visible thin bar.

import { useImageProgressStore, isImageLoading } from "../stores/imageProgressStore";
import { useI18n } from "../i18n";

export default function ImageProgressBar() {
  const total = useImageProgressStore((s) => s.total);
  const loaded = useImageProgressStore((s) => s.loaded);
  const active = useImageProgressStore((s) => isImageLoading(s));
  const { t } = useI18n();

  if (!active || total <= 0) return null;

  const pct = Math.min(100, Math.round((loaded / total) * 100));
  const label = t("images_loading", { loaded, total });

  return (
    <div className="image-progress-overlay">
      <div className="image-progress-modal">
        <div className="image-progress-spinner" />
        <div className="image-progress-title">{t("images_loading_title")}</div>
        <div className="image-progress-sub">{label}</div>
        <div className="image-progress-track">
          <div className="image-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="image-progress-pct">{pct}%</div>
      </div>
    </div>
  );
}
