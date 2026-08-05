// Playnite.Admin.exe entry point (YunGame admin console).
// A thin Tauri app that calls the shared core library with its own context
// (embedding the admin frontend from ./dist-admin).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    yungame_core::run_admin(tauri::generate_context!())
}
