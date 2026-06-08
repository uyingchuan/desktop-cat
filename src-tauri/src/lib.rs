use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

// --- 数据结构 ---

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ChatMessage {
    role: String,
    content: String,
    #[serde(default)]
    timestamp: i64,
}

fn default_repeat_type() -> String { "once".to_string() }

#[derive(Serialize, Deserialize, Clone, Debug)]
struct TodoItem {
    id: String,
    text: String,
    completed: bool,
    created_at: i64,
    #[serde(default)]
    remind_at: Option<i64>,
    #[serde(default = "default_repeat_type")]
    repeat_type: String,
    #[serde(default)]
    repeat_interval: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone)]
struct TodoData {
    #[serde(default)]
    items: Vec<TodoItem>,
}

impl Default for TodoData {
    fn default() -> Self {
        Self { items: Vec::new() }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct PersonalityParams {
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    activity: u8,
    sleepiness: u8,
    grooming: u8,
    playfulness: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    speeches: Option<HashMap<String, Vec<String>>>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "systemPrompt")]
    system_prompt: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "displayName")]
    display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "lastChatTime")]
    last_chat_time: Option<i64>,
}

fn default_true() -> bool { true }

#[derive(Serialize, Deserialize, Clone)]
struct PersistedConfig {
    active_personality: String,
    #[serde(default)]
    personalities: Vec<PersonalityParams>,
    #[serde(default = "default_true")]
    show_text: bool,
    #[serde(default = "default_true")]
    reminder_enabled: bool,
    #[serde(default = "default_true")]
    todo_reminder_enabled: bool,
    #[serde(default)]
    deepseek_api_key: Option<String>,
}

impl Default for PersistedConfig {
    fn default() -> Self {
        Self {
            active_personality: "calm".to_string(),
            personalities: vec![
                PersonalityParams {
                    id: "calm".to_string(), name: "小橘".to_string(),
                    activity: 20, sleepiness: 70, grooming: 60, playfulness: 15,
                    speeches: None,
                    system_prompt: Some("你是一只慵懒安静的桌面猫猫。你喜欢睡觉和舔毛。回复要简短（1-2句话），语气温柔慵懒，带点傲娇，用\"喵\"结尾。你是用户的桌面伙伴，偶尔关心用户。".to_string()),
                    display_name: None,
                    last_chat_time: None,
                },
            ],
            show_text: true,
            reminder_enabled: true,
            todo_reminder_enabled: true,
            deepseek_api_key: None,
        }
    }
}

struct PersonalityState(Mutex<String>);
struct TrayHandle(Arc<Mutex<Option<tauri::tray::TrayIcon>>>);
struct TrayAlertState {
    flashing: Arc<AtomicBool>,
}

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
    // 首次启动：仅内置慵懒猫格
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

// --- 聊天数据持久化（独立文件）---

#[derive(Serialize, Deserialize, Clone)]
struct ChatData {
    #[serde(default)]
    conversations: HashMap<String, Vec<ChatMessage>>,
    #[serde(default)]
    memories: HashMap<String, Vec<String>>,
}

impl Default for ChatData {
    fn default() -> Self {
        Self {
            conversations: HashMap::new(),
            memories: HashMap::new(),
        }
    }
}

fn load_chat_data(app: &tauri::AppHandle) -> ChatData {
    let config_dir = app.path().app_data_dir().unwrap_or_default();
    let path = config_dir.join("chat_data.json");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<ChatData>(&content) {
                return data;
            }
        }
    }
    ChatData::default()
}

fn save_chat_data(app: &tauri::AppHandle, data: &ChatData) {
    if let Ok(config_dir) = app.path().app_data_dir() {
        fs::create_dir_all(&config_dir).ok();
        let path = config_dir.join("chat_data.json");
        if let Ok(content) = serde_json::to_string_pretty(data) {
            fs::write(path, content).ok();
        }
    }
}

fn load_todo_data(app: &tauri::AppHandle) -> TodoData {
    let config_dir = app.path().app_data_dir().unwrap_or_default();
    let path = config_dir.join("todo_data.json");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<TodoData>(&content) {
                return data;
            }
        }
    }
    TodoData::default()
}

fn save_todo_data(app: &tauri::AppHandle, data: &TodoData) {
    if let Ok(config_dir) = app.path().app_data_dir() {
        fs::create_dir_all(&config_dir).ok();
        let path = config_dir.join("todo_data.json");
        if let Ok(content) = serde_json::to_string_pretty(data) {
            fs::write(path, content).ok();
        }
    }
}

// --- 猫格子菜单构建 ---

fn build_personality_submenu(
    app: &tauri::AppHandle,
    active: &str,
    personalities: &[PersonalityParams],
) -> tauri::Result<(tauri::menu::Submenu<tauri::Wry>, Vec<(String, tauri::menu::MenuItem<tauri::Wry>)>)> {
    let mut items: Vec<(String, tauri::menu::MenuItem<tauri::Wry>)> = Vec::new();

    let mut sub = SubmenuBuilder::new(app, "猫格");
    for params in personalities {
        let name = &params.name;
        let id = format!("personality_{}", name);
        let display = params.display_name.as_deref().unwrap_or(name);
        let text = if active == name { format!("✓ {}", display) } else { format!("   {}", display) };
        let item = MenuItemBuilder::with_id(&id, text).build(app)?;
        items.push((name.clone(), item.clone()));
        sub = sub.item(&item);
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
    let mut config = load_config(&app);
    let is_active = config.active_personality == name;
    // 按 id 查找更新，否则按 name 查找，最后追加
    let target_id = if !params.id.is_empty() { &params.id } else { &name };
    if let Some(existing) = config.personalities.iter_mut().find(|p| p.id == *target_id) {
        *existing = params;
    } else if let Some(existing) = config.personalities.iter_mut().find(|p| p.name == name) {
        *existing = params;
    } else {
        config.personalities.push(params);
    }
    save_config(&app, &config);
    rebuild_tray_menu(&app, &config)?;
    if is_active {
        if let Some(window) = app.get_webview_window("main") {
            window.emit("personality-changed", &name).ok();
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_personality(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let mut config = load_config(&app);

    let idx = config.personalities.iter().position(|p| p.name == name)
        .ok_or("猫格不存在".to_string())?;

    if config.personalities.len() <= 1 {
        return Err("不能删除最后一只猫猫".into());
    }

    config.personalities.remove(idx);

    // 如果删除的是当前选中的猫格，切换到其他
    if config.active_personality == name {
        let fallback = config.personalities.first().map(|p| p.name.clone()).unwrap_or_default();
        config.active_personality = fallback.clone();
        if let Ok(mut p) = app.state::<PersonalityState>().0.lock() {
            *p = fallback.clone();
        }
        if let Some(window) = app.get_webview_window("main") {
            window.emit("personality-changed", &fallback).ok();
        }
    }

    save_config(&app, &config);
    rebuild_tray_menu(&app, &config)?;
    Ok(())
}

#[tauri::command]
fn set_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let mut config = load_config(&app);
    config.deepseek_api_key = Some(key);
    save_config(&app, &config);
    Ok(())
}

#[tauri::command]
fn set_active_personality(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let mut config = load_config(&app);
    config.active_personality = name.clone();
    save_config(&app, &config);

    if let Ok(mut p) = app.state::<PersonalityState>().0.lock() {
        *p = name.clone();
    }
    if let Some(window) = app.get_webview_window("main") {
        window.emit("personality-changed", &name).ok();
    }
    rebuild_tray_menu(&app, &config)?;
    Ok(())
}

#[tauri::command]
fn set_show_text(app: tauri::AppHandle, show: bool) -> Result<(), String> {
    let mut config = load_config(&app);
    config.show_text = show;
    save_config(&app, &config);
    rebuild_tray_menu(&app, &config)?;
    if let Some(window) = app.get_webview_window("main") {
        window.emit("text-visibility-changed", show).ok();
    }
    Ok(())
}

#[tauri::command]
fn set_reminder_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let mut config = load_config(&app);
    config.reminder_enabled = enabled;
    save_config(&app, &config);
    if let Some(window) = app.get_webview_window("main") {
        window.emit("reminder-toggled", enabled).ok();
    }
    Ok(())
}

#[tauri::command]
fn set_todo_reminder_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let mut config = load_config(&app);
    config.todo_reminder_enabled = enabled;
    save_config(&app, &config);
    Ok(())
}

#[tauri::command]
fn get_chat_data(app: tauri::AppHandle) -> ChatData {
    load_chat_data(&app)
}

#[tauri::command]
fn save_memories(
    app: tauri::AppHandle,
    personality: String,
    memories: Vec<String>,
) -> Result<(), String> {
    let mut data = load_chat_data(&app);
    data.memories.insert(personality, memories);
    save_chat_data(&app, &data);
    Ok(())
}

#[tauri::command]
fn save_conversations(
    app: tauri::AppHandle,
    conversations: HashMap<String, Vec<ChatMessage>>,
) -> Result<(), String> {
    // 更新对应猫格的最后聊天时间
    let mut config = load_config(&app);
    for (name, msgs) in &conversations {
        if let Some(last_msg) = msgs.last() {
            if let Some(p) = config.personalities.iter_mut().find(|p| p.name == *name) {
                p.last_chat_time = Some(last_msg.timestamp);
            }
        }
    }
    save_config(&app, &config);

    let mut data = load_chat_data(&app);
    data.conversations = conversations;
    save_chat_data(&app, &data);
    Ok(())
}

#[tauri::command]
fn broadcast_chat_message(app: tauri::AppHandle, personality: String, content: String) {
    use serde_json::json;
    app.emit("chat-new-message", json!({ "personality": personality, "content": content })).ok();
}

#[tauri::command]
fn get_todo_data(app: tauri::AppHandle) -> TodoData {
    load_todo_data(&app)
}

#[tauri::command]
fn save_todo_items(
    app: tauri::AppHandle,
    items: Vec<TodoItem>,
) -> Result<(), String> {
    let data = TodoData { items };
    save_todo_data(&app, &data);
    Ok(())
}

/// 打开/创建 Dashboard 统一窗口的内部辅助函数
fn open_dashboard_inner(app: &tauri::AppHandle, tab: &str) {
    if let Some(window) = app.get_webview_window("dashboard") {
        window.show().ok();
        window.set_focus().ok();
        window.emit("navigate-tab", tab).ok();
    } else {
        let url = format!("/#/dashboard/{}", tab);
        let _ = WebviewWindowBuilder::new(
            app,
            "dashboard",
            WebviewUrl::App(url.into()),
        )
        .title("小橘窝")
        .inner_size(700.0, 520.0)
        .resizable(true)
        .decorations(true)
        .build();
    }
}

#[tauri::command]
fn open_dashboard(app: tauri::AppHandle, tab: String) -> Result<(), String> {
    open_dashboard_inner(&app, &tab);
    Ok(())
}

/// 托盘菜单完全重建
fn rebuild_tray_menu(app: &tauri::AppHandle, config: &PersistedConfig) -> Result<(), String> {
    let (personality_submenu, _sub_items) = build_personality_submenu(
        app,
        &config.active_personality,
        &config.personalities,
    )
    .map_err(|e| e.to_string())?;

    let show_hide = MenuItemBuilder::with_id("show_hide", "隐藏 猫咪")
        .build(app).map_err(|e| e.to_string())?;
    let toggle_text = {
        let text = if config.show_text { "关闭文本" } else { "显示文本" };
        MenuItemBuilder::with_id("toggle_text", text)
            .build(app).map_err(|e| e.to_string())?
    };
    let toggle_reminder = {
        let text = if config.reminder_enabled { "关闭休息提醒" } else { "开启休息提醒" };
        MenuItemBuilder::with_id("toggle_reminder", text)
            .build(app).map_err(|e| e.to_string())?
    };
    let toggle_todo_reminder = {
        let text = if config.todo_reminder_enabled { "关闭备忘录提醒" } else { "开启备忘录提醒" };
        MenuItemBuilder::with_id("toggle_todo_reminder", text)
            .build(app).map_err(|e| e.to_string())?
    };
    let restart = MenuItemBuilder::with_id("restart", "重启 应用")
        .build(app).map_err(|e| e.to_string())?;
    let quit = MenuItemBuilder::with_id("quit", "退出")
        .build(app).map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(app)
        .item(&show_hide)
        .separator()
        .item(&personality_submenu)
        .item(&toggle_text)
        .item(&toggle_reminder)
        .item(&toggle_todo_reminder)
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

// --- 托盘提醒闪烁控制 ---

#[tauri::command]
fn set_tray_alert(app: tauri::AppHandle, message: String) {
    let tray_state = app.state::<TrayHandle>();
    let alert_state = app.state::<TrayAlertState>();

    if message.is_empty() {
        // 停止闪烁
        alert_state.flashing.store(false, Ordering::SeqCst);
        if let Ok(guard) = tray_state.0.lock() {
            if let Some(ref tray) = *guard {
                if let Ok(normal) = Image::from_bytes(include_bytes!("../icons/32x32.png")) {
                    tray.set_icon(Some(normal)).ok();
                }
                tray.set_tooltip(Some("")).ok();
            }
        }
    } else {
        // 开始闪烁
        alert_state.flashing.store(true, Ordering::SeqCst);
        let tray_handle = tray_state.0.clone();
        let flashing = alert_state.flashing.clone();

        // 设置 tooltip
        if let Ok(guard) = tray_handle.lock() {
            if let Some(ref tray) = *guard {
                tray.set_tooltip(Some(&message)).ok();
            }
        }

        // 后台线程：正常图标 ↔ 空图标交替闪烁
        std::thread::spawn(move || {
            let normal = Image::from_bytes(include_bytes!("../icons/32x32.png")).ok();
            let mut show_normal = true;
            while flashing.load(Ordering::SeqCst) {
                show_normal = !show_normal;
                if let Ok(guard) = tray_handle.lock() {
                    if let Some(ref tray) = *guard {
                        if show_normal {
                            if let Some(ref n) = normal {
                                tray.set_icon(Some(n.clone())).ok();
                            }
                        } else {
                            tray.set_icon(None).ok();
                        }
                    }
                }
                std::thread::sleep(Duration::from_millis(600));
            }
            // 恢复正常图标
            if let Ok(guard) = tray_handle.lock() {
                if let Some(ref tray) = *guard {
                    if let Some(ref n) = normal {
                        tray.set_icon(Some(n.clone())).ok();
                    }
                }
            }
        });
    }
}

// --- 待办提醒后台检查 ---

fn check_todo_reminders(app: &tauri::AppHandle) {
    let config = load_config(app);
    if !config.todo_reminder_enabled { return; }

    use tauri_plugin_notification::NotificationExt;
    let data = load_todo_data(app);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    // 收集所有到期提醒的 id 和文本
    let mut fired: Vec<(String, String)> = Vec::new();
    for item in &data.items {
        if let Some(remind_at) = item.remind_at {
            if remind_at <= now {
                fired.push((item.id.clone(), item.text.clone()));
            }
        }
    }

    if !fired.is_empty() {
        // 发送通知 + 通知主窗口（用于 AI 聊天集成）
        for (_id, text) in &fired {
            let _ = app
                .notification()
                .builder()
                .title("备忘录提醒")
                .body(text)
                .show();
            // 通知主窗口
            if let Some(window) = app.get_webview_window("main") {
                window.emit("reminder-triggered", text).ok();
            }
        }

        // 重新加载数据再修改，避免覆盖并发的用户保存
        let fired_ids: Vec<String> = fired.into_iter().map(|(id, _)| id).collect();
        let mut data = load_todo_data(app);
        for item in &mut data.items {
            if fired_ids.contains(&item.id) {
                match item.repeat_type.as_str() {
                    "daily" => {
                        if let Some(remind_at) = item.remind_at {
                            item.remind_at = Some(remind_at + 86400);
                        }
                    }
                    "interval" => {
                        if let (Some(remind_at), Some(interval)) = (item.remind_at, item.repeat_interval) {
                            item.remind_at = Some(remind_at + interval);
                        }
                    }
                    _ => {
                        item.remind_at = None;
                    }
                }
            }
        }
        save_todo_data(app, &data);
        if let Some(window) = app.get_webview_window("dashboard") {
            window.emit("todo-reminder-fired", ()).ok();
        }
    }
}

// --- 程序入口 ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(PersonalityState(Mutex::new("calm".to_string())))
        .manage(TrayHandle(Arc::new(Mutex::new(None))))
        .manage(TrayAlertState { flashing: Arc::new(AtomicBool::new(false)) })
        .invoke_handler(tauri::generate_handler![
            get_personality,
            get_config,
            get_chat_data,
            save_personality,
            delete_personality,
            open_dashboard,
            set_api_key,
            set_active_personality,
            set_show_text,
            set_reminder_enabled,
            set_todo_reminder_enabled,
            save_memories,
            save_conversations,
            broadcast_chat_message,
            get_todo_data,
            save_todo_items,
            set_tray_alert,
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

            let (personality_submenu, sub_items) = build_personality_submenu(
                app.handle(),
                &active,
                &config.personalities,
            )?;

            let toggle_text = {
                let text = if config.show_text { "关闭文本" } else { "显示文本" };
                MenuItemBuilder::with_id("toggle_text", text).build(app)?
            };
            let toggle_reminder = {
                let text = if config.reminder_enabled { "关闭休息提醒" } else { "开启休息提醒" };
                MenuItemBuilder::with_id("toggle_reminder", text).build(app)?
            };
            let toggle_todo_reminder = {
                let text = if config.todo_reminder_enabled { "关闭备忘录提醒" } else { "开启备忘录提醒" };
                MenuItemBuilder::with_id("toggle_todo_reminder", text).build(app)?
            };
            let restart = MenuItemBuilder::with_id("restart", "重启 应用").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .separator()
                .item(&personality_submenu)
                .item(&toggle_text)
                .item(&toggle_reminder)
                .item(&toggle_todo_reminder)
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
                        "toggle_text" => {
                            let mut config = load_config(app);
                            config.show_text = !config.show_text;
                            save_config(app, &config);
                            let _ = rebuild_tray_menu(app, &config);
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("text-visibility-changed", config.show_text).ok();
                            }
                        }
                        "toggle_reminder" => {
                            let mut config = load_config(app);
                            config.reminder_enabled = !config.reminder_enabled;
                            save_config(app, &config);
                            let _ = rebuild_tray_menu(app, &config);
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("reminder-toggled", config.reminder_enabled).ok();
                            }
                        }
                        "toggle_todo_reminder" => {
                            let mut config = load_config(app);
                            config.todo_reminder_enabled = !config.todo_reminder_enabled;
                            save_config(app, &config);
                            let _ = rebuild_tray_menu(app, &config);
                        }
                        "open_settings" | "open_chat" | "open_todo" => {
                            let tab = match id.as_str() {
                                "open_settings" => "settings",
                                "open_chat" => "chat",
                                "open_todo" => "todo",
                                _ => "chat",
                            };
                            open_dashboard_inner(app, tab);
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
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        // 托盘闪烁时：打开聊天室并停止闪烁
                        let alert_state = app.state::<TrayAlertState>();
                        if alert_state.flashing.load(Ordering::SeqCst) {
                            // 停止闪烁
                            alert_state.flashing.store(false, Ordering::SeqCst);
                            if let Ok(tray_guard) = app.state::<TrayHandle>().0.lock() {
                                if let Some(ref t) = *tray_guard {
                                    if let Ok(icon) = Image::from_bytes(include_bytes!("../icons/32x32.png")) {
                                        t.set_icon(Some(icon)).ok();
                                    }
                                    t.set_tooltip(Some("")).ok();
                                }
                            }
                            // 通知主窗口退出提醒状态
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("reminder-dismissed", ()).ok();
                            }
                            // 打开 Dashboard（聊天标签）
                            open_dashboard_inner(app, "chat");
                            if let Some(window) = app.get_webview_window("dashboard") {
                                window.emit("chat-reload", ()).ok();
                            }
                        } else {
                            // 正常情况：左键打开 Dashboard
                            open_dashboard_inner(app, "chat");
                        }
                    }
                })
                .build(app)?;

            // 存储托盘句柄以便后续动态重建菜单
            *app.state::<TrayHandle>().0.lock().unwrap() = Some(tray);

            // 启动时检查错过的提醒
            let app_handle = app.handle().clone();
            check_todo_reminders(&app_handle);

            // 后台线程每 30 秒检查一次
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_secs(30));
                    check_todo_reminders(&app_handle);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
