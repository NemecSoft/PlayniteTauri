@echo off
chcp 65001
REM ============================================================
REM  PlayniteTauri - 一键提交并推送
REM  用法：
REM    双击运行            -> 交互式：输入提交信息后提交并推送
REM    git-push.bat "信息" -> 直接用引号内的提交信息
REM  说明：自动 add、commit、push 到 origin/main。
REM        若未配置远程仓库，会提示设置。
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 git，请先安装 Git。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   PlayniteTauri Git Push
echo ============================================================
echo.

REM ---------- 提交信息 ----------
if "%~1"=="" (
    set /p "MSG=请输入提交信息（留空则使用默认）: "
    if "!MSG!"=="" set "MSG=chore: update"
) else (
    set "MSG=%~1"
)

echo.
echo [1/4] 暂存所有改动...
git add -A
if errorlevel 1 goto :err

echo [2/4] 提交...
git commit -m "!MSG!"
if errorlevel 1 (
    echo.
    echo [提示] 提交失败。若提示 "nothing to commit"，说明没有改动，直接跳过。
)

echo [3/4] 检查远程仓库...
set "REMOTE="
for /f "tokens=1 delims= " %%r in ('git remote') do set "REMOTE=%%r"
if "%REMOTE%"=="" (
    echo.
    echo [错误] 未配置远程仓库。请先配置，例如：
    echo    git remote add origin https://github.com/你的用户名/PlayniteTauri.git
    echo    git branch -M main
    echo 配置后重新运行本脚本。
    goto :end
)

echo [4/4] 推送到 %REMOTE% ...
git push %REMOTE% main
if errorlevel 1 (
    echo.
    echo [错误] 推送失败。可能是权限/网络问题，或远程分支不同。
    goto :err
)

echo.
echo [成功] 已提交并推送：!MSG!
goto :end

:err
echo.
echo [失败] 操作未完全成功，请检查上面的错误信息。
goto :end

:end
echo.
pause
endlocal
