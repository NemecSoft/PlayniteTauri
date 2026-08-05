@echo off
chcp 65001
rem ============================================================
rem  YunGame 客户端开发模式 (Playnite.DesktopApp.exe)
rem  快速验证：前端 HMR 秒级热更新 + 后端增量编译
rem  关闭窗口即可停止 dev server
rem ============================================================
cd /d "%~dp0"
echo.
echo  Starting YunGame client (tauri dev) ...
echo  - Vite dev server: http://localhost:1420  (HMR)
echo  - 后端: cargo debug 增量编译 (apps/desktop + crates/yungame-core)
echo  - 关闭此窗口停止.
echo.
cd apps\desktop
npm exec tauri -- dev
cd ..\..
pause
