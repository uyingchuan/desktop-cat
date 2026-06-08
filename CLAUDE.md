# 小橘窝 - Neko Desktop Cat

A Tauri v2 desktop pet app featuring a pixel-art cat with multi-personality AI chat, memory, todo reminders, and system tray integration. The cat lives in a transparent always-on-top overlay window; all management UI is in a separate dashboard window.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri v2 (Rust), tray-icon + notification plugins |
| Frontend | React 19 + TypeScript + Zustand v5 + React Router |
| Build | Vite 8 |
| AI | DeepSeek API (OpenAI-compatible chat completions) |
| Animation | CSS `@keyframes` with `steps()` for 32x32 pixel sprite sheets |

## Windows

Two Tauri webview windows, each with independent JS context:

| Label | Size | Style | Route | Purpose |
|-------|------|-------|-------|---------|
| `main` | 120×150 | Transparent, always-on-top, skip-taskbar, no decorations | `/*` | Cat overlay |
| `dashboard` | 700×520 | Standard decorated, titled "小橘窝" | `/#/dashboard/*` | Chat, todo, settings |

**Important**: Each webview has isolated JS context. Zustand stores are NOT shared across windows. Cross-window communication goes through Rust backend (persist → `app.emit()` global event → reload on other side).

## Project Structure

```
src/
├── main.tsx              # React entry, HashRouter
├── App.tsx               # Route: /* → Cat, /dashboard/* → Dashboard
├── components/
│   ├── Cat.tsx           # Main cat overlay (click/double-click/drag)
│   ├── CatSprite.tsx     # CSS sprite animation renderer (32x32 → 3x scale)
│   ├── SpeechBubble.tsx  # Auto-dismissing text bubble (2.5s)
│   ├── FloatingChatInput.tsx # Inline chat overlay (double-click cat)
│   ├── Dashboard.tsx     # Sidebar + nested router for all management UI
│   ├── ChatRoom.tsx      # Chat panel + per-personality settings editor
│   ├── PersonalityEditor.tsx # Global settings (API key, toggles)
│   └── TodoPanel.tsx     # Todo list with repeat reminder UI
├── hooks/
│   └── useCatBehavior.ts # Autonomous behavior FSM, 30-min reminder, event listeners
├── stores/
│   ├── usePetStore.ts    # Cat state: position, animation, personality, speech, reminding
│   ├── useChatStore.ts   # Per-personality conversations (max 100 msgs, timestamped)
│   ├── useMemoryStore.ts # AI-extracted user facts per personality
│   └── useTodoStore.ts   # Todo items with reminder fields, auto-persist
├── services/
│   ├── llm.ts            # chatCompletion(messages, apiKey) → DeepSeek
│   ├── memory.ts         # extractMemories() + formatMemoriesForPrompt()
│   └── reminderChat.ts   # generateReminderMessage() — LLM-styled reminder text
├── types/
│   ├── pet.ts            # PersonalityParams, PetAnimationState, BUILTIN_PARAMS
│   └── todo.ts           # TodoItem, RepeatType
└── animation/
    ├── animations.css    # @keyframes for 11 animation states
    └── spriteConfig.ts   # Frame counts, timing, sprite imports

src-tauri/
├── src/
│   ├── lib.rs            # All Tauri commands, tray, persistence, background tasks
│   └── main.rs           # Entry point (windows_subsystem = "windows")
├── tauri.conf.json       # Window definitions
├── Cargo.toml            # tauri, serde, tauri-plugin-notification, tauri-plugin-log
├── capabilities/
│   └── default.json      # Permissions for main + dashboard windows
└── icons/                # 32x32.png (tray icon)
```

## Dashboard Routing

Dashboard uses React Router with sidebar navigation:

| Route | Content | Sidebar Tab |
|-------|---------|-------------|
| `/dashboard/chat/:personalityId` | ChatRoom (chat mode) | Per-personality, sorted by lastChatTime |
| `/dashboard/chat/:personalityId/settings` | ChatRoom (settings mode) | — |
| `/dashboard/todo` | TodoPanel | Bottom tab "Todo" |
| `/dashboard/settings` | PersonalityEditor (global) | Bottom tab "Settings" |

`personalityId` is the `id` field on `PersonalityParams` (not `name`). `ChatRoute` resolves `personalityId` → `personality.name` before passing to ChatRoom.

## Personality System

Each personality stored as `PersonalityParams` in a `Vec` in `config.json`:

```typescript
interface PersonalityParams {
  id: string;           // UUID
  name: string;         // Unique key for conversations/memories
  displayName?: string; // Shown in UI
  activity: number;     // 0-100
  sleepiness: number;   // 0-100
  grooming: number;     // 0-100
  playfulness: number;  // 0-100
  speeches?: Record<string, string[]>;    // Custom per-state speech lines
  systemPrompt?: string;                   // Chat system prompt
  lastChatTime?: number;                   // For tab sorting
}
```

Two built-in personalities (`calm` / `active`) with presets in `BUILTIN_PARAMS`. Custom personalities created/edited/deleted via `save_personality` / `delete_personality` commands. Backward compat: old `custom_personalities` HashMap is migrated to `personalities` Vec on load.

The 4 sliders (activity, sleepiness, grooming, playfulness) are mapped to a weighted state transition table in `useCatBehavior.ts` via `paramsToTransitionTable()`.

## Stores (Zustand)

**usePetStore**: `position`, `animationState`, `mood`, `facingDirection`, `personality` (string), `personalityParams`, `speech`, `showText`, `reminding`, `reminderEnabled`, `chatting`

**useChatStore**: `conversations: Record<string, ChatMessage[]>` — keyed by personality name. `ChatMessage: { role, content, timestamp }`. MAX 100 per personality. `addMessage` auto-stamps timestamp and persists.

**useTodoStore**: `items: TodoItem[]`. CRUD + `setReminder(id, remindAt, repeatType, repeatInterval)` + `clearReminder`. Auto-persists.

**useMemoryStore**: `memories: Record<string, string[]>` — facts per personality. `updateMemories` / `clearMemories`.

## Rust Backend Commands

| Command | Purpose |
|---------|---------|
| `get_config` | Return PersistedConfig (personalities, toggles, api key) |
| `get_chat_data` | Return ChatData (conversations + memories) |
| `save_personality` | Upsert a personality, rebuild tray, emit events |
| `delete_personality` | Remove, fallback to first, blocks if last one |
| `set_active_personality` | Switch active personality |
| `set_api_key` | Save DeepSeek API key |
| `set_show_text` | Toggle speech bubble visibility |
| `set_reminder_enabled` | Toggle 30-min rest reminder |
| `set_todo_reminder_enabled` | Toggle todo reminder |
| `open_dashboard` | Show/focus dashboard window, navigate to tab |
| `save_memories` | Persist per-personality memories |
| `save_conversations` | Persist all conversations, update lastChatTime |
| `broadcast_chat_message` | Emit `chat-new-message` global event |
| `get_todo_data` | Return all todo items |
| `save_todo_items` | Persist all todo items |
| `set_tray_alert` | Start/stop tray icon flash + set tooltip |
| `get_personality` | Return active personality name |

## Reminder System

### 30-minute Rest Reminder
- Triggered by `setTimeout` in `useCatBehavior.ts`
- Cat enters `reminding` state: walks + speech bubble loop
- Also fires AI reminder: `generateReminderMessage() → addMessage() → broadcast → tray flash`
- Dismissed by: clicking cat, clicking tray icon, or toggling reminder off

### Todo Reminders
- Background thread in Rust (`check_todo_reminders`) runs on startup + every 30s
- Checks all items where `remind_at <= now`
- Fires OS notification + emits `reminder-triggered` to main window
- Frontend generates AI chat message + tray flash
- Repeat modes:
  - `"once"` — clear `remind_at` after fire
  - `"daily"` — advance `remind_at` by 86400s
  - `"interval"` — advance `remind_at` by `repeat_interval` seconds

### Tray Alert
- `set_tray_alert(message)` starts a background thread alternating `set_icon(Some(icon))` / `set_icon(None)` every 600ms
- Sets tooltip to the message text
- Left-click during flash: dismiss reminder, open dashboard chat, stop flash
- After message sent: `broadcast_chat_message` Rust command emits `chat-new-message` event globally → dashboard chat tab reloads

## Important Patterns

1. **Cross-window events**: Always use Rust `app.emit()` (global to all windows), never frontend `emit()` from `@tauri-apps/api/event` (may not cross webview boundaries).
2. **New windows**: Must be added to `capabilities/default.json` `"windows"` array or they won't have permission to use `listen`, `invoke`, etc.
3. **Backward compatibility**: Add `#[serde(default)]` to all new Rust struct fields. Old data files won't have them.
4. **Personality keying**: Chat conversations and memories are keyed by `name` (not `id`), since name is stable and user-visible. Todo items are global (not per-personality).
5. **TrayAlertState**: Uses `Arc<AtomicBool>` for thread-safe flashing control. `set_tray_alert` spawns `std::thread::spawn`.
6. **Naming**: Rust `snake_case`, TS also `snake_case` (matching serde serialization), React `PascalCase` components, CSS `kebab-case`.
