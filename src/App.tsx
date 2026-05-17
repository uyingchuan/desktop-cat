import { useEffect, useRef } from 'react'
import Cat from './components/Cat'
import { EventBus } from './runtime/core/EventBus'
import { Scheduler } from './runtime/core/Scheduler'
import { DisposableStack } from './runtime/core/DisposableStack'
import { ConsoleLogger } from './runtime/core/Logger'
import { RuntimeManager } from './runtime/core/RuntimeManager'
import type { RuntimeContext } from './runtime/core/Runtime'
import { appStore } from './stores/appStore'
import { settingsStore } from './stores/settingsStore'
import { modelStore } from './stores/modelStore'
import { runtimeStore } from './stores/runtimeStore'
import { createAppRuntime } from './runtime/systems/createAppRuntime'
import { createWindowRuntime } from './runtime/systems/createWindowRuntime'
import { createInputRuntime } from './runtime/systems/createInputRuntime'
import { createGamepadRuntime } from './runtime/systems/createGamepadRuntime'
import { createAnimationRuntime } from './runtime/systems/createAnimationRuntime'
import { createRendererRuntime } from './runtime/systems/createRendererRuntime'

function App() {
  const startedRef = useRef(false)
  const pendingCleanupRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const bus = new EventBus()
    const scheduler = new Scheduler()
    const disposables = new DisposableStack()
    const logger = new ConsoleLogger()

    const ctx: RuntimeContext = {
      bus,
      scheduler,
      disposables,
      stores: {
        app: appStore,
        settings: settingsStore,
        model: modelStore,
        runtime: runtimeStore,
      },
      logger,
    }

    const manager = new RuntimeManager()

    // Init app metadata
    appStore.getState().setMetadata('Desktop Cat', '0.1.0')

    manager.register(createAppRuntime, ctx)
    manager.register(createWindowRuntime, ctx)
    manager.register(createInputRuntime, ctx)
    manager.register(createGamepadRuntime, ctx)
    manager.register(createAnimationRuntime, ctx)
    manager.register(createRendererRuntime, ctx)

    scheduler.start()

    const init = async () => {
      // Wait for previous lifecycle cleanup to finish before starting new one
      if (pendingCleanupRef.current) {
        await pendingCleanupRef.current
        pendingCleanupRef.current = null
      }
      try {
        await modelStore.getState().init()
      } catch (err) {
        console.error('[App] modelStore.init() failed:', err)
      }
      await manager.startAll()
    }

    init()

    return () => {
      pendingCleanupRef.current = (async () => {
        await manager.dispose()
        await disposables.dispose()
      })()
      scheduler.stop()
      bus.removeAll()
      startedRef.current = false
    }
  }, [])

  return <Cat />
}

export default App
