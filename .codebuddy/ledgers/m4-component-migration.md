# M4 Component Migration Ledger

Plan: docs/superpowers/plans/2026-08-10-m4-component-migration.md
Base: M0-M3 complete (9 commits)

| Task | Description | Status | Commit | Notes |
|------|-------------|--------|--------|-------|
| 1 | Map legacy business CSS vars → Tailwind colors | done | d57e22e | build pass |
| 2 | Migrate simple UI comps (EmptyState/AppBody/MainContent/ToastContainer/ImageProgressBar/StatusBar/GameContextMenu) | done | 81dbd2a | build+typecheck pass |
| 3 | Migrate settings forms (General/Library/Login/Appearance) | done | 1b23094 | build+typecheck pass |
| 4 | Migrate medium comps (News/Tools/Videos/Themes/Plugins/LoginScreen/GameDetailPage) | done | 82b52be | build+typecheck pass |
| 5 | Migrate complex comps (TopBar/Sidebar/GridView) | **DEFERRED** | - | **Planned adjustment:** these 3 components are the MOST theme-bound (12-theme-specific CSS: card strokes, neon, chinese ink, ghibli) + critical frameless drag (`-webkit-app-region`) and virtualized layout. Migrating them in M4 (while old themes still active) would break their themed visuals and risk window/drag/virtualization. Deferred to M5 where new token themes + old-theme teardown happen together. |
| 6 | Full regression + GUI smoke | pending | - | - |

## Planned adjustment (SDD plan correction)
Original Task 5 planned to migrate GridView/TopBar/Sidebar in M4. **Correction:** these 3 are deferred to M5. 20/23 components migrated (skip GamesView = pure composition). The 3 deferred are the most theme-coupled + highest-risk (frameless drag, virtualization). This avoids breaking 12-theme card visuals and frameless-window behavior.
