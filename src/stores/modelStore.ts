import { create } from 'zustand'
import { resolveResource } from '@tauri-apps/api/path'

// -- Types --

export type ModelMode = 'standard' | 'keyboard' | 'gamepad'

export interface Model {
  id: string
  path: string
  mode: ModelMode
  isPreset: boolean
}

export interface SupportKeyInfo {
  name: string
  image: string
  hand: 'left' | 'right'
}

export interface ModelStore {
  modelReady: boolean
  models: Model[]
  currentModel: Model | null
  supportKeys: SupportKeyInfo[]
  pressedKeys: Record<string, string>

  init: () => Promise<void>
  setCurrentModel: (model: Model) => void
  addModel: (model: Model) => void
  removeModel: (id: string) => void
  setPressedKeys: (keys: Record<string, string>) => void
  clearPressedKeys: () => void
}

let idCounter = 0
function nextId(): string {
  return `model-${++idCounter}-${Date.now()}`
}

// -- Store --

export const modelStore = create<ModelStore>((set, get) => ({
  modelReady: false,
  models: [],
  currentModel: null,
  supportKeys: [],
  pressedKeys: {},

  init: async () => {
    try {
      const modelsPath = await resolveResource('assets/models')
      const customModels = get().models.filter((m) => !m.isPreset)

      const modes: ModelMode[] = ['gamepad', 'keyboard', 'standard']
      const presets: Model[] = []

      for (const mode of modes) {
        const existing = get().models.find((m) => m.isPreset && m.mode === mode)
        presets.push({
          id: existing?.id ?? nextId(),
          mode,
          isPreset: true,
          path: `${modelsPath}/${mode}`,
        })
      }

      const allModels = [...presets, ...customModels]
      const currentId = get().currentModel?.id
      const current = allModels.find((m) => m.id === currentId) ?? allModels[0] ?? null

      set({ models: allModels, currentModel: current, modelReady: true })
    } catch (err) {
      console.error('[modelStore] init failed:', err)
      set({ modelReady: true })
    }
  },

  setCurrentModel: (model) => set({ currentModel: model }),

  addModel: (model) => set((s) => ({ models: [...s.models, model] })),

  removeModel: (id) =>
    set((s) => {
      if (s.models.find((m) => m.id === id)?.isPreset) return s
      return { models: s.models.filter((m) => m.id !== id) }
    }),

  setPressedKeys: (keys) => set({ pressedKeys: keys }),

  clearPressedKeys: () => set({ pressedKeys: {} }),
}))

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    newModule.modelStore.setState(modelStore.getState())
  })
}
