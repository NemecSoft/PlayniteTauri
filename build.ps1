# Build helper for PlayniteTauri.
# Builds a green/portable (免安装) executable named Playnite.DesktopApp.exe,
# matching the original Playnite desktop app executable name.
#
# IMPORTANT: Uses `cargo tauri build --no-bundle` so that the frontend assets
# are rebuilt (beforeBuildCommand) and embedded correctly into the binary.
# A plain `cargo build` does NOT rebuild the frontend and can produce an exe
# that tries to load from the dev server (localhost) -> connection refused.
#
# Build acceleration (industry standard):
#   - release profile uses thin-LTO + 16 codegen units + incremental
#   - sccache (if installed) caches compiled artifacts across builds
#
# Usage:
#   .\build.ps1              # debug build
#   .\build.ps1 -Release     # optimized release build (recommended)

param(
    [switch]$Debug
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

# `cargo tauri build` is release by default. Add --debug for a debug build.
# We always use --no-bundle to keep the fast, green single-exe flow.
$args = @("tauri", "build", "--no-bundle")
if ($Debug) {
    $args += "--debug"
}

Write-Host "==> Building Tauri app (frontend + Rust backend)..." -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location src-tauri
# Run cargo without letting its normal stderr output (e.g. "Running
# beforeBuildCommand") trip PowerShell's $ErrorActionPreference. We only care
# about the real exit code below.
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& cargo $args 2>&1 | Out-Host
$code = $LASTEXITCODE
$ErrorActionPreference = $oldEAP
Pop-Location
if ($code -ne 0) {
    Write-Error "Build failed (exit code $code)"
}
$sw.Stop()
Write-Host "==> Build took $($sw.Elapsed.ToString('mm\:ss'))" -ForegroundColor Cyan

$profile = if ($Debug) { "debug" } else { "release" }
$srcExe = Join-Path $PSScriptRoot "src-tauri\target\$profile\playnite_desktop_app.exe"
$outDir = Join-Path $PSScriptRoot "release"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$dstExe = Join-Path $outDir "Playnite.DesktopApp.exe"

if (Test-Path $srcExe) {
    Copy-Item $srcExe $dstExe -Force
    Write-Host "==> Green portable executable: $dstExe" -ForegroundColor Green
} else {
    Write-Warning "Could not find built executable at $srcExe"
}

# Remove any residual %LOCALAPPDATA%\Playnite data left by older builds.
# This app is fully green: it never uses the C drive or the registry.
$residual = Join-Path $env:LOCALAPPDATA "Playnite"
if (Test-Path $residual) {
    Write-Host "==> Removing residual %LOCALAPPDATA%\Playnite..." -ForegroundColor Yellow
    Remove-Item $residual -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> Done." -ForegroundColor Cyan
