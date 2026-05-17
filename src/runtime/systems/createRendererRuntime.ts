import type { Runtime, RuntimeContext } from '../core/Runtime'
import type { RuntimeStore } from '../../stores/runtimeStore'
import { SpriteRenderer } from '../../engine/renderer/SpriteRenderer'

export function createRendererRuntime(ctx: RuntimeContext<unknown, unknown, unknown, RuntimeStore>): Runtime {
  const logger = ctx.logger.runtime('renderer')
  let renderer: SpriteRenderer | null = null

  return {
    name: 'renderer',
    dependencies: ['animation'],

    async start() {
      const stack = ctx.disposables

      // Only in browser context
      const container = document.getElementById('root')
      if (!container) {
        logger.warn('start', 'no #root container found')
        return
      }

      renderer = new SpriteRenderer()
      renderer.init(container)

      ctx.scheduler.addTask({
        id: 'renderer:sync',
        priority: 100,
        group: 'render',
        update(_dt) {
          const state = ctx.stores.runtime.getState()
          renderer?.setMirror(false)
          // Future: sync model parameters, sprite state etc.
        },
      })

      stack.add(() => {
        renderer?.destroy()
        renderer = null
        ctx.scheduler.removeTask('renderer:sync')
      })

      logger.info('start', 'renderer active')
    },

    async stop() {
      renderer?.destroy()
      renderer = null
      logger.info('stop', 'renderer stopped')
    },
  }
}
