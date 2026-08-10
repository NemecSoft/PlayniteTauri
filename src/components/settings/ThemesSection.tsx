// Theme picker: 67 styles + 96 palettes, grouped by category with Chinese
// (plain) labels and large, easy-to-tap cards. Clicking a style or palette
// injects its variables onto :root at runtime and persists to localStorage.

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react";
import { themeLibrary } from "../../utils/themeLibrary";
import { styleLibrary } from "../../utils/styleLibrary";
import {
  applyPaletteTheme,
  applyStyleVars,
  getStoredStyleId,
  getStoredThemeId,
  storeStyleId,
  storeThemeId,
} from "../../utils/themeApply";
import { useI18n } from "../../i18n";

function groupBy<T>(items: T[], key: (it: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = out.get(k);
    if (list) list.push(it);
    else out.set(k, [it]);
  }
  return out;
}

export default function ThemesSection() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const paletteId = getStoredThemeId();
  const styleId = getStoredStyleId();

  const q = query.trim().toLowerCase();
  const matches = (zh: string, name: string) =>
    q === "" || zh.toLowerCase().includes(q) || name.toLowerCase().includes(q);

  const filteredStyles = useMemo(
    () => styleLibrary.filter((s) => matches(s.zh, s.name)),
    [q],
  );
  const filteredPalettes = useMemo(
    () => themeLibrary.filter((p) => matches(p.zh, p.name)),
    [q],
  );

  const styleGroups = useMemo(
    () => groupBy(filteredStyles, (s) => s.category),
    [filteredStyles],
  );
  const paletteGroups = useMemo(
    () => groupBy(filteredPalettes, (p) => p.category),
    [filteredPalettes],
  );

  return (
    <div>
      <h3 className="mb-1.5">{t("settings_themes_header")}</h3>
      <p className="mb-3 text-xs text-dim">{t("settings_themes_hint")}</p>

      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-input px-2.5">
        <Search size={14} className="text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings_themes_search")}
          className="flex-1 bg-transparent py-2 text-[13px] outline-none"
        />
      </div>

      {/* ---- Styles (67) ---- */}
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold text-secondary-text">
          {t("settings_styles_label")}（{filteredStyles.length}）
        </div>
        {Array.from(styleGroups.entries()).map(([cat, items]) => (
          <Group key={`s-${cat}`} title={cat}>
            <div className="flex flex-wrap gap-2">
              {items.map((s) => {
                const active = styleId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      applyStyleVars(s.vars);
                      storeStyleId(s.id);
                    }}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                      active
                        ? "border-accent bg-accent text-primary-foreground"
                        : "border-border bg-input text-primary-text hover:border-border-strong"
                    }`}
                  >
                    {s.zh}
                    {active && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </Group>
        ))}
      </div>

      {/* ---- Palettes (96) ---- */}
      <div>
        <div className="mb-2 text-xs font-semibold text-secondary-text">
          {t("settings_palettes_label")}（{filteredPalettes.length}）
        </div>
        {Array.from(paletteGroups.entries()).map(([cat, items]) => (
          <Group key={`p-${cat}`} title={cat}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((p) => {
                const active = paletteId === p.id;
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    title={p.name}
                    onClick={() => {
                      applyPaletteTheme(p.palette);
                      storeThemeId(p.id);
                    }}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition-colors ${
                      active
                        ? "border-accent bg-item-active"
                        : "border-border bg-input hover:border-border-strong"
                    }`}
                  >
                    <div className="flex h-8 w-10 shrink-0 flex-col overflow-hidden rounded border border-border-strong">
                      <div style={{ flex: 1, background: p.palette.primary }} />
                      <div style={{ flex: 1, background: p.palette.background }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-primary-text">
                        {p.zh}
                      </div>
                      <div className="truncate text-[10px] text-dim">{p.name}</div>
                    </div>
                    {active && <Check size={14} className="shrink-0 text-accent" />}
                  </div>
                );
              })}
            </div>
          </Group>
        ))}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-1.5 flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-dim hover:text-secondary-text"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && children}
    </div>
  );
}
