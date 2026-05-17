import { isMac } from './platform'

export interface Key {
  eventKey: string
  tauriKey?: string
  symbol?: string
}

export const modifierKeys: Key[] = [
  { eventKey: 'Shift', symbol: isMac ? '⇧' : 'Shift' },
  { eventKey: 'Control', symbol: isMac ? '⌃' : 'Ctrl' },
  { eventKey: 'Alt', symbol: isMac ? '⌥' : 'Alt' },
  { eventKey: 'Meta', symbol: isMac ? '⌘' : 'Win' },
  { eventKey: 'Fn', symbol: 'Fn' },
].map((item) => ({ ...item, tauriKey: item.eventKey }))

export const standardKeys: Key[] = [
  // Row 1
  { eventKey: 'Escape', symbol: isMac ? '⎋' : 'Esc' },
  { eventKey: 'F1' }, { eventKey: 'F2' }, { eventKey: 'F3' }, { eventKey: 'F4' },
  { eventKey: 'F5' }, { eventKey: 'F6' }, { eventKey: 'F7' }, { eventKey: 'F8' },
  { eventKey: 'F9' }, { eventKey: 'F10' }, { eventKey: 'F11' }, { eventKey: 'F12' },
  // Row 2
  { eventKey: 'Backquote', symbol: '`' },
  { eventKey: 'Digit1' }, { eventKey: 'Digit2' }, { eventKey: 'Digit3' },
  { eventKey: 'Digit4' }, { eventKey: 'Digit5' }, { eventKey: 'Digit6' },
  { eventKey: 'Digit7' }, { eventKey: 'Digit8' }, { eventKey: 'Digit9' },
  { eventKey: 'Digit0' },
  { eventKey: 'Minus', symbol: '-' },
  { eventKey: 'Equal', symbol: '=' },
  { eventKey: 'Backspace', symbol: isMac ? '⌫' : 'Bksp' },
  // Row 3
  { eventKey: 'Tab', symbol: isMac ? '⇥' : 'Tab' },
  { eventKey: 'KeyQ' }, { eventKey: 'KeyW' }, { eventKey: 'KeyE' },
  { eventKey: 'KeyR' }, { eventKey: 'KeyT' }, { eventKey: 'KeyY' },
  { eventKey: 'KeyU' }, { eventKey: 'KeyI' }, { eventKey: 'KeyO' },
  { eventKey: 'KeyP' },
  { eventKey: 'BracketLeft', symbol: '[' },
  { eventKey: 'BracketRight', symbol: ']' },
  { eventKey: 'Backslash', symbol: '\\' },
  // Row 4
  { eventKey: 'KeyA' }, { eventKey: 'KeyS' }, { eventKey: 'KeyD' },
  { eventKey: 'KeyF' }, { eventKey: 'KeyG' }, { eventKey: 'KeyH' },
  { eventKey: 'KeyJ' }, { eventKey: 'KeyK' }, { eventKey: 'KeyL' },
  { eventKey: 'Semicolon', symbol: ';' },
  { eventKey: 'Quote', symbol: "'" },
  { eventKey: 'Enter', symbol: isMac ? '↩︎' : 'Enter' },
  // Row 5
  { eventKey: 'KeyZ' }, { eventKey: 'KeyX' }, { eventKey: 'KeyC' },
  { eventKey: 'KeyV' }, { eventKey: 'KeyB' }, { eventKey: 'KeyN' },
  { eventKey: 'KeyM' },
  { eventKey: 'Comma', symbol: ',' },
  { eventKey: 'Period', symbol: '.' },
  { eventKey: 'Slash', symbol: '/' },
  // Row 6
  { eventKey: 'Space', symbol: isMac ? '␣' : 'Space' },
  // Arrows
  { eventKey: 'ArrowUp', symbol: '↑' },
  { eventKey: 'ArrowDown', symbol: '↓' },
  { eventKey: 'ArrowLeft', symbol: '←' },
  { eventKey: 'ArrowRight', symbol: '→' },
].map((item) => {
  const { eventKey } = item
  item.symbol ??= eventKey
  item.tauriKey ??= eventKey
  if (eventKey.startsWith('Digit') || eventKey.startsWith('Key')) {
    item.tauriKey = item.symbol = eventKey.slice(-1)
  }
  return item
})

export const keys = modifierKeys.concat(standardKeys)
