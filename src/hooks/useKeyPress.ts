import { useEffect, useRef } from 'react'
import {
  isRegistered,
  register,
  unregister,
} from '@tauri-apps/plugin-global-shortcut'
import type { ShortcutHandler } from '@tauri-apps/plugin-global-shortcut'

export function useKeyPress(shortcut: string | undefined, callback: ShortcutHandler) {
  const oldShortcutRef = useRef<string | undefined>(shortcut)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const oldShortcut = oldShortcutRef.current
    let registered = false

    async function unbind() {
      if (!oldShortcut) return
      const isReg = await isRegistered(oldShortcut)
      if (isReg) await unregister(oldShortcut)
    }

    async function bind() {
      await unbind()

      if (!shortcut) {
        oldShortcutRef.current = shortcut
        return
      }

      await register(shortcut, (event) => {
        if (event.state === 'Released') return
        callbackRef.current(event)
      })
      registered = true
      oldShortcutRef.current = shortcut
    }

    bind()

    return () => {
      if (registered && shortcut) {
        unregister(shortcut).catch(() => {})
      }
    }
  }, [shortcut])
}
