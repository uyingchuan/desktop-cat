mod input_listener;

fn build_key_list() -> Vec<(i32, String)> {
  let mut keys = Vec::new();
  for c in b'A'..=b'Z' {
    keys.push((c as i32, (c as char).to_string()));
  }
  for c in b'0'..=b'9' {
    keys.push((c as i32, (c as char).to_string()));
  }
  for i in 1..=12 {
    keys.push((111 + i, format!("F{}", i)));
  }
  let specials: Vec<(i32, &str)> = vec![
    (8, "Backspace"), (9, "Tab"), (13, "Enter"),
    (20, "CapsLock"), (27, "Escape"), (32, "Space"),
    (37, "Left"), (38, "Up"), (39, "Right"), (40, "Down"),
    (91, "LWin"), (92, "RWin"),
    (160, "LShift"), (161, "RShift"),
    (162, "LCtrl"), (163, "RCtrl"),
    (164, "LAlt"), (165, "RAlt"),
    (186, "Semicolon"), (187, "Equal"),
    (188, "Comma"), (189, "Minus"), (190, "Period"),
    (191, "Slash"), (192, "Backquote"),
    (219, "BracketLeft"), (220, "Backslash"),
    (221, "BracketRight"), (222, "Quote"),
  ];
  keys.extend(specials.into_iter().map(|(c, n)| (c, n.to_string())));

  // dedup: remove generic Shift/Ctrl/Alt when specific L/R variants exist
  keys.retain(|(_, n)| n != "Shift" && n != "Ctrl" && n != "Alt");

  keys
}

#[tauri::command]
fn start_input_listener(window: tauri::Window) {
  input_listener::start(window, build_key_list());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![start_input_listener])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
