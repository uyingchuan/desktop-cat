import { create } from 'zustand'
import type { PetState } from '../types/pet'
import type { SpriteKey } from '../engine/animationMapper'
import type { ZoneNumber } from '../engine/keyZoneDetector'

// -- Types --

export interface RuntimeStore {
  // FSM state (from usePetStore)
  currentState: PetState
  currentSprite: SpriteKey
  activeZone: ZoneNumber

  // Mouse
  mousePos: { x: number; y: number }

  // Runtime status
  isListening: boolean
  isGamepadActive: boolean
  modelReady: boolean

  // Actions
  setPetState: (state: PetState, sprite: SpriteKey) => void
  setActiveZone: (zone: ZoneNumber) => void
  setMousePos: (pos: { x: number; y: number }) => void
  setListening: (v: boolean) => void
  setGamepadActive: (v: boolean) => void
  setModelReady: (v: boolean) => void
}

// -- Store --

export const runtimeStore = create<RuntimeStore>((set) => ({
  currentState: 'idle',
  currentSprite: 'idle',
  activeZone: 0,

  mousePos: { x: 0, y: 0 },

  isListening: false,
  isGamepadActive: false,
  modelReady: false,

  setPetState: (currentState, currentSprite) => set({ currentState, currentSprite }),
  setActiveZone: (activeZone) => set({ activeZone }),
  setMousePos: (mousePos) => set({ mousePos }),
  setListening: (isListening) => set({ isListening }),
  setGamepadActive: (isGamepadActive) => set({ isGamepadActive }),
  setModelReady: (modelReady) => set({ modelReady }),
}))

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    newModule.runtimeStore.setState(runtimeStore.getState())
  })
}
