// -- Event type map (transient events only, no long-lived state) --

export type EventMap = {
  'input:keypress': { key: string }
  'input:keyrelease': { key: string }
  'input:mousemove': { x: number; y: number }
  'input:mousepress': { button: string }
  'input:mouserelease': { button: string }

  'gamepad:button': { name: string; value: number }
  'gamepad:axis': { name: string; value: number }

  'window:moved': { x: number; y: number }
  'window:resized': { width: number; height: number }

  'app:ready': void
  'app:shutdown': void
  'tray:preferences': void
}

type EventKey = keyof EventMap
type Handler<T extends EventKey> = (payload: EventMap[T]) => void

export class EventBus {
  private listeners = new Map<EventKey, Set<Handler<EventKey>>>()

  on<K extends EventKey>(event: K, handler: Handler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as Handler<EventKey>)

    return () => {
      this.listeners.get(event)?.delete(handler as Handler<EventKey>)
    }
  }

  once<K extends EventKey>(event: K, handler: Handler<K>): void {
    const off = this.on(event, (payload) => {
      off()
      handler(payload)
    })
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[EventBus] error in handler for "${event}":`, err)
      }
    }
  }

  removeAll(): void {
    this.listeners.clear()
  }
}
