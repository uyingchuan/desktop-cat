import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { Runtime, RuntimeContext } from '../core/Runtime'
import type { GamepadEvent } from '../../types/input'

export function createGamepadRuntime(ctx: RuntimeContext): Runtime {
  const logger = ctx.logger.runtime('gamepad')

  return {
    name: 'gamepad',
    dependencies: ['app'],

    async start() {
      const stack = ctx.disposables
      const model = ctx.stores.model

      const unlisten = await listen<GamepadEvent>('gamepad-changed', ({ payload }) => {
        const { name, value } = payload

        switch (name) {
          case 'LeftStickX':
          case 'LeftStickY':
          case 'RightStickX':
          case 'RightStickY':
            ctx.bus.emit('gamepad:axis', { name, value })
            break
          default:
            ctx.bus.emit('gamepad:button', { name, value })
            if (value > 0) {
              model.setState((s) => ({ pressedKeys: { ...s.pressedKeys, [name]: name } }))
            } else {
              model.setState((s) => {
                const { [name]: _, ...rest } = s.pressedKeys
                return { pressedKeys: rest }
              })
            }
            break
        }
      })
      stack.add(() => unlisten())

      invoke('start_gamepad_listing')
      ctx.stores.runtime.setState({ isGamepadActive: true })
      logger.info('start', 'gamepad listening active')
    },

    async stop() {
      invoke('stop_gamepad_listing')
      ctx.stores.runtime.setState({ isGamepadActive: false })
      logger.info('stop', 'gamepad stopped')
    },
  }
}
