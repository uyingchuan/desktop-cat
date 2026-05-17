import { getName, getVersion } from '@tauri-apps/api/app'
import { Menu, MenuItem, PredefinedMenuItem, Submenu, CheckMenuItem } from '@tauri-apps/api/menu'
import { resolveResource } from '@tauri-apps/api/path'
import { TrayIcon } from '@tauri-apps/api/tray'
import { exit, relaunch } from '@tauri-apps/plugin-process'
import { openUrl } from '@tauri-apps/plugin-opener'

import type { Runtime, RuntimeContext } from '../core/Runtime'
import type { StoreApi } from '../core/Runtime'
import type { AppStore } from '../../stores/appStore'
import type { SettingsStore } from '../../stores/settingsStore'

const TRAY_ID = 'DESKTOP_CAT_TRAY'
const GITHUB_LINK = 'https://github.com/nicko1999/desktop-cat'

async function buildTrayMenu(settingsApi: StoreApi<SettingsStore>, appApi: StoreApi<AppStore>) {
  const settings = settingsApi.getState()
  const { visible, scale, opacity, passThrough } = settings.window

  const scaleOptions = [50, 75, 100, 125, 150]
  const opacityOptions = [25, 50, 75, 100]

  const scaleItems = await Promise.all(
    scaleOptions.map((s) =>
      CheckMenuItem.new({
        text: `${s}%`,
        checked: scale === s,
        action: () => settingsApi.setState((st) => ({ window: { ...st.window, scale: s } })),
      }),
    ),
  )

  const opacityItems = await Promise.all(
    opacityOptions.map((o) =>
      CheckMenuItem.new({
        text: `${o}%`,
        checked: opacity === o,
        action: () => settingsApi.setState((st) => ({ window: { ...st.window, opacity: o } })),
      }),
    ),
  )

  const version = appApi.getState().version || '0.1.0'

  const items = await Promise.all([
    MenuItem.new({
      text: '偏好设置',
      action: () => { /* future: open preference window */ },
    }),
    MenuItem.new({
      text: visible ? '隐藏猫咪' : '显示猫咪',
      action: () => settingsApi.setState((st) => ({ window: { ...st.window, visible: !st.window.visible } })),
    }),
    PredefinedMenuItem.new({ item: 'Separator' }),
    CheckMenuItem.new({
      text: '穿透点击',
      checked: passThrough,
      action: () => settingsApi.setState((st) => ({ window: { ...st.window, passThrough: !st.window.passThrough } })),
    }),
    Submenu.new({ text: '窗口大小', items: scaleItems }),
    Submenu.new({ text: '不透明度', items: opacityItems }),
    PredefinedMenuItem.new({ item: 'Separator' }),
    MenuItem.new({ text: 'GitHub', action: () => openUrl(GITHUB_LINK) }),
    MenuItem.new({ text: `v${version}`, enabled: false }),
    PredefinedMenuItem.new({ item: 'Separator' }),
    MenuItem.new({ text: '重启应用', action: relaunch }),
    MenuItem.new({ text: '退出应用', action: () => exit(0) }),
  ])

  return Menu.new({ items })
}

export function createAppRuntime(ctx: RuntimeContext<AppStore, SettingsStore>): Runtime {
  const logger = ctx.logger.runtime('app')

  return {
    name: 'app',
    dependencies: [],

    async start() {
      const stack = ctx.disposables
      const settingsApi = ctx.stores.settings

      const [name, version] = await Promise.all([getName(), getVersion()])
      ctx.stores.app.setState({ name, version })
      logger.info('start', `${name} v${version}`)

      // Close any stale tray left over from a previous lifecycle (e.g. HMR reload)
      const existing = await TrayIcon.getById(TRAY_ID)
      if (existing) {
        await existing.close()
      }

      const icon = await resolveResource('assets/tray.png')
      const appName = await getName()
      const appVersion = await getVersion()
      const menu = await buildTrayMenu(settingsApi, ctx.stores.app)

      const tray = await TrayIcon.new({
        menu,
        icon,
        id: TRAY_ID,
        tooltip: `${appName} v${appVersion}`,
        iconAsTemplate: true,
        menuOnLeftClick: true,
      })

      stack.add(() => tray.close())

      const unsub = settingsApi.subscribe(async (state, prev) => {
        if (
          state.window.visible !== prev.window.visible
          || state.window.passThrough !== prev.window.passThrough
          || state.window.scale !== prev.window.scale
          || state.window.opacity !== prev.window.opacity
        ) {
          const tray = await TrayIcon.getById(TRAY_ID)
          if (tray) {
            const menu = await buildTrayMenu(settingsApi, ctx.stores.app)
            await tray.setMenu(menu)
          }
        }
      })
      stack.add(unsub)

      ctx.bus.emit('app:ready', undefined)
    },

    async stop() {
      logger.info('stop', 'app stopping')
      ctx.bus.emit('app:shutdown', undefined)
    },
  }
}
