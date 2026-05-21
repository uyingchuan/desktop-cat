use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

// --- 数据结构 ---

#[derive(Serialize, Deserialize, Clone, Debug)]
struct PersonalityParams {
    activity: u8,
    sleepiness: u8,
    grooming: u8,
    playfulness: u8,
}

#[derive(Serialize, Deserialize, Clone)]
struct PersistedConfig {
    active_personality: String,
    custom_personalities: HashMap<String, PersonalityParams>,
}

impl Default for PersistedConfig {
    fn default() -> Self {
        Self {
            active_personality: "calm".to_string(),
            custom_personalities: HashMap::new(),
        }
    }
}

struct PersonalityState(Mutex<String>);
struct TrayHandle(Arc<Mutex<Option<tauri::tray::TrayIcon>>>);

// --- 配置持久化 ---

fn load_config(app: &tauri::AppHandle) -> PersistedConfig {
    let config_dir = app.path().app_data_dir().unwrap_or_default();
    let config_path = config_dir.join("config.json");
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<PersistedConfig>(&content) {
                return config;
            }
        }
    }
    PersistedConfig::default()
}

fn save_config(app: &tauri::AppHandle, config: &PersistedConfig) {
    if let Ok(config_dir) = app.path().app_data_dir() {
        fs::create_dir_all(&config_dir).ok();
        let config_path = config_dir.join("config.json");
        if let Ok(content) = serde_json::to_string_pretty(config) {
            fs::write(config_path, content).ok();
        }
    }
}

// --- 猫格子菜单构建 ---

fn build_personality_submenu(
    app: &tauri::AppHandle,
    active: &str,
    customs: &HashMap<String, PersonalityParams>,
) -> tauri::Result<(tauri::menu::Submenu<tauri::Wry>, Vec<(String, tauri::menu::MenuItem<tauri::Wry>)>)> {
    let has_customs = !customs.is_empty();
    let mut items: Vec<(String, tauri::menu::MenuItem<tauri::Wry>)> = Vec::new();

    let calm_text = if active == "calm" { "✓ 慵懒 (内置)" } else { "   慵懒 (内置)" };
    let calm_item = MenuItemBuilder::with_id("personality_calm", calm_text).build(app)?;
    items.push(("calm".into(), calm_item.clone()));

    let active_text = if active == "active" { "✓ 活泼 (内置)" } else { "   活泼 (内置)" };
    let active_item = MenuItemBuilder::with_id("personality_active", active_text).build(app)?;
    items.push(("active".into(), active_item.clone()));

    let mut sub = SubmenuBuilder::new(app, "猫格")
        .item(&calm_item)
        .item(&active_item);

    if has_customs {
        sub = sub.separator();
        for (name, _params) in customs {
            let id = format!("personality_{}", name);
            let text = if active == name { format!("✓ {}", name) } else { format!("   {}", name) };
            let item = MenuItemBuilder::with_id(&id, text).build(app)?;
            items.push((name.clone(), item.clone()));
            sub = sub.item(&item);
        }
    }

    Ok((sub.build()?, items))
}

// --- Tauri Commands ---

#[tauri::command]
fn get_personality(state: tauri::State<'_, PersonalityState>) -> String {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> PersistedConfig {
    let config = load_config(&app);
    // 同步更新 PersonalityState
    if let Ok(mut p) = app.state::<PersonalityState>().0.lock() {
        *p = config.active_personality.clone();
    }
    config
}

#[tauri::command]
fn save_personality(
    app: tauri::AppHandle,
    name: String,
    params: PersonalityParams,
) -> Result<(), String> {
    if name == "calm" || name == "active" {
        return Err("不能覆盖内置猫格".into());
    }
    let mut config = load_config(&app);
    let is_active = config.active_personality == name;
    config.custom_personalities.insert(name.clone(), params);
    save_config(&app, &config);
    rebuild_tray_menu(&app, &config)?;
    // 如果编辑的是当前使用中的猫格，通知前端重新加载参数
    if is_active {
        if let Some(window) = app.get_webview_window("main") {
            window.emit("personality-changed", &name).ok();
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_personality(app: tauri::AppHandle, name: String) -> Result<(), String> {
    if name == "calm" || name == "active" {
        return Err("不能删除内置猫格".into());
    }
    let mut config = load_config(&app);
    config.custom_personalities.remove(&name);
    // 如果当前选中的是被删除的猫格，切回 calm
    if config.active_personality == name {
        config.active_personality = "calm".to_string();
        if let Ok(mut p) = app.state::<PersonalityState>().0.lock() {
            *p = "calm".to_string();
        }
        if let Some(window) = app.get_webview_window("main") {
            window.emit("personality-changed", "calm").ok();
        }
    }
    save_config(&app, &config);
    rebuild_tray_menu(&app, &config)?;
    Ok(())
}

#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window("settings").is_some() {
        // 窗口已存在，聚焦
        app.get_webview_window("settings").unwrap().show().ok();
        app.get_webview_window("settings").unwrap().set_focus().ok();
        return Ok(());
    }

    let app_ref: &tauri::AppHandle = &app;
    let _settings = WebviewWindowBuilder::new(
        app_ref,
        "settings",
        WebviewUrl::App("/#/settings".into()),
    )
    .title("猫格管理")
    .inner_size(700.0, 520.0)
    .resizable(false)
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// 托盘菜单完全重建
fn rebuild_tray_menu(app: &tauri::AppHandle, config: &PersistedConfig) -> Result<(), String> {
    let (personality_submenu, _sub_items) = build_personality_submenu(
        app,
        &config.active_personality,
        &config.custom_personalities,
    )
    .map_err(|e| e.to_string())?;

    let show_hide = MenuItemBuilder::with_id("show_hide", "隐藏 猫咪")
        .build(app).map_err(|e| e.to_string())?;
    let manage = MenuItemBuilder::with_id("open_settings", "个性管理...")
        .build(app).map_err(|e| e.to_string())?;
    let restart = MenuItemBuilder::with_id("restart", "重启 应用")
        .build(app).map_err(|e| e.to_string())?;
    let quit = MenuItemBuilder::with_id("quit", "退出")
        .build(app).map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&show_hide)
        .separator()
        .item(&personality_submenu)
        .item(&manage)
        .separator()
        .item(&restart)
        .item(&quit)
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(tray_state) = app.try_state::<TrayHandle>() {
        if let Ok(guard) = tray_state.0.lock() {
            if let Some(ref tray) = *guard {
                tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
            }
        }
    }

    if let Some(window) = app.get_webview_window("main") {
        window.emit("personality-list-changed", ()).ok();
    }

    Ok(())
}

// --- 程序入口 ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PersonalityState(Mutex::new("calm".to_string())))
        .manage(TrayHandle(Arc::new(Mutex::new(None))))
        .invoke_handler(tauri::generate_handler![
            get_personality,
            get_config,
            save_personality,
            delete_personality,
            open_settings,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 加载持久化配置
            let config = load_config(app.handle());
            let active = config.active_personality.clone();
            *app.state::<PersonalityState>().0.lock().unwrap() = active.clone();

            // 通知前端
            if let Some(window) = app.get_webview_window("main") {
                window.emit("personality-changed", &active).ok();
            }

            // 托盘图标
            let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

            let show_hide = MenuItemBuilder::with_id("show_hide", "隐藏 猫咪").build(app)?;
            let show_hide_menu = show_hide.clone();
            let show_hide_tray = show_hide.clone();

            let (personality_submenu, sub_items) = build_personality_submenu(
                app.handle(),
                &active,
                &config.custom_personalities,
            )?;

            let manage = MenuItemBuilder::with_id("open_settings", "个性管理...").build(app)?;
            let restart = MenuItemBuilder::with_id("restart", "重启 应用").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&personality_submenu)
                .item(&manage)
                .separator()
                .item(&restart)
                .item(&quit)
                .build()?;

            // 收集所有 personality 菜单项的 id → name 映射
            let mut personality_ids: HashMap<String, String> = HashMap::new();
            for (name, _item) in &sub_items {
                let id = format!("personality_{}", name);
                personality_ids.insert(id, name.clone());
            }

            let tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    let show_hide = show_hide_menu.clone();
                    let state = app.state::<PersonalityState>();
                    let id = event.id().as_ref().to_string();

                    match id.as_str() {
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
                        "open_settings" => {
                            // 打开/聚焦设置窗口
                            if app.get_webview_window("settings").is_some() {
                                app.get_webview_window("settings").unwrap().show().ok();
                                app.get_webview_window("settings").unwrap().set_focus().ok();
                            } else {
                                let app_ref: &tauri::AppHandle = &app;
                                let _ = WebviewWindowBuilder::new(
                                    app_ref,
                                    "settings",
                                    WebviewUrl::App("/#/settings".into()),
                                )
                                .title("猫格管理")
                                .inner_size(700.0, 520.0)
                                .resizable(false)
                                .decorations(true)
                                .build();
                            }
                        }
                        "restart" => {
                            app.restart();
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        id if id.starts_with("personality_") => {
                            let name = personality_ids.get(id).cloned()
                                .unwrap_or_else(|| id.replace("personality_", ""));
                            if let Ok(mut p) = state.0.lock() {
                                *p = name.clone();
                            }

                            // 持久化
                            let mut config = load_config(app);
                            config.active_personality = name.clone();
                            save_config(app, &config);

                            // 通知前端
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("personality-changed", &name).ok();
                            }

                            // 重建托盘菜单以更新 ✓ 标记
                            let _ = rebuild_tray_menu(app, &config);
                        }
                        _ => {}
                    }
                })
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

            // 存储托盘句柄以便后续动态重建菜单
            *app.state::<TrayHandle>().0.lock().unwrap() = Some(tray);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
