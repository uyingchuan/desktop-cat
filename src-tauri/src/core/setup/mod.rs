use tauri::{AppHandle, WebviewWindow};

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
mod common;

pub fn default(_app_handle: &AppHandle, main_window: WebviewWindow) {
    #[cfg(debug_assertions)]
    main_window.open_devtools();
}
