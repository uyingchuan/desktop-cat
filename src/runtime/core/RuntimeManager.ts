import type { RuntimeFactory, RuntimeRecord, RuntimeStatus } from './Runtime'

export class RuntimeManager {
  private records = new Map<string, RuntimeRecord>()
  private _started = false

  register(factory: RuntimeFactory, ctx: Parameters<RuntimeFactory>[0]): void {
    const runtime = factory(ctx)

    if (this.records.has(runtime.name)) {
      throw new Error(`[RuntimeManager] duplicate runtime name: "${runtime.name}"`)
    }

    // Validate dependency references
    for (const dep of runtime.dependencies) {
      if (!this.records.has(dep)) {
        throw new Error(
          `[RuntimeManager] runtime "${runtime.name}" depends on "${dep}" which is not registered`,
        )
      }
    }

    this.records.set(runtime.name, {
      runtime,
      status: 'idle',
    })
  }

  private topologicalOrder(): string[] {
    const visited = new Set<string>()
    const sorted: string[] = []

    const visit = (name: string, path: Set<string>) => {
      if (path.has(name)) {
        throw new Error(`[RuntimeManager] circular dependency: ${[...path, name].join(' → ')}`)
      }
      if (visited.has(name)) return

      const record = this.records.get(name)
      if (!record) return

      path.add(name)
      for (const dep of record.runtime.dependencies) {
        visit(dep, path)
      }
      path.delete(name)

      visited.add(name)
      sorted.push(name)
    }

    for (const name of this.records.keys()) {
      visit(name, new Set())
    }

    return sorted
  }

  async startAll(): Promise<void> {
    if (this._started) return
    this._started = true

    const order = this.topologicalOrder()
    const snapshot = new Map(this.records)

    for (const name of order) {
      const record = snapshot.get(name)
      if (!record) continue
      if (record.status === 'running' || record.status === 'starting') continue

      record.status = 'starting'
      try {
        await record.runtime.start()
      } catch (err) {
        record.status = 'error'
        record.error = err instanceof Error ? err : new Error(String(err))
        continue
      }

      // Re-read from live records: dispose() may have cleared them during await
      const live = this.records.get(name)
      if (live) {
        live.status = 'running'
      }
    }
  }

  async stopAll(): Promise<void> {
    const order = this.topologicalOrder().reverse()
    const snapshot = new Map(this.records)

    for (const name of order) {
      const record = snapshot.get(name)
      if (!record) continue
      if (record.status !== 'running') continue

      record.status = 'stopping'
      try {
        await record.runtime.stop()
      } catch (err) {
        record.status = 'error'
        record.error = err instanceof Error ? err : new Error(String(err))
        continue
      }

      const live = this.records.get(name)
      if (live) {
        live.status = 'stopped'
      }
    }
  }

  getStatus(name: string): RuntimeStatus | undefined {
    return this.records.get(name)?.status
  }

  async dispose(): Promise<void> {
    // Reset state synchronously so new startAll() calls are not blocked
    this._started = false
    const order = this.topologicalOrder().reverse()
    const snapshot = new Map(this.records)
    this.records.clear()

    for (const name of order) {
      const record = snapshot.get(name)
      if (!record || record.status !== 'running') continue
      try {
        await record.runtime.stop()
      } catch {
        // Best-effort stop; ignore errors
      }
    }
  }
}
