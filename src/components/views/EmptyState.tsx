// Empty state shown when there are no games (or filters exclude everything).

import { Gamepad2 } from "lucide-react";
import { useI18n } from "../../i18n";

interface Props {
  hasGames: boolean;
}

export default function EmptyState({ hasGames }: Props) {
  const { t } = useI18n();

  return (
    <div className="empty-state">
      <div className="big-icon">
        <Gamepad2 size={56} />
      </div>
      <h2 style={{ color: "var(--text-primary)", fontSize: 18 }}>
        {hasGames ? t("empty_noMatch") : t("empty_libraryEmpty")}
      </h2>
      <p>{hasGames ? t("empty_noMatchHint") : t("empty_libraryEmptyHint")}</p>
    </div>
  );
}
