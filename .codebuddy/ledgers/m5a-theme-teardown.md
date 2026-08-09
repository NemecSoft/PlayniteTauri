# M5a Theme Teardown Ledger

Plan: docs/superpowers/plans/2026-08-10-m5a-theme-teardown.md
Base: M4 complete (deferred GridView/TopBar/Sidebar to M5b)

**Execution order (corrected):** Task 4 (migrate config.json → localStorage) FIRST, then Task 1 (backend), Task 2 (frontend), Task 3 (delete util), Task 5 (verify).
Reason: deleting the backend `theme` field makes the legacy value unreadable, so migration must happen before deletion.

| Task | Description | Status | Commit | Notes |
|------|-------------|--------|--------|-------|
| 4 | One-time migrate legacy config theme → localStorage | done | - | MUST run first (before field deletion) |
| 1 | Remove theme field from backend AppSettings | done | - | cargo check pass; no Rust refs |
| 2 | Remove theme from frontend; ThemesSection → next-themes useTheme | done | - | tsc + admin tsc pass; 8 new i18n keys added to 3 locales |
| 3 | Delete utils/theme.ts + remove applyTheme from App | done | - | npm build pass |
| 5 | Full verify (cargo + build) + GUI smoke (theme switching) | pending | - | - |
