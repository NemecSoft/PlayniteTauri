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
rem ------------------------------------------------------------------
rem  先停掉占用 Vite 端口(1420) 的残留 dev server，避免启动报端口占用
rem  netstat 结果先落临时文件，再从文件解析 PID，规避 cmd 的转义坑
rem ------------------------------------------------------------------
echo  Checking port 1420 ...
set "_port=1420"
set "_tmp=%TEMP%\yungame_port_list.txt"
set "_kill=%TEMP%\yungame_port_kill.txt"
netstat -ano > "%_tmp%"
findstr ":%_port%" "%_tmp%" | findstr "LISTENING" > "%_kill%" 2>nul
set "_found="
for /f "tokens=5" %%p in (%_kill%) do (
    echo  - Killing PID %%p
    taskkill /f /pid %%p >nul 2>nul
    set "_found=1"
)
if defined _found (
    echo  - Port %_port% was in use. Killed.
) else (
    echo  - Port %_port% is free.
)
del "%_tmp%" "%_kill%" 2>nul
set "_port="
set "_tmp="
set "_kill="
set "_found="
echo.
cd apps\desktop
npm exec tauri -- dev
cd ..\..
pause
