import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

import type { Runtime, RuntimeContext } from '../core/Runtime'
import type { AppStore } from '../../stores/appStore'
import type { SettingsStore } from '../../stores/settingsStore'
import { inBetween } from '../../utils/is'
import { isMac } from '../../utils/platform'

const DAMPING_DECAY = 0.75
const appWindow = getCurrentWebviewWindow()

interface CursorPoint {
  x: number
  y: number
}

export function createAnimationRuntime(ctx: RuntimeContext<AppStore, SettingsStore>): Runtime {
  const logger = ctx.logger.runtime('animation')
  let latestCursor: CursorPoint | null = null
  let smoothed: CursorPoint | null = null
  let scaleFactor = 1
  let hideState = { timer: undefined as ReturnType<typeof setTimeout> | undefined, wasInWindow: false }

  return {
    name: 'animation',
    dependencies: ['input'],

    async start() {
      const stack = ctx.disposables
      const settings = ctx.stores.settings

      // Scale factor (macOS only)
      if (isMac) {
        scaleFactor = await appWindow.scaleFactor()
        const offScale = await appWindow.onScaleChanged(({ payload }) => {
          scaleFactor = payload.scaleFactor
        })
        stack.add(() => { offScale() })
      }

      // Subscribe to mouse move events
      const offMouseMove = ctx.bus.on('input:mousemove', (pos) => {
        latestCursor = pos
      })
      stack.add(offMouseMove)

      // Cursor damping + hide-on-hover task
      ctx.scheduler.addTask({
        id: 'animation:cursor-damping',
        priority: 50,
        group: 'cursor',
        update(dt) {
          if (settings.getState().model.ignoreMouse) return
          if (!latestCursor) return

          // Damping
          const dest = latestCursor
          const cur = smoothed ?? dest
          const alpha = 1 - DAMPING_DECAY ** (dt / (1000 / 60))
          smoothed = {
            x: cur.x + (dest.x - cur.x) * alpha,
            y: cur.y + (dest.y - cur.y) * alpha,
          }

          if (Math.hypot(dest.x - smoothed.x, dest.y - smoothed.y) < 0.5) {
            smoothed = { ...dest }
            latestCursor = null
          }

          // Store smoothed position
          ctx.stores.runtime.setState({ mousePos: smoothed })

          // Hide-on-hover
          const s = settings.getState().window
          if (!s.hideOnHover) return

          const winState = ctx.stores.app.getState().windowState['main']
          if (!winState) return

          const { x: winX = 0, y: winY = 0, width = 300, height = 300 } = winState
          const sx = smoothed.x * scaleFactor
          const sy = smoothed.y * scaleFactor
          const isIn = inBetween(sx, winX, winX + width) && inBetween(sy, winY, winY + height)

          if (isIn === hideState.wasInWindow) return
          if (hideState.timer) { clearTimeout(hideState.timer); hideState.timer = undefined }

          if (isIn) {
            hideState.timer = setTimeout(() => {
              document.body.style.setProperty('opacity', '0')
              appWindow.setIgnoreCursorEvents(true)
            }, s.hideOnHoverDelay * 1000)
          } else {
            document.body.style.setProperty('opacity', 'unset')
            appWindow.setIgnoreCursorEvents(s.passThrough)
          }

          hideState.wasInWindow = isIn
        },
      })

      stack.add(() => {
        ctx.scheduler.removeTask('animation:cursor-damping')
        if (hideState.timer) clearTimeout(hideState.timer)
      })

      logger.info('start', 'animation loop active')
    },

    async stop() {
      latestCursor = null
      smoothed = null
      logger.info('stop', 'animation stopped')
    },
  }
}
