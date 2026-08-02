// Game edit dialog for editing game metadata and launch actions.

import { useState } from "react";
import type { Game } from "../types/models";
import { useGamesStore } from "../stores/gamesStore";
import { X, Plus, Trash2 } from "lucide-react";
import { useI18n } from "../i18n";

interface Props {
  game: Game;
  onClose: () => void;
}

export default function GameEditModal({ game, onClose }: Props) {
  const saveGame = useGamesStore((s) => s.saveGame);
  const deleteGame = useGamesStore((s) => s.deleteGame);
  const { t } = useI18n();

  const [form, setForm] = useState<Game>({ ...game, actions: [...game.actions] });
  const [showDelete, setShowDelete] = useState(false);

  const set = (patch: Partial<Game>) => setForm((f) => ({ ...f, ...patch }));
  const setList = (field: "genre" | "developer" | "publisher" | "tags" | "platform" | "category", value: string) =>
    set({ [field]: value.split(",").map((s) => s.trim()).filter(Boolean) } as any);

  const updateAction = (index: number, patch: Partial<Game["actions"][number]>) => {
    const actions = [...form.actions];
    actions[index] = { ...actions[index], ...patch };
    set({ actions });
  };

  const updateLocalizedName = (index: number, patch: Partial<{ language: string; name: string }>) => {
    const localizedNames = [...(form.localizedNames || [])];
    localizedNames[index] = { ...localizedNames[index], ...patch };
    set({ localizedNames });
  };

  const removeLocalizedName = (index: number) => {
    const localizedNames = (form.localizedNames || []).filter((_, i) => i !== index);
    set({ localizedNames });
  };

  const addLocalizedName = () => {
    set({ localizedNames: [...(form.localizedNames || []), { language: "zh-CN", name: "" }] });
  };

  const save = async () => {
    await saveGame(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("edit_title", { name: game.name })}</h2>
          <button className="tb-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>{t("edit_name")}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          {/* Localized names (multi-language titles) */}
          <div className="field">
            <label>{t("edit_localizedNames")}</label>
            {(form.localizedNames || []).map((ln, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}
              >
                <input
                  type="text"
                  value={ln.language}
                  placeholder={t("edit_language")}
                  style={{ width: 110, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px" }}
                  onChange={(e) => updateLocalizedName(i, { language: e.target.value })}
                />
                <input
                  type="text"
                  value={ln.name}
                  style={{ flex: 1, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px" }}
                  onChange={(e) => updateLocalizedName(i, { name: e.target.value })}
                />
                <button
                  className="tb-btn"
                  onClick={() => removeLocalizedName(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button className="btn" onClick={addLocalizedName}>
              <Plus size={14} /> {t("edit_addName")}
            </button>
          </div>

          {/* Alternate names / nicknames */}
          <div className="field">
            <label>{t("edit_alternateNames")}</label>
            <input
              type="text"
              value={(form.alternateNames || []).join(", ")}
              onChange={(e) =>
                set({
                  alternateNames: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>

          <div className="field">
            <label>{t("edit_installDirectory")}</label>
            <input
              type="text"
              value={form.installDirectory || ""}
              onChange={(e) => set({ installDirectory: e.target.value })}
            />
          </div>

          <div className="field checkbox">
            <input
              type="checkbox"
              id="installed"
              checked={form.installed}
              onChange={(e) => set({ installed: e.target.checked })}
            />
            <label htmlFor="installed">{t("edit_installed")}</label>
          </div>
          <div className="field checkbox">
            <input
              type="checkbox"
              id="favorite"
              checked={form.favorite}
              onChange={(e) => set({ favorite: e.target.checked })}
            />
            <label htmlFor="favorite">{t("edit_favorite")}</label>
          </div>

          <div className="field">
            <label>{t("edit_platforms")}</label>
            <input
              type="text"
              value={form.platform.join(", ")}
              onChange={(e) => setList("platform", e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("edit_genres")}</label>
            <input
              type="text"
              value={form.genre.join(", ")}
              onChange={(e) => setList("genre", e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("edit_developers")}</label>
            <input
              type="text"
              value={form.developer.join(", ")}
              onChange={(e) => setList("developer", e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("edit_publishers")}</label>
            <input
              type="text"
              value={form.publisher.join(", ")}
              onChange={(e) => setList("publisher", e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("edit_tags")}</label>
            <input
              type="text"
              value={form.tags.join(", ")}
              onChange={(e) => setList("tags", e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("edit_description")}</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div className="field">
            <label>{t("edit_launchActions")}</label>
            {form.actions.map((action, i) => (
              <div
                key={action.id}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "center",
                  background: "var(--bg-input)",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                }}
              >
                <select
                  value={action.type}
                  onChange={(e) => updateAction(i, { type: e.target.value as any })}
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px" }}
                >
                  <option value="File">{t("edit_file")}</option>
                  <option value="URL">{t("edit_url")}</option>
                </select>
                <input
                  type="text"
                  placeholder={t("edit_pathPlaceholder")}
                  value={action.path || ""}
                  onChange={(e) => updateAction(i, { path: e.target.value })}
                  style={{ flex: 1, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px" }}
                />
                <input
                  type="text"
                  placeholder={t("edit_argsPlaceholder")}
                  value={action.arguments || ""}
                  onChange={(e) => updateAction(i, { arguments: e.target.value })}
                  style={{ flex: 1, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px" }}
                />
                <input
                  type="checkbox"
                  checked={action.isPlayAction}
                  title={t("edit_isPlayAction")}
                  onChange={(e) => updateAction(i, { isPlayAction: e.target.checked })}
                />
                <button
                  className="tb-btn"
                  onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, x) => x !== i) }))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              className="btn"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  actions: [
                    ...f.actions,
                    {
                      id: crypto.randomUUID(),
                      name: "Play",
                      type: "File",
                      path: f.installDirectory || "",
                      arguments: "",
                      isPlayAction: true,
                      trackGame: true,
                    },
                  ],
                }))
              }
            >
              <Plus size={14} /> {t("edit_addAction")}
            </button>
          </div>
        </div>
        <div className="modal-footer">
          {showDelete ? (
            <>
              <span style={{ color: "var(--danger)", marginRight: 8, fontSize: 13 }}>
                {t("edit_deleteConfirm")}
              </span>
              <button className="btn danger" onClick={() => { deleteGame(game.id); onClose(); }}>
                {t("edit_confirmDelete")}
              </button>
              <button className="btn" onClick={() => setShowDelete(false)}>
                {t("edit_cancel")}
              </button>
            </>
          ) : (
            <>
              <button className="btn danger" onClick={() => setShowDelete(true)}>
                <Trash2 size={14} /> {t("edit_delete")}
              </button>
              <button className="btn primary" onClick={save}>
                {t("edit_save")}
              </button>
              <button className="btn" onClick={onClose}>
                {t("edit_cancel")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
