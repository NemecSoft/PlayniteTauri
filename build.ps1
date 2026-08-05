# Build helper for PlayniteTauri (Cargo workspace monorepo).
#
# Builds two green/portable (免安装) executables:
#   - client:  apps/desktop        -> release/Playnite.DesktopApp.exe   (shipped)
#   - admin:   apps/admin          -> admin_release/Playnite.Admin.exe  (not shipped)
#
# IMPORTANT: Uses `cargo tauri build --no-bundle` per app so the frontend is
# rebuilt (beforeBuildCommand) and embedded correctly. A plain `cargo build`
# does NOT rebuild the frontend and can produce an exe that tries to load from
# the dev server (localhost) -> connection refused.
#
# Build acceleration:
#   - workspace release profile uses thin-LTO + 16 codegen units + incremental
#   - sccache (if installed) caches compiled artifacts across builds
#
# Usage:
#   .\build.ps1               # release build (recommended)
#   .\build.ps1 -Debug        # debug build
#   .\build.ps1 -ClientOnly   # only build the client (faster)
#   .\build.ps1 -AdminOnly    # only build the admin console

param(
    [switch]$Debug,
    [switch]$ClientOnly,
    [switch]$AdminOnly
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot"

# Enable sccache when available (Rust community standard compile cache).
$sccache = Get-Command sccache -ErrorAction SilentlyContinue
if ($sccache) {
    $env:RUSTC_WRAPPER = $sccache.Source
    Write-Host "==> sccache enabled: $($sccache.Source)" -ForegroundColor Green
} else {
    Write-Host "==> sccache not found (optional; install for faster rebuilds: cargo install sccache)" -ForegroundColor Yellow
}

$profile = if ($Debug) { "debug" } else { "release" }
$targetDir = Join-Path $PSScriptRoot "target"

function Run-Cargo([string]$Dir, [string[]]$Args, [string]$Label) {
    Write-Host "==> $Label..." -ForegroundColor Cyan
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Push-Location $Dir
    $oldEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & cargo @Args 2>&1 | Out-Host
    $code = $LASTEXITCODE
    $ErrorActionPreference = $oldEAP
    Pop-Location
    $sw.Stop()
    Write-Host "==> $Label took $($sw.Elapsed.ToString('mm\:ss'))" -ForegroundColor Cyan
    if ($code -ne 0) {
        Write-Error "$Label failed (exit code $code)"
    }
}

# ---------------- Client (apps/desktop) ----------------
if (-not $AdminOnly) {
    Run-Cargo "apps\desktop" @("tauri", "build", "--no-bundle", $(if ($Debug) { "--debug" })) "Building client (frontend + backend)"

    $srcExe = Join-Path $targetDir "$profile\yungame.exe"
    $outDir = Join-Path $PSScriptRoot "release"
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $dstExe = Join-Path $outDir "Playnite.DesktopApp.exe"
    if (Test-Path $srcExe) {
        Copy-Item $srcExe $dstExe -Force
        Write-Host "==> Green portable executable: $dstExe" -ForegroundColor Green
    } else {
        Write-Warning "Could not find built executable at $srcExe"
    }
}

# ---------------- Admin console (apps/admin) ----------------
if (-not $ClientOnly) {
    # Build the admin frontend into dist-admin (its own frontendDist).
    Write-Host "==> Building admin frontend (dist-admin)..." -ForegroundColor Cyan
    npm run build:admin 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Admin frontend build failed (exit code $LASTEXITCODE)"
    }

    Run-Cargo "apps\admin" @("tauri", "build", "--no-bundle", $(if ($Debug) { "--debug" })) "Building admin (frontend + backend)"

    $adminOutDir = Join-Path $PSScriptRoot "admin_release"
    New-Item -ItemType Directory -Force -Path $adminOutDir | Out-Null
    $srcAdmin = Join-Path $targetDir "$profile\admin_app.exe"
    $dstAdmin = Join-Path $adminOutDir "Playnite.Admin.exe"
    if (Test-Path $srcAdmin) {
        Copy-Item $srcAdmin $dstAdmin -Force
        # Tauri green runs need WebView2Loader.dll next to the exe.
        $wv2 = Join-Path $targetDir "$profile\WebView2Loader.dll"
        if (Test-Path $wv2) {
            Copy-Item $wv2 (Join-Path $adminOutDir "WebView2Loader.dll") -Force
        }
        Write-Host "==> Admin console executable: $dstAdmin" -ForegroundColor Green
    } else {
        Write-Warning "Could not find built admin executable at $srcAdmin"
    }
}

# Remove any residual %LOCALAPPDATA%\YunGame data left by older builds.
# This app is fully green: it never uses the C drive or the registry.
$residual = Join-Path $env:LOCALAPPDATA "YunGame"
if (Test-Path $residual) {
    Write-Host "==> Removing residual %LOCALAPPDATA%\YunGame..." -ForegroundColor Yellow
    Remove-Item $residual -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> Done." -ForegroundColor Cyan
