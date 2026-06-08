# Neko Desktop Cat

A Tauri v2 desktop pet app featuring a pixel-art cat with AI chat, personality system, todo reminders, and tray notifications.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Zustand v5 |
| Build | Vite 8 |
| AI API | DeepSeek (OpenAI-compatible) |
| Animation | CSS `@keyframes` sprite sheet |
| Package Manager | pnpm |

## Project Structure

```
src/                  # React frontend
├── main.tsx          # Entry point
├── App.tsx           # Hash router (#/ → Cat, #/settings, #/chat, #/todo)
├── components/
│   ├── Cat.tsx       # Main cat window (click/double-click handlers)
│   ├── CatSprite.tsx # CSS sprite animation renderer
│   ├── SpeechBubble.tsx  # Auto-dismissing speech bubble (2.5s)
│   ├── FloatingChatInput.tsx # Inline chat overlay (double-click cat)
│   ├── ChatRoom.tsx      # Full chat window with history
│   ├── PersonalityEditor.tsx # Personality/settings management
│   └── TodoPanel.tsx     # Todo/memo list with reminder UI
├── hooks/
│   └── useCatBehavior.ts # Autonomous behavior state machine + reminders
├── stores/
│   ├── usePetStore.ts    # Pet state (position, animation, personality)
│   ├── useChatStore.ts   # Per-personality conversation history
│   ├── useMemoryStore.ts # AI-extracted user facts per personality
│   └── useTodoStore.ts   # Todo items with reminder support
├── services/
│   ├── llm.ts            # DeepSeek API client (chatCompletion)
│   ├── memory.ts         # Auto memory extraction via LLM
│   └── reminderChat.ts   # Generate personality-styled reminder messages
├── types/
│   ├── pet.ts            # PetState, PersonalityParams, animation types
│   └── todo.ts           # TodoItem, RepeatType
├── animation/
│   ├── animations.css    # CSS @keyframes for 11 animation states
│   └── spriteConfig.ts   # Sprite frame counts and timing
└── assets/
    └── cat-pixel-animations/  # 11 animation types, each left/right

src-tauri/            # Rust backend
├── src/
│   ├── lib.rs        # All Tauri commands, tray, config, persistence, reminders
│   └── main.rs       # Rust entry point (windows_subsystem)
├── tauri.conf.json   # Window config (120x150, transparent, always-on-top)
├── Cargo.toml        # Rust deps: tauri, serde, tauri-plugin-notification
├── capabilities/
│   └── default.json  # Tauri v2 permissions (windows: main,settings,todo,chat)
└── icons/            # 32x32.png for tray
```

## Windows and Routing

Four Tauri webview windows, each with independent JS context:

| Window | Label | Hash | Size | Notes |
|--------|-------|------|------|-------|
| Main cat | `"main"` | `#/` | 120×150 | Transparent, always-on-top, no decorations |
| Settings | `"settings"` | `#/settings` | 700×520 | Non-resizable |
| Chat | `"chat"` | `#/chat` | 400×560 | Resizable |
| Todo | `"todo"` | `#/todo` | 360×500 | Resizable |

**Important**: Each window has its own Zustand store instance. Cross-window state sharing goes through Rust backend (persist → emit event → reload). Never assume stores are shared between windows.

## Key Features

### Cat Behavior (useCatBehavior.ts)
- Weighted random state machine: 11 animation states (idle, idle2, walking, running, sleeping, playing, floating, licking, attacking, hurt, dead)
- 4 personality sliders map to transition weights: activity, sleepiness, grooming, playfulness
- Window movement via `requestAnimationFrame` + `setPosition`
- Draggable by user, autonomous walking otherwise
- Speech bubbles with 30% chance on state transition

### Personality System
- 2 built-in personalities: `calm` (慵懒) and `active` (活泼)
- Custom personalities with 4 sliders (0-100), custom speech lines per animation state, custom system prompts
- System prompt used for both chat and reminder generation
- Persisted in `config.json`

### Chat / AI
- DeepSeek API integration (`services/llm.ts` — `chatCompletion(messages, apiKey)`)
- Two chat interfaces: full ChatRoom window + inline FloatingChatInput
- Per-personality conversation history (max 100 messages)
- AI auto-extracts user facts into memories (`services/memory.ts`)
- Memories injected into system prompt via `formatMemoriesForPrompt`

### Todo / Memo (TodoPanel.tsx)
- CRUD todo list with completion toggle and delete
- Per-item reminder: one-shot (`once`), daily repeat (`daily`), interval repeat (`interval`)
- Reminder popover with datetime-local, time, or interval picker
- New items appear at top
- Data persisted to `todo_data.json`

### Reminder System
Three types of reminders:

1. **30-min break reminder**: Timer in `useCatBehavior.ts` → cat walks + speech bubble + AI chat message + tray flash
2. **Todo one-shot**: `remind_at` timestamp, cleared after fire
3. **Todo repeat**: daily (24h advance) or interval (periodic advance), managed by Rust `check_todo_reminders`

**Reminder flow**:
```
Reminder fires → Rust check_todo_reminders / frontend timer
  → OS notification via tauri-plugin-notification
  → emit("reminder-triggered", text) to main window (for todo)
  → triggerReminderChat(): LLM generates personality-styled message
  → useChatStore.addMessage() + persist to disk
  → Rust broadcast_chat_message() → global event to chat window
  → invoke("set_tray_alert", message) → tray flash + tooltip
User dismisses: click cat OR click tray icon
  → stop flash, stop cat animation, open chat room
```

### Tray Icon
- Context menu: show/hide, personality switch, toggle text, toggle reminder, open windows, restart, quit
- Left click: toggle main window visibility (or open chat if flashing)
- Flashing: `set_icon(Some(normal))` ↔ `set_icon(None)` every 600ms
- Tooltip shows latest reminder message during flash
- Flashing controlled by `TrayAlertState.flashing` (AtomicBool)

### Data Persistence
Three JSON files in app data dir:

| File | Rust Struct | Contents |
|------|-------------|----------|
| `config.json` | `PersistedConfig` | active_personality, custom_personalities, show_text, reminder_enabled, deepseek_api_key |
| `chat_data.json` | `ChatData` | conversations (per-personality), memories (per-personality) |
| `todo_data.json` | `TodoData` | items (Vec of TodoItem with repeat_type, repeat_interval, remind_at) |

## Naming Conventions

- Rust structs: PascalCase (`TodoItem`, `ChatData`)
- Rust fields: snake_case (`remind_at`, `created_at`)
- JS/TS fields: snake_case to match Rust serialization (`remind_at`, `repeat_type`)
- React components: PascalCase (`TodoPanel`, `ChatRoom`)
- Hooks: camelCase with `use` prefix (`useCatBehavior`)
- Stores: camelCase with `use` prefix (`useTodoStore`)
- CSS classes: kebab-case (`.todo-reminder-btn`)

## Common Pitfalls

1. **Cross-window state**: Each Tauri webview has isolated JS context. Always use Rust `app.emit()` (global) for cross-window events, never frontend `emit()` (may not cross webview boundaries).
2. **Capabilities**: New windows must be added to `capabilities/default.json` `windows` array.
3. **Serde defaults**: Always add `#[serde(default)]` to new fields for backward compatibility with existing JSON data.
4. **Tauri plugin registration**: New plugins need `.plugin(...)` in builder + capability permission + Cargo.toml dependency.
5. **TrayAlertState**: Uses `Arc<AtomicBool>` for thread-safe flashing control. The `set_tray_alert` command spawns a `std::thread` with the tray handle.
