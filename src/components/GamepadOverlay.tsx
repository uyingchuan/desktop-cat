import { modelStore } from '../stores/modelStore'

export function GamepadOverlay() {
  const pressedKeys = modelStore((s) => s.pressedKeys)
  const pressedNames = Object.keys(pressedKeys).filter(
    (k) => !k.startsWith('_mouse') && !k.startsWith('_mouse_'),
  )

  if (pressedNames.length === 0) return null

  return (
    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 px-2 py-1 bg-black/50 rounded-lg text-white text-[10px] font-mono pointer-events-none">
      {pressedNames.map((name) => (
        <span key={name} className="bg-white/20 px-1.5 py-0.5 rounded">
          {name}
        </span>
      ))}
    </div>
  )
}
