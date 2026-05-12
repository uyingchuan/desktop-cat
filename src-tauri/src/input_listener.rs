use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc,
};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct InputSnapshot {
  pub keys: Vec<String>,
  pub mouse: MousePosition,
}

#[derive(Clone, Serialize)]
pub struct MousePosition {
  pub x: i32,
  pub y: i32,
}

#[cfg(target_os = "windows")]
pub fn start(window: tauri::Window, watch_keys: Vec<(i32, String)>) -> Arc<AtomicBool> {
  use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
  use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
  use windows::Win32::Foundation::POINT;

  let stop = Arc::new(AtomicBool::new(false));
  let flag = stop.clone();

  thread::spawn(move || {
    let mut prev_keys: Vec<String> = vec![];
    let mut prev_mouse = (0i32, 0i32);

    loop {
      if flag.load(Ordering::Relaxed) {
        break;
      }

      let mut keys: Vec<String> = vec![];
      for (code, name) in &watch_keys {
        let state = unsafe { GetAsyncKeyState(*code) };
        if (state as u16 & 0x8000) != 0 {
          keys.push(name.clone());
        }
      }

      let mut pos = POINT { x: 0, y: 0 };
      unsafe { let _ = GetCursorPos(&mut pos); }
      let mouse = (pos.x, pos.y);

      if keys != prev_keys || mouse != prev_mouse {
        let _ = window.emit("input:snapshot", InputSnapshot {
          keys: keys.clone(),
          mouse: MousePosition { x: mouse.0, y: mouse.1 },
        });
        prev_keys = keys;
        prev_mouse = mouse;
      }

      thread::sleep(Duration::from_millis(10));
    }
  });

  stop
}

#[cfg(not(target_os = "windows"))]
pub fn start(_window: tauri::Window, _watch_keys: Vec<(i32, String)>) -> Arc<AtomicBool> {
  Arc::new(AtomicBool::new(false))
}
