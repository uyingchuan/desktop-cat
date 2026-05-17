import { type Monitor, type PhysicalPosition, cursorPosition, monitorFromPoint } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

function createCursorMonitor() {
  let cachedMonitor: Monitor | null = null

  return async (cursorPoint?: PhysicalPosition): Promise<Monitor | null> => {
    cursorPoint ??= await cursorPosition()
    if (!cursorPoint) return null

    if (cachedMonitor) {
      const { size, position } = cachedMonitor
      const inBounds = cursorPoint.x >= position.x
        && cursorPoint.x < position.x + size.width
        && cursorPoint.y >= position.y
        && cursorPoint.y < position.y + size.height
      if (inBounds) return cachedMonitor
    }

    const appWindow = getCurrentWebviewWindow()
    const scaleFactor = await appWindow.scaleFactor()
    const { x, y } = cursorPoint.toLogical(scaleFactor)
    cachedMonitor = await monitorFromPoint(x, y) ?? null
    return cachedMonitor
  }
}

export const getCursorMonitor = createCursorMonitor()
