import type { ModelMode } from '../stores/modelStore'

export interface InputSnapshot {
  keys: string[]
  mouse: { x: number; y: number }
}

export interface DeviceEvent {
  kind: 'KeyboardPress' | 'KeyboardRelease' | 'MouseMove' | 'MousePress' | 'MouseRelease'
  value: string | { x: number; y: number }
}

export interface GamepadEvent {
  kind: 'ButtonChanged' | 'AxisChanged'
  name: string
  value: number
}

export interface ModelInfo {
  id: string
  path: string
  mode: ModelMode
  isPreset: boolean
}

export interface SupportKey {
  name: string
  image: string
  hand: 'left' | 'right'
}
