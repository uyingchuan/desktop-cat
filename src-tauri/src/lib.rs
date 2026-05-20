use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    Emitter, Manager,
};

// 猫格状态（Rust 端唯一数据源）
struct PersonalityState(Mutex<String>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PersonalityState(Mutex::new("calm".to_string())))
        .setup(|app| {
            // 调试模式下启用日志
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 从内嵌资源加载托盘图标 (32x32 像素图)
            let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

            // --- 主菜单项 ---
            let show_hide = MenuItemBuilder::with_id("show_hide", "隐藏 猫咪").build(app)?;
            let show_hide_menu = show_hide.clone();
            let show_hide_tray = show_hide.clone();

            // --- 猫格子菜单 ---
            let calm_item = MenuItemBuilder::with_id("personality_calm", "✓ 慵懒").build(app)?;
            let calm_menu = calm_item.clone();
            let active_item = MenuItemBuilder::with_id("personality_active", "   活泼").build(app)?;
            let active_menu = active_item.clone();

            let personality_submenu = SubmenuBuilder::new(app, "猫格")
                .item(&calm_item)
                .item(&active_item)
                .build()?;

            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&personality_submenu)
                .separator()
                .item(&quit)
                .build()?;

            // 创建系统托盘图标
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                // 点击托盘菜单项
                .on_menu_event(move |app, event| {
                    let show_hide = show_hide_menu.clone();
                    let calm = calm_menu.clone();
                    let active = active_menu.clone();
                    let state = app.state::<PersonalityState>();

                    match event.id().as_ref() {
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(true) {
                                    window.hide().ok();
                                    show_hide.set_text("显示 猫咪").ok();
                                } else {
                                    window.show().ok();
                                    show_hide.set_text("隐藏 猫咪").ok();
                                }
                            }
                        }
                        "personality_calm" => {
                            // 切换到慵懒猫格
                            if let Ok(mut p) = state.0.lock() {
                                *p = "calm".to_string();
                            }
                            calm.set_text("✓ 慵懒").ok();
                            active.set_text("   活泼").ok();
                            app.emit("personality-changed", "calm").ok();
                        }
                        "personality_active" => {
                            // 切换到活泼猫格
                            if let Ok(mut p) = state.0.lock() {
                                *p = "active".to_string();
                            }
                            calm.set_text("   慵懒").ok();
                            active.set_text("✓ 活泼").ok();
                            app.emit("personality-changed", "active").ok();
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                // 左键单击托盘图标
                .on_tray_icon_event(move |tray, event| {
                    let show_hide = show_hide_tray.clone();
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            if window.is_visible().unwrap_or(true) {
                                window.hide().ok();
                                show_hide.set_text("显示 猫咪").ok();
                            } else {
                                window.show().ok();
                                show_hide.set_text("隐藏 猫咪").ok();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
