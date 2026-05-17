export interface ModelInfo {
  width: number
  height: number
}

export interface Renderer {
  init(container: HTMLElement): void
  destroy(): void
  loadModel(path: string): Promise<ModelInfo>
  setMirror(mirror: boolean): void
  setFPS(fps: number): void
}
