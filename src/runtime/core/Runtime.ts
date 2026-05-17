import type { EventBus } from './EventBus'
import type { Scheduler } from './Scheduler'
import type { Logger } from './Logger'
import type { DisposableStack } from './DisposableStack'

// -- Runtime interface (stateless — status is owned by Manager) --

export interface Runtime {
  readonly name: string
  readonly dependencies: string[]
  start(): Promise<void>
  stop(): Promise<void>
}

// -- Status (owned by RuntimeManager) --

export type RuntimeStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error' | 'stopped'

export interface RuntimeRecord {
  runtime: Runtime
  status: RuntimeStatus
  error?: Error
}

// -- StoreApi (Zustand vanilla API, not hook) --

export interface StoreApi<T> {
  getState(): T
  setState(partial: Partial<T> | ((state: T) => Partial<T>)): void
  subscribe(listener: (state: T, prevState: T) => void): () => void
}

// -- RuntimeContext (explicit DI, no hidden imports) --

export interface RuntimeContext<
  TApp = unknown,
  TSettings = unknown,
  TModel = unknown,
  TRuntime = unknown,
> {
  bus: EventBus
  scheduler: Scheduler
  disposables: DisposableStack
  stores: {
    app: StoreApi<TApp>
    settings: StoreApi<TSettings>
    model: StoreApi<TModel>
    runtime: StoreApi<TRuntime>
  }
  logger: Logger
}

// -- Factory signature --

export type RuntimeFactory = (ctx: RuntimeContext) => Runtime
