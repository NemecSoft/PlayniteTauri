@echo off
REM Auto-build launcher: double-click to start watching for source changes and
REM automatically rebuilding the green Playnite.DesktopApp.exe.
REM Stop with Ctrl+C in the opened window.

title Playnite Auto-Build Watcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found. Please install Node.js 18+ first.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   PlayniteTauri Auto-Build
echo   Watching for changes... edit code and the green exe will
echo   rebuild automatically. Press Ctrl+C to stop.
echo ============================================================
echo.

node scripts/auto-build.mjs
pause
