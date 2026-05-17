import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { Runtime, RuntimeContext } from '../core/Runtime'
import type { AppStore } from '../../stores/appStore'
import type { SettingsStore } from '../../stores/settingsStore'
import type { ModelStore } from '../../stores/modelStore'
import type { RuntimeStore } from '../../stores/runtimeStore'
import type { DeviceEvent } from '../../types/input'
import { isWindows } from '../../utils/platform'
import { PetEngine } from '../../engine/petEngine'

export function createInputRuntime(
  ctx: RuntimeContext<AppStore, SettingsStore, ModelStore, RuntimeStore>,
): Runtime {
  const logger = ctx.logger.runtime('input')
  let engine: PetEngine | null = null
  let releaseTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // Accumulate keys + mouse for Engine (Engine expects InputSnapshot)
  let heldKeys: string[] = []
  let mousePos = { x: 0, y: 0 }

  return {
    name: 'input',
    dependencies: ['app'],

    async start() {
      const stack = ctx.disposables
      const settings = ctx.stores.settings

      engine = new PetEngine()
      engine.start()

      const rdevKeyMap: Record<string, string> = {
        // Modifiers: rdev Left/Right suffix → L/R prefix used by zone detector
        ShiftLeft: 'LShift', ShiftRight: 'RShift',
        ControlLeft: 'LCtrl', ControlRight: 'RCtrl',
        AltLeft: 'LAlt', AltRight: 'RAlt',
        MetaLeft: 'LWin', MetaRight: 'RWin',
        // rdev naming → canonical spelling
        Return: 'Enter',
        BackSlash: 'Backslash',
        SemiColon: 'Semicolon',
        BackQuote: 'Backquote',
        // Arrow keys
        LeftArrow: 'Left', RightArrow: 'Right',
        UpArrow: 'Up', DownArrow: 'Down',
        // Capital → CapsLock (rdev uses CapsLock variant now but Capital exists too)
        Capital: 'CapsLock',
      }

      const getSupportedKey = (key: string): string => {
        let nextKey = key

        // Pattern-based: strip Key prefix from letters (KeyA→A, KeyZ→Z)
        if (key.startsWith('Key') && key.length === 4) {
          nextKey = key[3]
        }
        // Pattern-based: strip Num prefix from digits (Num1→1, Num0→0)
        else if (key.startsWith('Num') && key.length === 4) {
          nextKey = key[3]
        }
        // Explicit rdev → canonical mapping
        else if (rdevKeyMap[key] != null) {
          nextKey = rdevKeyMap[key]
        }

        // Fallback: collapse F1-F12 → Fn when not in supportKeys
        const supportKeys = ctx.stores.model.getState().supportKeys
        if (!supportKeys.some((k) => k.name === nextKey)) {
          if (nextKey.startsWith('F') && nextKey.length <= 4) {
            nextKey = nextKey.replace(/^F\d+$/, 'Fn')
          }
        }
        return nextKey
      }

      const handleAutoRelease = (key: string, delay = 100) => {
        heldKeys.push(key)
        ctx.bus.emit('input:keypress', { key })
        ctx.stores.model.setState((s) => ({ pressedKeys: { ...s.pressedKeys, [key]: key } }))
        if (releaseTimers.has(key)) clearTimeout(releaseTimers.get(key))
        const timer = setTimeout(() => {
          heldKeys = heldKeys.filter((k) => k !== key)
          ctx.bus.emit('input:keyrelease', { key })
          const { [key]: _, ...rest } = ctx.stores.model.getState().pressedKeys
          ctx.stores.model.setState({ pressedKeys: rest })
          releaseTimers.delete(key)
          feedEngine()
        }, delay)
        releaseTimers.set(key, timer)
        feedEngine()
      }

      const feedEngine = () => {
        engine?.process({ keys: heldKeys, mouse: mousePos })
      }

      const unlisten = await listen<DeviceEvent>('device-changed', ({ payload }) => {
        const { kind, value } = payload

        if (kind === 'KeyboardPress' || kind === 'KeyboardRelease') {
          const nextKey = getSupportedKey(value as string)
          if (!nextKey) return

          if (nextKey === 'CapsLock') return handleAutoRelease(nextKey)

          if (kind === 'KeyboardPress') {
            if (isWindows) {
              const delay = settings.getState().model.autoReleaseDelay * 1000
              return handleAutoRelease(nextKey, delay)
            }
            ctx.bus.emit('input:keypress', { key: nextKey })
            if (!heldKeys.includes(nextKey)) heldKeys.push(nextKey)
            ctx.stores.model.setState((s) => ({ pressedKeys: { ...s.pressedKeys, [nextKey]: nextKey } }))
          } else {
            ctx.bus.emit('input:keyrelease', { key: nextKey })
            heldKeys = heldKeys.filter((k) => k !== nextKey)
            const { [nextKey]: _, ...rest } = ctx.stores.model.getState().pressedKeys
            ctx.stores.model.setState({ pressedKeys: rest })
          }
          feedEngine()
          return
        }

        if (kind === 'MouseMove') {
          const pos = value as { x: number; y: number }
          mousePos = pos
          ctx.bus.emit('input:mousemove', pos)
          feedEngine()
          return
        }

        if (kind === 'MousePress') {
          ctx.bus.emit('input:mousepress', { button: value as string })
          return
        }
        if (kind === 'MouseRelease') {
          ctx.bus.emit('input:mouserelease', { button: value as string })
          return
        }
      })
      stack.add(() => unlisten())

      invoke('start_device_listening')
      ctx.stores.runtime.setState({ isListening: true })

      logger.info('start', 'device listening active')
    },

    async stop() {
      releaseTimers.forEach((t) => clearTimeout(t))
      releaseTimers.clear()
      heldKeys = []
      engine?.stop()
      engine = null
      ctx.stores.runtime.setState({ isListening: false })
      logger.info('stop', 'input stopped')
    },
  }
}
