type DisposableFn = (() => void) | (() => Promise<void>)

export class DisposableStack {
  private disposables: Array<DisposableFn> = []
  private disposed = false

  add(fn: DisposableFn): void {
    if (this.disposed) {
      // Execute immediately if already disposed; ignore promise
      void Promise.resolve(fn()).catch((err) => {
        console.error('[DisposableStack] error during immediate dispose:', err)
      })
      return
    }
    this.disposables.push(fn)
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true

    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        await this.disposables[i]()
      } catch (err) {
        console.error('[DisposableStack] error during dispose:', err)
      }
    }
    this.disposables.length = 0
  }

  get size(): number {
    return this.disposables.length
  }
}
