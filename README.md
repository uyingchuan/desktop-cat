# 🐱 Desktop Cat / 桌面猫猫

A pixel-art desktop pet cat that wanders around your screen, chats with you via AI, and keeps you company while you work.

一只像素风的桌面宠物猫猫，会在屏幕上自由走动，通过 AI 和你聊天，陪你工作摸鱼。

Built with **Tauri v2** + **React 19** + **TypeScript** + **Zustand**.

## ✨ Features / 功能

- **Autonomous Behavior / 自主行为** — The cat wanders, runs, sleeps, grooms, plays, and more based on a weighted personality-driven state machine.
- **Personality System / 猫格系统** — Built-in "Calm" (慵懒) and "Active" (活泼) personalities, plus custom personalities with adjustable sliders for activity, sleepiness, grooming, and playfulness.
- **AI Chat / AI 聊天** — Chat with your cat using DeepSeek API. Two modes:
  - **Quick Chat / 快速聊天**: Double-click the cat → floating input → reply in speech bubble
  - **Chat Room / 聊天室**: System tray menu → dedicated chat window with full conversation history
- **Auto Memory / 自动记忆** — The cat learns about you over time. Facts extracted from conversations persist across restarts.
- **Speech Bubbles / 语音气泡** — The cat randomly speaks cute phrases in its current personality. Customize speech lines per personality.
- **Break Reminder / 休息提醒** — Every 30 minutes, the cat reminds you to take a break and stretch.
- **System Tray / 系统托盘** — Tray icon with menu for show/hide, personality switching, toggles, and settings.
- **Persistent Config / 配置持久化** — All settings, chat history, and memories survive app restarts.

## 🖥️ Preview / 预览

The cat renders as a 32×32 pixel-art sprite (scaled 3×) in a transparent, always-on-top window. It freely moves, performs actions, and interacts with the desktop.

猫猫以 32×32 像素精灵图渲染（3倍缩放），显示在透明置顶窗口中，自由移动并与桌面互动。

## 🚀 Getting Started / 快速开始

### Prerequisites / 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 10
- [Rust](https://www.rust-lang.org/) (for Tauri)

### Install & Run / 安装和运行

```bash
# Install dependencies / 安装依赖
pnpm install

# Run in development mode / 开发模式运行
pnpm tauri dev

# Build for production / 构建发布版本
pnpm tauri build
```

### AI Chat Setup / AI 聊天配置

1. Get a [DeepSeek API Key](https://platform.deepseek.com/)
2. Right-click tray icon → 个性管理... (Personality Management)
3. Paste your API key at the top
4. Chat with your cat via double-click or the 聊天室 tray menu

## 🛠️ Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|---|---|
| Desktop Shell / 桌面壳 | **Tauri v2** (Rust) |
| Frontend / 前端 | **React 19** + **TypeScript** |
| State / 状态管理 | **Zustand** |
| Rendering / 渲染 | CSS Sprite-sheet Animations |
| AI / AI | DeepSeek API (OpenAI-compatible) |
| Package Manager | **pnpm** |

## 📁 Project Structure / 项目结构

```
src/
├── components/
│   ├── Cat.tsx              # Main cat wrapper (drag, click, double-click)
│   ├── CatSprite.tsx        # CSS sprite renderer
│   ├── SpeechBubble.tsx     # Speech bubble overlay
│   ├── FloatingChatInput.tsx# Quick chat input (double-click cat)
│   ├── ChatRoom.tsx         # Full chat room window
│   └── PersonalityEditor.tsx# Personality & settings editor
├── hooks/
│   └── useCatBehavior.ts    # Autonomous behavior FSM
├── stores/
│   ├── usePetStore.ts       # Global pet state (position, animation, etc.)
│   ├── useChatStore.ts      # Per-personality conversation history
│   └── useMemoryStore.ts    # AI memory (extracted user facts)
├── services/
│   ├── llm.ts               # DeepSeek API client
│   └── memory.ts            # Auto-memory extraction service
├── animation/
│   ├── animations.css       # CSS @keyframes for sprite playback
│   └── spriteConfig.ts      # Sprite frame count & timing config
├── types/
│   └── pet.ts               # TypeScript type definitions
├── assets/
│   └── cat-pixel-animations/# 11 animation sprite sheets
├── App.tsx                  # Hash router (#/, #/settings, #/chat)
└── main.tsx                 # React entry point

src-tauri/
├── src/
│   ├── lib.rs               # Tauri setup, tray menu, config persistence, commands
│   └── main.rs              # Rust entry point
├── tauri.conf.json          # Window config (transparent, always-on-top)
└── capabilities/            # Tauri v2 permission capabilities
```

## 🎨 Animations / 动画

The cat has 11 animation states with separate sprite sheets for left/right facing directions:

`idle` | `idle2` | `walking` | `running` | `sleeping` | `playing` | `floating` | `licking` | `attacking` | `hurt` | `dead`

Each animation is driven by CSS `@keyframes` with `steps()` timing for frame-by-frame pixel-art playback at 32×32 resolution.

## 📝 License

MIT
