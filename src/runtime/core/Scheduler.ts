export interface FrameTask {
  id: string
  priority: number
  group?: string
  paused?: boolean
  update(dt: number): void
}

export class Scheduler {
  private tasks: FrameTask[] = []
  private rafId: number | null = null
  private lastTime = 0
  private _running = false

  get isRunning(): boolean {
    return this._running
  }

  addTask(task: FrameTask): void {
    if (this.tasks.find((t) => t.id === task.id)) {
      this.removeTask(task.id)
    }
    this.tasks.push(task)
    // Sort on insert, not on tick
    this.tasks.sort((a, b) => a.priority - b.priority)
  }

  removeTask(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id)
  }

  pauseGroup(group: string): void {
    for (const task of this.tasks) {
      if (task.group === group) task.paused = true
    }
  }

  resumeGroup(group: string): void {
    for (const task of this.tasks) {
      if (task.group === group) task.paused = false
    }
  }

  start(): void {
    if (this._running) return
    this._running = true
    this.lastTime = performance.now()
    this.tick()
  }

  stop(): void {
    this._running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private tick = (): void => {
    if (!this._running) return

    const now = performance.now()
    const dt = now - this.lastTime
    this.lastTime = now

    // Snapshot to prevent issues when tasks add/remove during tick
    const snapshot = [...this.tasks]
    for (const task of snapshot) {
      if (!task.paused) {
        try {
          task.update(dt)
        } catch (err) {
          console.error(`[Scheduler] error in task "${task.id}":`, err)
        }
      }
    }

    this.rafId = requestAnimationFrame(this.tick)
  }
}
