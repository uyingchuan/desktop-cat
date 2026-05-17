import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// -- Types --

export interface SettingsStore {
  // Cat model settings
  model: {
    mirror: boolean
    mouseMirror: boolean
    motionSound: boolean
    behavior: boolean
    autoReleaseDelay: number
    maxFPS: number
    ignoreMouse: boolean
  }

  // Window settings
  window: {
    visible: boolean
    passThrough: boolean
    alwaysOnTop: boolean
    scale: number
    opacity: number
    radius: number
    hideOnHover: boolean
    hideOnHoverDelay: number
    keepInScreen: boolean
  }

  // Shortcuts
  shortcut: {
    visibleCat: string
    visiblePreference: string
    mirrorMode: string
    penetrable: string
    alwaysOnTop: string
  }

  // Actions
  setModel: (partial: Partial<SettingsStore['model']>) => void
  setWindow: (partial: Partial<SettingsStore['window']>) => void
  setShortcut: (key: keyof SettingsStore['shortcut'], value: string) => void
}

// -- Store --

export const settingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      model: {
        mirror: false,
        mouseMirror: false,
        motionSound: true,
        behavior: true,
        autoReleaseDelay: 3,
        maxFPS: 60,
        ignoreMouse: false,
      },

      window: {
        visible: true,
        passThrough: false,
        alwaysOnTop: true,
        scale: 100,
        opacity: 100,
        radius: 0,
        hideOnHover: false,
        hideOnHoverDelay: 0,
        keepInScreen: true,
      },

      shortcut: {
        visibleCat: '',
        visiblePreference: '',
        mirrorMode: '',
        penetrable: '',
        alwaysOnTop: '',
      },

      setModel: (partial) => set((s) => ({ model: { ...s.model, ...partial } })),
      setWindow: (partial) => set((s) => ({ window: { ...s.window, ...partial } })),
      setShortcut: (key, value) =>
        set((s) => ({ shortcut: { ...s.shortcut, [key]: value } })),
    }),
    { name: 'settings-store' },
  ),
)

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    newModule.settingsStore.setState(settingsStore.getState())
  })
}
