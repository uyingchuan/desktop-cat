import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors } from '@tauri-apps/api/window'

import type { Runtime, RuntimeContext } from '../core/Runtime'
import type { AppStore } from '../../stores/appStore'
import type { SettingsStore } from '../../stores/settingsStore'
import { getCursorMonitor } from '../../utils/monitor'

const appWindow = getCurrentWebviewWindow()
const { label } = appWindow

async function clampToMonitor(settings: SettingsStore, app: AppStore) {
  if (label !== 'main' || !settings.window.keepInScreen) return

  const monitor = await getCursorMonitor()
  if (!monitor) return

  const { position: monitorPos, size: monitorSize } = monitor
  const windowSize = await appWindow.outerSize()
  const windowPos = await appWindow.outerPosition()

  const clampedX = Math.max(monitorPos.x, Math.min(windowPos.x, monitorPos.x + monitorSize.width - windowSize.width))
  const clampedY = Math.max(monitorPos.y, Math.min(windowPos.y, monitorPos.y + monitorSize.height - windowSize.height))

  if (clampedX !== windowPos.x || clampedY !== windowPos.y) {
    await appWindow.setPosition(new PhysicalPosition(clampedX, clampedY))
  }
}

export function createWindowRuntime(ctx: RuntimeContext<AppStore, SettingsStore>): Runtime {
  const logger = ctx.logger.runtime('window')

  return {
    name: 'window',
    dependencies: [],

    async start() {
      const stack = ctx.disposables
      const settings = ctx.stores.settings

      // Persist window position/size
      const onChange = async (payload: PhysicalPosition | PhysicalSize) => {
        const minimized = await appWindow.isMinimized()
        if (minimized) return

        ctx.stores.app.setState((s) => ({
          windowState: { ...s.windowState, [label]: { ...s.windowState[label], ...payload } },
        }))

        setTimeout(() => clampToMonitor(settings.getState(), ctx.stores.app.getState()), 500)
      }

      appWindow.onMoved(({ payload }) => onChange(payload)).then((fn) => stack.add(fn))
      appWindow.onResized(({ payload }) => onChange(payload)).then((fn) => stack.add(fn))

      // Restore position/size
      const state = ctx.stores.app.getState().windowState[label]
      if (state) {
        const { x, y, width, height } = state
        if (x != null && y != null) {
          const monitors = await availableMonitors()
          const monitor = monitors.find((m) => {
            const { position, size } = m
            return x >= position.x && x <= position.x + size.width && y >= position.y && y <= position.y + size.height
          })
          if (monitor) await appWindow.setPosition(new PhysicalPosition(x, y))
        }
        if (width && height) await appWindow.setSize(new PhysicalSize(width, height))
      }

      // Reactive window controls
      const unsub = settings.subscribe(async (state, prev) => {
        if (state.window.alwaysOnTop !== prev.window.alwaysOnTop) {
          await appWindow.setAlwaysOnTop(state.window.alwaysOnTop)
        }
        if (state.window.passThrough !== prev.window.passThrough) {
          await appWindow.setIgnoreCursorEvents(state.window.passThrough)
        }
        if (state.window.opacity !== prev.window.opacity) {
          document.body.style.opacity = String(state.window.opacity / 100)
        }
        if (state.window.visible !== prev.window.visible) {
          if (state.window.visible) {
            await appWindow.show()
          } else {
            await appWindow.hide()
          }
        }
        if (state.window.scale !== prev.window.scale) {
          const scl = state.window.scale / 100
          await appWindow.setSize(new PhysicalSize(Math.round(300 * scl), Math.round(300 * scl)))
        }
      })
      stack.add(unsub)

      // Initial sync
      const s = settings.getState()
      if (s.window.visible) await appWindow.show()
      await appWindow.setAlwaysOnTop(s.window.alwaysOnTop)
      await appWindow.setIgnoreCursorEvents(s.window.passThrough)
      document.body.style.opacity = String(s.window.opacity / 100)

      logger.info('start', 'window controls active')
    },

    async stop() {
      logger.info('stop', 'window stopping')
    },
  }
}
