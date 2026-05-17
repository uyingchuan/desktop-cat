import { useDrag } from '../hooks/useDrag'
import { runtimeStore } from '../stores/runtimeStore'
import { settingsStore } from '../stores/settingsStore'
import { modelStore } from '../stores/modelStore'
import { KeyboardOverlay } from './KeyboardOverlay'
import { GamepadOverlay } from './GamepadOverlay'

import bg4K from '../assets/mania/4K/bg.png'
import leftUp from '../assets/mania/leftup.png'
import left0 from '../assets/mania/left0.png'
import left1 from '../assets/mania/left1.png'
import rightUp from '../assets/mania/rightup.png'
import right0 from '../assets/mania/right0.png'
import right2 from '../assets/mania/right2.png'
import k1 from '../assets/mania/4K/0.png'
import k2 from '../assets/mania/4K/1.png'
import k3 from '../assets/mania/4K/2.png'
import k4 from '../assets/mania/4K/3.png'

const leftHandSprites: Record<number, string> = { 0: leftUp, 1: left0, 2: left1 }
const rightHandSprites: Record<number, string> = { 0: rightUp, 3: right0, 4: right2 }
const keySprites: Record<number, string> = { 1: k1, 2: k2, 3: k3, 4: k4 }

const spriteClass = 'absolute size-full object-contain pointer-events-none select-none z-[2]'

function Cat() {
  const activeZone = runtimeStore((s) => s.activeZone)
  const opacity = settingsStore((s) => s.window.opacity)
  const radius = settingsStore((s) => s.window.radius)
  const mode = modelStore((s) => s.currentModel?.mode) ?? 'keyboard'
  const { handleMouseDown, handleDragStart } = useDrag()

  return (
    <div
      className="relative size-full flex items-center justify-center cursor-grab select-none active:cursor-grabbing overflow-hidden"
      style={{ opacity: opacity / 100, borderRadius: `${radius}%` }}
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
    >
      {(mode === 'standard' || mode === 'keyboard') && (
        <>
          <img src={leftHandSprites[activeZone] ?? leftHandSprites[0]} alt="左手" className={spriteClass} draggable={false} />
          <img src={rightHandSprites[activeZone] ?? rightHandSprites[0]} alt="右手" className={spriteClass} draggable={false} />
        </>
      )}

      {mode === 'keyboard' && <KeyboardOverlay />}

      {mode === 'keyboard' && activeZone !== 0 && (
        <img src={keySprites[activeZone]} alt="按键效果" className={spriteClass} draggable={false} />
      )}

      {mode === 'gamepad' && <GamepadOverlay />}

      {mode === 'standard' && (
        <img src={bg4K} alt="背景" className={spriteClass} style={{ zIndex: -1 }} draggable={false} />
      )}
    </div>
  )
}

export default Cat
