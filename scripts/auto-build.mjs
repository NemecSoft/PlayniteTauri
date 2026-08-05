// Auto-build watcher (robust, content-hash based).
// Watches frontend (src/, admin/src/) and backend (crates/, apps/) source
// files. On any *content* change it debounces and runs the full green build
// (build.ps1) automatically, so you never have to click "build" yourself.
//
// Why content-hash: the build process itself touches source-file timestamps
// (cargo / vite / tauri-build). If we reacted to every timestamp event, the
// build would re-trigger itself endlessly. By comparing file content hashes we
// only rebuild when you actually edit a file.
//
// Usage:  node scripts/auto-build.mjs   (or double-click auto-build.bat)
// Stop:   Ctrl+C

import { watch } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Only watch the source directories (not Cargo.toml / tauri.conf.json / gen/,
// which the build touches and would otherwise cause rebuild loops).
const WATCH_PATHS = [
  join(root, "src"), // React frontend
  join(root, "admin", "src"), // Admin frontend
  join(root, "crates", "yungame-core", "src"), // Shared Rust backend
  join(root, "apps", "desktop", "src"), // Client Rust backend
  join(root, "apps", "admin", "src"), // Admin Rust backend
];

const IGNORE = /(node_modules|target|dist|release|\/\.git\/|\/gen\/|\.ttf$|\.png$|\.ico$)/;
const EXT_RE = /\.(ts|tsx|js|jsx|css|rs)$/;

let building = false;
let pending = false;
let timer = null;
let currentBuild = null;

// Last known content hash per file. Only a *changed hash* triggers a rebuild.
const hashes = new Map();

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function hashFile(absPath) {
  try {
    return createHash("sha1").update(readFileSync(absPath)).digest("hex");
  } catch {
    return null;
  }
}

function scheduleBuild(file) {
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(() => runBuild(file), 600);
}

function runBuild(triggerFile) {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  pending = false;
  log(`Building green exe (triggered by ${triggerFile || "change"})...`);

  const isWin = process.platform === "win32";
  const cmd = isWin ? "powershell" : "pwsh";
  const args = isWin
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "build.ps1")]
    : [join(root, "build.sh")];

  const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: false });
  currentBuild = child;

  child.on("close", (code) => {
    currentBuild = null;
    building = false;
    if (code === 0) log("Build succeeded ✓");
    else log(`Build failed with code ${code}`);
    // Re-snapshot hashes so build-time touches don't retrigger.
    refreshAllHashes();
    if (pending) runBuild("queued change");
  });
}

function stopBuild() {
  if (currentBuild && !currentBuild.killed) {
    log("Interrupting current build...");
    if (process.platform === "win32") {
      try {
        spawn("taskkill", ["/pid", String(currentBuild.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {}
    } else {
      try {
        currentBuild.kill("SIGTERM");
      } catch {}
    }
  }
  currentBuild = null;
  building = false;
}

function refreshAllHashes() {
  for (const [absPath] of hashes) {
    hashes.set(absPath, hashFile(absPath));
  }
}

async function watchPath(absPath, ac) {
  let handle;
  try {
    handle = await watch(absPath, { recursive: true, signal: ac.signal });
  } catch (err) {
    log(`Cannot watch ${absPath}: ${err.message}`);
    return;
  }
  log(`Watching: ${relative(root, absPath)}`);
  try {
    for await (const { eventType, filename } of handle) {
      const full = filename ? join(absPath, filename.toString()) : absPath;
      if (!full || IGNORE.test(full)) continue;
      if (!EXT_RE.test(full)) continue;

      const prev = hashes.get(full);
      const cur = hashFile(full);
      hashes.set(full, cur);

      // Build-time timestamp touches keep the same content hash → ignored.
      if (prev !== null && cur === prev) continue;

      log(`edit: ${relative(root, full)}`);
      scheduleBuild(relative(root, full));
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    log(`Watcher error on ${absPath}: ${err.message}`);
  }
}

async function main() {
  log(`Watching for changes in ${root}`);
  log("Auto-build is active. Edit code and the green exe rebuilds automatically. Ctrl+C to stop.\n");

  const controllers = [];
  for (const p of WATCH_PATHS) {
    const ac = new AbortController();
    controllers.push(ac);
    watchPath(p, ac);
  }

  const shutdown = () => {
    log("\nStopping...");
    for (const ac of controllers) ac.abort();
    stopBuild();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
