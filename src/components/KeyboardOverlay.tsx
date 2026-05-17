import { modelStore } from '../stores/modelStore'

import bg4K from '../assets/mania/4K/bg.png'
import k1 from '../assets/mania/4K/0.png'
import k2 from '../assets/mania/4K/1.png'
import k3 from '../assets/mania/4K/2.png'
import k4 from '../assets/mania/4K/3.png'

const keyImageMap: Record<string, string> = {
  'Z': k1, 'A': k1, 'Q': k1, '1': k1,
  'X': k2, 'S': k2, 'W': k2, '2': k2,
  'C': k1, 'D': k2, 'E': k2, '3': k2,
  'V': k3, 'F': k3, 'R': k3, '4': k3,
  'B': k3, 'G': k3, 'T': k3, '5': k3,
  'N': k4, 'H': k4, 'Y': k4, '6': k4,
  'M': k4, 'J': k4, 'U': k4, '7': k4,
  'K': k4, 'I': k4, '8': k4,
  'L': k4, 'O': k4, '9': k4,
}

const overlayClass = 'absolute size-full object-contain pointer-events-none'

export function KeyboardOverlay() {
  const pressedKeys = modelStore((s) => s.pressedKeys)
  const pressedKeyNames = Object.keys(pressedKeys).filter(
    (k) => !k.startsWith('_mouse') && !k.startsWith('_mouse_'),
  )

  return (
    <>
      <img src={bg4K} alt="键盘" className={overlayClass} draggable={false} />
      {pressedKeyNames.map((key) => {
        const imgSrc = keyImageMap[key] || k4
        return (
          <img key={key} src={imgSrc} alt={key} className={overlayClass} draggable={false} />
        )
      })}
    </>
  )
}
