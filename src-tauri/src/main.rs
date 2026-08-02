//! Playnite.DesktopApp.exe entry point.
//! (Binary name is configured as `Playnite.DesktopApp` in Cargo.toml)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    playnite_desktop_app_lib::run()
}
