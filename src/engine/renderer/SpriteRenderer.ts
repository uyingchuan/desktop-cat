import type { Renderer, ModelInfo } from './Renderer'

export class SpriteRenderer implements Renderer {
  private container: HTMLElement | null = null

  init(container: HTMLElement): void {
    this.container = container
  }

  async loadModel(_path: string): Promise<ModelInfo> {
    return { width: 300, height: 300 }
  }

  setMirror(_mirror: boolean): void {
    if (this.container) {
      this.container.style.transform = _mirror ? 'scaleX(-1)' : ''
    }
  }

  setFPS(_fps: number): void {
    // Sprite renderer uses CSS/browser rendering, no FPS control needed
  }

  destroy(): void {
    this.container = null
  }
}
