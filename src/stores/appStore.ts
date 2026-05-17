import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// -- Types --

export type Theme = 'auto' | 'light' | 'dark'

export interface AppStore {
  // App metadata
  name: string
  version: string

  // Window state persistence
  windowState: Record<string, { x?: number; y?: number; width?: number; height?: number } | undefined>

  // General
  autostart: boolean
  taskbarVisible: boolean
  trayVisible: boolean
  theme: Theme
  isDark: boolean
  autoCheckUpdate: boolean

  // Actions
  setMetadata: (name: string, version: string) => void
  setWindowState: (label: string, state: { x?: number; y?: number; width?: number; height?: number }) => void
  setGeneral: (partial: Partial<Pick<AppStore, 'autostart' | 'taskbarVisible' | 'trayVisible' | 'theme' | 'isDark' | 'autoCheckUpdate'>>) => void
}

// -- Store --

export const appStore = create<AppStore>()(
  persist(
    (set) => ({
      name: '',
      version: '',
      windowState: {},

      autostart: false,
      taskbarVisible: false,
      trayVisible: true,
      theme: 'auto',
      isDark: false,
      autoCheckUpdate: false,

      setMetadata: (name, version) => set({ name, version }),
      setWindowState: (label, state) =>
        set((s) => ({
          windowState: { ...s.windowState, [label]: { ...s.windowState[label], ...state } },
        })),
      setGeneral: (partial) => set(partial),
    }),
    { name: 'app-store' },
  ),
)

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    newModule.appStore.setState(appStore.getState())
  })
}
