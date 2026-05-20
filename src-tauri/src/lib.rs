use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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

            // 构建托盘菜单项
            // show_hide 需要 clone 两份分别给菜单回调和托盘点击回调使用
            let show_hide = MenuItemBuilder::with_id("show_hide", "隐藏 猫咪").build(app)?;
            let show_hide_menu = show_hide.clone();
            let show_hide_tray = show_hide.clone();
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&quit)
                .build()?;

            // 创建系统托盘图标
            // 右键托盘图标 → 自动弹出菜单（Tauri 内置行为，不会触发 toggle）
            // 左键托盘图标 → 切换窗口显示/隐藏
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                // 关闭左键展开菜单
                .show_menu_on_left_click(false)
                // 点击托盘菜单项的回调
                .on_menu_event(move |app, event| {
                    let show_hide = show_hide_menu.clone();
                    match event.id().as_ref() {
                        "show_hide" => {
                            // 切换窗口可见性并同步更新菜单文案
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
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                // 直接点击托盘图标的回调（仅左键单击触发）
                .on_tray_icon_event(move |tray, event| {
                    let show_hide = show_hide_tray.clone();
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        // 与菜单项行为一致：切换窗口可见性并同步菜单文案
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
