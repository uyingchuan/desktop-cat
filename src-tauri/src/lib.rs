use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    Emitter, Manager,
};

// 持久化配置
#[derive(Serialize, Deserialize)]
struct AppConfig {
    personality: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self { personality: "calm".to_string() }
    }
}

// 猫格状态（Rust 端唯一数据源）
struct PersonalityState(Mutex<String>);

/// 前端主动拉取猫格的命令（启动时调用，避免 setup 中 emit 的时序问题）
#[tauri::command]
fn get_personality(state: tauri::State<'_, PersonalityState>) -> String {
    state.0.lock().unwrap().clone()
}

/// 从 app data 目录加载配置，文件不存在或损坏时返回默认值
fn load_config(app: &tauri::AppHandle) -> AppConfig {
    let config_dir = app.path().app_data_dir().unwrap_or_default();
    let config_path = config_dir.join("config.json");
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

/// 保存配置到 app data 目录
fn save_config(app: &tauri::AppHandle, config: &AppConfig) {
    if let Ok(config_dir) = app.path().app_data_dir() {
        fs::create_dir_all(&config_dir).ok();
        let config_path = config_dir.join("config.json");
        if let Ok(content) = serde_json::to_string_pretty(config) {
            fs::write(config_path, content).ok();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PersonalityState(Mutex::new("calm".to_string())))
        .invoke_handler(tauri::generate_handler![get_personality])
        .setup(|app| {
            // 调试模式下启用日志
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 加载持久化配置，更新猫格状态
            let config = load_config(app.handle());
            let personality = config.personality.clone();
            *app.state::<PersonalityState>().0.lock().unwrap() = personality.clone();

            // 通知前端当前猫格
            // 使用 window.emit 而非 app.emit，确保事件到达 webview 监听器
            if let Some(window) = app.get_webview_window("main") {
                window.emit("personality-changed", &personality).ok();
            }

            // 从内嵌资源加载托盘图标 (32x32 像素图)
            let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

            // --- 主菜单项 ---
            let show_hide = MenuItemBuilder::with_id("show_hide", "隐藏 猫咪").build(app)?;
            let show_hide_menu = show_hide.clone();
            let show_hide_tray = show_hide.clone();

            // --- 猫格子菜单（根据持久化的性格设置初始 ✓ 标记）---
            let (calm_text, active_text) = if personality == "active" {
                ("   慵懒", "✓ 活泼")
            } else {
                ("✓ 慵懒", "   活泼")
            };

            let calm_item = MenuItemBuilder::with_id("personality_calm", calm_text).build(app)?;
            let calm_menu = calm_item.clone();
            let active_item = MenuItemBuilder::with_id("personality_active", active_text).build(app)?;
            let active_menu = active_item.clone();

            let personality_submenu = SubmenuBuilder::new(app, "猫格")
                .item(&calm_item)
                .item(&active_item)
                .build()?;

            let restart = MenuItemBuilder::with_id("restart", "重启 应用").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&personality_submenu)
                .separator()
                .item(&restart)
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
                            if let Ok(mut p) = state.0.lock() {
                                *p = "calm".to_string();
                            }
                            calm.set_text("✓ 慵懒").ok();
                            active.set_text("   活泼").ok();
                            save_config(app, &AppConfig { personality: "calm".to_string() });
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("personality-changed", "calm").ok();
                            }
                        }
                        "personality_active" => {
                            if let Ok(mut p) = state.0.lock() {
                                *p = "active".to_string();
                            }
                            calm.set_text("   慵懒").ok();
                            active.set_text("✓ 活泼").ok();
                            save_config(app, &AppConfig { personality: "active".to_string() });
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("personality-changed", "active").ok();
                            }
                        }
                        "restart" => {
                            app.restart();
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
