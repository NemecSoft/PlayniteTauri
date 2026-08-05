// Playnite.DesktopApp.exe entry point (YunGame desktop client).
// A thin Tauri app that calls the shared core library with its own context
// (embedding the client frontend from ./dist).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    yungame_core::run_client(tauri::generate_context!())
}
