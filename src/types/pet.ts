export type PetState = 'idle' | 'left_paw' | 'right_paw' | 'wave'

export interface PetEvent {
  type: 'KEY_DOWN' | 'KEY_UP' | 'ALL_KEYS_UP'
  key?: string
}

export type StateChangeListener = (
  prev: PetState,
  next: PetState,
  event: PetEvent,
) => void

export interface MotionInfo {
  name: string
  file: string
  sound?: string
  fadeIn: number
  fadeOut: number
}

export interface ExpressionInfo {
  name: string
  file: string
}
