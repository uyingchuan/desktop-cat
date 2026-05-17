# Desktop Cat - Project Overview

Tauri v2 desktop pet app. A cat overlay that sits on screen and reacts to keyboard, mouse, and gamepad input. The window is transparent, always-on-top, undecorated (300x300), and skips the taskbar.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 (Rust backend) |
| Frontend | React 19 + TypeScript 6 |
| Build | Vite 8 |
| State | Zustand 5 (with `persist` middleware) |
| CSS | Tailwind CSS 4 |
| Package manager | pnpm 10 |

Key Rust deps: `rdev` (global input capture), `gilrs` (gamepad), `serde`/`serde_json`
Tauri plugins: log, single-instance, autostart, global-shortcut, fs, dialog, process, opener, os

## Directory Structure

```
desktop-cat/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point (ReactDOM.createRoot)
│   ├── App.tsx                   # Root component - bootstraps runtime systems
│   ├── index.css                 # Tailwind + transparent window styles
│   ├── components/
│   │   ├── Cat.tsx               # Main pet display (sprites + overlays)
│   │   ├── KeyboardOverlay.tsx   # Key-press highlight overlay (keyboard mode)
│   │   └── GamepadOverlay.tsx    # Gamepad button state text overlay
│   ├── engine/
│   │   ├── petEngine.ts          # Orchestrator: InputSystem + PetStateMachine + KeyZoneDetector
│   │   ├── inputSystem.ts        # Diff-based key state tracker (prev vs current keys)
│   │   ├── petStateMachine.ts    # FSM: idle / left_paw / right_paw / wave
│   │   ├── animationMapper.ts    # PetState → SpriteKey mapping
│   │   ├── keyZoneDetector.ts    # Maps keystrokes to 4 screen zones
│   │   └── renderer/
│   │       ├── Renderer.ts       # Renderer interface
│   │       └── SpriteRenderer.ts # Sprite-based renderer
│   ├── hooks/
│   │   ├── useDrag.ts            # Tauri window drag hook
│   │   └── useKeyPress.ts        # Global shortcut registration hook
│   ├── runtime/
│   │   ├── core/
│   │   │   ├── Runtime.ts        # Runtime interface, RuntimeContext, RuntimeFactory types
│   │   │   ├── RuntimeManager.ts # Topological-sort lifecycle manager (startAll/stopAll)
│   │   │   ├── EventBus.ts       # Typed pub/sub event bus
│   │   │   ├── Scheduler.ts      # rAF-based task scheduler with priority/group
│   │   │   ├── Logger.ts         # ConsoleLogger with scoped prefixes
│   │   │   └── DisposableStack.ts# LIFO async disposal stack
│   │   └── systems/
│   │       ├── createAppRuntime.ts       # Tray icon, menus, GitHub link, app metadata
│   │       ├── createWindowRuntime.ts    # Window position/size persistence, reactive props
│   │       ├── createInputRuntime.ts     # rdev events → PetEngine pipeline
│   │       ├── createGamepadRuntime.ts   # gilrs events → EventBus
│   │       ├── createAnimationRuntime.ts # Cursor damping (exponential smoothing), hide-on-hover
│   │       └── createRendererRuntime.ts  # SpriteRenderer init + per-frame sync
│   ├── stores/
│   │   ├── appStore.ts           # Persisted: metadata, window state, general prefs
│   │   ├── modelStore.ts         # Models list, current model, pressed keys
│   │   ├── runtimeStore.ts       # Live: FSM state, sprite, mouse pos, active zone
│   │   └── settingsStore.ts      # Persisted: model/window/shortcut settings
│   ├── types/
│   │   ├── pet.ts                # PetState, PetEvent, MotionInfo, ExpressionInfo
│   │   └── input.ts              # InputSnapshot, DeviceEvent, GamepadEvent, ModelInfo
│   ├── constants/
│   │   └── index.ts              # Tauri listen/invoke keys, window labels, GitHub URL
│   └── utils/
│       ├── platform.ts           # isMac / isWindows / isLinux
│       ├── keyboard.ts           # Key definition tables (modifier + standard keys)
│       ├── path.ts               # Cross-platform path.join
│       ├── is.ts                 # isImage(), inBetween()
│       └── monitor.ts            # Cached cursor-monitor lookup
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Window config: 300x300, transparent, alwaysOnTop, skipTaskbar
│   ├── capabilities/default.json # Tauri v2 permissions
│   ├── src/
│   │   ├── main.rs               # Windows subsystem attribute, delegates to app_lib::run()
│   │   ├── lib.rs                # Tauri Builder: plugins, commands, window events
│   │   ├── core/
│   │   │   ├── device.rs         # rdev global keyboard/mouse listener → "device-changed" event
│   │   │   ├── gamepad.rs        # gilrs gamepad poller → "gamepad-changed" event
│   │   │   └── setup/            # Platform-specific init (debug: opens devtools)
│   │   └── utils/
│   │       └── fs_extra.rs       # Recursive dir copy Tauri command
│   └── assets/
│       └── tray.png              # System tray icon
├── packages/
│   ├── BongoCat/                 # Reference implementation (Vue 3 + Live2D, separate project)
│   └── bongocat-osu/             # C++ osu! overlay (separate project)
└── public/                       # Static assets (favicon, icons)
```

## Architecture

### Runtime System (ECS-like)

`App.tsx` creates a `RuntimeContext` (EventBus, Scheduler, DisposableStack, Logger, 4 Zustand stores) and an `RuntimeManager`. Six runtime systems are registered with dependency order:

```
app ──┬── input ── animation ── renderer
      └── gamepad
window
```

The `RuntimeManager` topologically sorts systems and calls `start()` in order, `stop()` in reverse.

Each runtime is a `{ name, dependencies[], start(), stop() }` object created by a factory `(ctx: RuntimeContext) => Runtime`.

### Event Bus

Typed pub/sub (`EventBus.ts`) with predefined events:
- `input:keypress`, `input:keyrelease`, `input:mousemove`, `input:mousepress`, `input:mouserelease`
- `gamepad:button`, `gamepad:axis`
- `window:moved`, `window:resized`
- `app:ready`, `app:shutdown`, `app:tray`

### Input Pipeline

```
Physical devices
  → rdev/gilrs (Rust, device.rs/gamepad.rs)
    → "device-changed" / "gamepad-changed" Tauri events
      → createInputRuntime / createGamepadRuntime (JS)
        → PetEngine.process(snapshot)
          ├── InputSystem → PetEvent (KEY_DOWN / KEY_UP / ALL_KEYS_UP)
          ├── PetStateMachine → state transition → runtimeStore
          └── KeyZoneDetector → zone number → runtimeStore
            → Cat.tsx re-renders sprites
```

### PetStateMachine FSM

```
idle ──(Z down)──→ left_paw ──(X down)──→ right_paw
  │                    │                      │
  ├──(X down)──→ right_paw                   │
  ├──(V down)──→ wave                        │
  │                    │                      │
  └──(release/all up)──←─────────────────────┘
```

### KeyZoneDetector

Maps keys to 4 screen zones (0-4), used to pick which hand sprite to show:
- Zone 1 (left): `, 1, 2, Tab, Q, W, CapsLock, A, S, LShift, Z, X, LCtrl, LWin, LAlt`
- Zone 2 (mid-left): 3, 4, E, R, D, F, C, V
- Zone 3 (mid-right): 5, 6, 7, T, Y, U, G, H, J, B, N, M
- Zone 4 (right): 8, 9, 0, punctuation, I, O, P, K, L, Enter, Backspace, etc.
- Zone 0: unmapped

Zones stack on key-down, pop on key-up; `activeZone` is the most recently pressed zone.

## State Management (4 Zustand Stores)

- **appStore** (persisted, key: `app-store`): app name/version, window position/size per label, autostart, theme
- **settingsStore** (persisted, key: `settings-store`): model config (mirror, sound, behavior, autoReleaseDelay, maxFPS), window config (visible, passThrough, alwaysOnTop, scale, opacity, radius, hideOnHover), shortcuts
- **modelStore** (transient): model list (presets + custom), current model, support keys, pressed keys
- **runtimeStore** (transient): current FSM state, current sprite, active zone, mouse position, listening status flags

## Three Modes

The app has three display modes controlled by the current model:
1. **standard** - static cat sprite with hand overlays reacting to keyboard zones
2. **keyboard** - keyboard overlay with individual key highlight sprites
3. **gamepad** - text overlay showing pressed gamepad buttons

## Rust Backend Commands

| Command | Purpose |
|---------|---------|
| `start_device_listening` | Start rdev global keyboard/mouse listener |
| `start_gamepad_listing` | Start gilrs gamepad poll loop |
| `stop_gamepad_listing` | Stop gilrs poll loop |
| `copy_dir` | Recursive directory copy (fs_extra) |

## Window Behavior

- Close button hides the window instead of quitting (intercepted in `lib.rs` via `WindowEvent::CloseRequested`)
- Single-instance plugin: second launch shows existing window
- macOS: `Reopen` event shows+focuses the main window

## Key Conventions

- Runtime systems use `createXxxRuntime(ctx): Runtime` factory pattern
- Event names follow `domain:action` format (e.g. `input:keypress`, `app:ready`)
- Tauri listen keys are PascalCase constants (`LISTEN_KEY.DEVICE_CHANGED`)
- Tauri invoke keys are UPPER_SNAKE_CASE constants (`INVOKE_KEY.START_DEVICE_LISTENING`)
- Zustand stores use `set` + partial updates, not immer
- Path alias: none configured (use relative imports within src/)
