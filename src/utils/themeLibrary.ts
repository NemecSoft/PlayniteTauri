// Hand-curated palette library — 6 signature color schemes.
//
// (This file was previously auto-generated with 96 industry palettes by
// scripts/gen-themes.py. It is now a small, hand-authored collection of
// distinctive palettes: Light / Dark / Chinese Red / Chinese Blue /
// Chinese Green / Chinese Ink-wash. It keeps the same ThemePaletteTokens
// shape so the runtime injection (themeApply.ts) and the ThemesSection
// picker work unchanged.)
//
// A palette drives every color token; combining it with a style (styleLibrary)
// yields a full theme. Each entry maps onto both the shadcn-style tokens and
// the legacy business variables (--bg-base/--text-primary/--accent/...).

export interface ThemePaletteTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  bgBase: string;
  bgTop: string;
  bgSidebar: string;
  bgPanel: string;
  bgItemHover: string;
  bgItemActive: string;
  bgInput: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ThemeEntry {
  id: string;
  name: string;
  zh: string;
  category: string;
  palette: ThemePaletteTokens;
}

export const themeLibrary: ThemeEntry[] = [
  {
    id: "p-light",
    name: "Bright",
    zh: "明亮",
    category: "基础",
    palette: {
      background: "#F4F6FA",
      foreground: "#1B2430",
      card: "#ffffff",
      cardForeground: "#1B2430",
      primary: "#2563EB",
      primaryForeground: "#ffffff",
      secondary: "#EDF1F7",
      secondaryForeground: "#1B2430",
      muted: "#E9EDF4",
      mutedForeground: "#5B6472",
      border: "#D8DEE8",
      ring: "#2563EB",
      bgBase: "#F4F6FA",
      bgTop: "#ffffff",
      bgSidebar: "#ffffff",
      bgPanel: "#ffffff",
      bgItemHover: "#E9EEF6",
      bgItemActive: "#DDE5F1",
      bgInput: "#ffffff",
      borderStrong: "#C3CBD9",
      textPrimary: "#1B2430",
      textSecondary: "#465060",
      textDim: "#77808F",
      accent: "#2563EB",
      accentHover: "#3B82F6",
      accentSoft: "rgba(37, 99, 235, 0.14)",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
    },
  },
  {
    id: "p-dark",
    name: "Dark",
    zh: "暗黑",
    category: "基础",
    palette: {
      background: "#0B0C10",
      foreground: "#E6E8EE",
      card: "#15161D",
      cardForeground: "#E6E8EE",
      primary: "#6D5DF6",
      primaryForeground: "#ffffff",
      secondary: "#1C1E27",
      secondaryForeground: "#E6E8EE",
      muted: "#191B24",
      mutedForeground: "#8A8DA0",
      border: "#262935",
      ring: "#6D5DF6",
      bgBase: "#0B0C10",
      bgTop: "#15161D",
      bgSidebar: "#101218",
      bgPanel: "#15161D",
      bgItemHover: "#1F2230",
      bgItemActive: "#262A3B",
      bgInput: "#0F1016",
      borderStrong: "#343A4E",
      textPrimary: "#E6E8EE",
      textSecondary: "#A2A6B8",
      textDim: "#7A7E93",
      accent: "#6D5DF6",
      accentHover: "#8377FF",
      accentSoft: "rgba(109, 93, 246, 0.18)",
      success: "#2FBF7F",
      warning: "#E0A63A",
      danger: "#E5484D",
    },
  },
  {
    id: "p-cn-red",
    name: "Chinese Red",
    zh: "中国红",
    category: "中国风",
    palette: {
      background: "#F5EBDC",
      foreground: "#2B2119",
      card: "#FBF5EA",
      cardForeground: "#2B2119",
      primary: "#C8102E",
      primaryForeground: "#fff7e8",
      secondary: "#F0E2CB",
      secondaryForeground: "#2B2119",
      muted: "#EAD9BF",
      mutedForeground: "#8A6E4F",
      border: "#DEC7A4",
      ring: "#C8102E",
      bgBase: "#F5EBDC",
      bgTop: "#F7ECDC",
      bgSidebar: "#F1E3CB",
      bgPanel: "#FBF5EA",
      bgItemHover: "#F0E0C4",
      bgItemActive: "#E9D5B2",
      bgInput: "#F7EEDA",
      borderStrong: "#C9A24B",
      textPrimary: "#2B2119",
      textSecondary: "#6E5740",
      textDim: "#A48B68",
      accent: "#C8102E",
      accentHover: "#DE2C48",
      accentSoft: "rgba(200, 16, 46, 0.16)",
      success: "#7A9E3F",
      warning: "#C9A24B",
      danger: "#B3242E",
    },
  },
  {
    id: "p-cn-blue",
    name: "Chinese Blue",
    zh: "中国蓝",
    category: "中国风",
    palette: {
      background: "#0C1B33",
      foreground: "#E8F0FB",
      card: "#12233F",
      cardForeground: "#E8F0FB",
      primary: "#2E6FDB",
      primaryForeground: "#ffffff",
      secondary: "#182E4F",
      secondaryForeground: "#E8F0FB",
      muted: "#142743",
      mutedForeground: "#9FB6D6",
      border: "#1E3A63",
      ring: "#3E8BE8",
      bgBase: "#0C1B33",
      bgTop: "#11233F",
      bgSidebar: "#0E1E37",
      bgPanel: "#12233F",
      bgItemHover: "#1A3052",
      bgItemActive: "#1F3A64",
      bgInput: "#0A182C",
      borderStrong: "#2E5488",
      textPrimary: "#E8F0FB",
      textSecondary: "#A9BFDE",
      textDim: "#6E87A8",
      accent: "#3E8BE8",
      accentHover: "#5FA3F2",
      accentSoft: "rgba(62, 139, 232, 0.18)",
      success: "#4FB0A0",
      warning: "#D9A441",
      danger: "#E05C5C",
    },
  },
  {
    id: "p-cn-green",
    name: "Chinese Green",
    zh: "中国绿",
    category: "中国风",
    palette: {
      background: "#EFF5EA",
      foreground: "#1E2A1C",
      card: "#F8FBF4",
      cardForeground: "#1E2A1C",
      primary: "#3E7A3E",
      primaryForeground: "#ffffff",
      secondary: "#E3EDD9",
      secondaryForeground: "#1E2A1C",
      muted: "#E1EBD6",
      mutedForeground: "#6E8068",
      border: "#C8D8BA",
      ring: "#4E9447",
      bgBase: "#EFF5EA",
      bgTop: "#F4F8EE",
      bgSidebar: "#E8F1DD",
      bgPanel: "#F8FBF4",
      bgItemHover: "#E4EDD8",
      bgItemActive: "#D7E5C7",
      bgInput: "#F2F7EC",
      borderStrong: "#A7C396",
      textPrimary: "#1E2A1C",
      textSecondary: "#54634E",
      textDim: "#85917E",
      accent: "#4E9447",
      accentHover: "#63A85B",
      accentSoft: "rgba(78, 148, 71, 0.16)",
      success: "#5AA65A",
      warning: "#C9A24B",
      danger: "#C4574A",
    },
  },
  {
    id: "p-cn-ink",
    name: "Ink-wash",
    zh: "中国水墨",
    category: "中国风",
    palette: {
      background: "#EDEBE6",
      foreground: "#242220",
      card: "#F6F4F0",
      cardForeground: "#242220",
      primary: "#3C3A37",
      primaryForeground: "#F5F3EF",
      secondary: "#E4E1DB",
      secondaryForeground: "#242220",
      muted: "#E0DDD7",
      mutedForeground: "#7C7871",
      border: "#CFCBC3",
      ring: "#6B665F",
      bgBase: "#EDEBE6",
      bgTop: "#F1EFEB",
      bgSidebar: "#E8E5DF",
      bgPanel: "#F6F4F0",
      bgItemHover: "#E1DED7",
      bgItemActive: "#D6D2CA",
      bgInput: "#EFEDE8",
      borderStrong: "#B7B1A8",
      textPrimary: "#242220",
      textSecondary: "#5C5852",
      textDim: "#8A857E",
      accent: "#4B4640",
      accentHover: "#635D56",
      accentSoft: "rgba(75, 70, 64, 0.16)",
      success: "#6E7F5A",
      warning: "#9C8A5C",
      danger: "#A24A42",
    },
  },
];
