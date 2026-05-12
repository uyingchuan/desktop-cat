import type { PetEvent } from '../types/pet';

export type ZoneNumber = 0 | 1 | 2 | 3 | 4;

const keyZoneMap: Record<string, ZoneNumber> = {
  // Zone 1 — 键盘最左列
  Backquote: 1, '1': 1, '2': 1, Tab: 1,
  Q: 1, W: 1, CapsLock: 1,
  A: 1, S: 1, LShift: 1,
  Z: 1, X: 1, LCtrl: 1, LWin: 1, LAlt: 1,

  // Zone 2 — 中左
  '3': 2, '4': 2, E: 2, R: 2, D: 2, F: 2, C: 2, V: 2,

  // Zone 3 — 中右
  '5': 3, '6': 3, '7': 3,
  T: 3, Y: 3, U: 3,
  G: 3, H: 3, J: 3,
  B: 3, N: 3, M: 3,

  // Zone 4 — 键盘最右列及剩余
  '8': 4, '9': 4, '0': 4, Minus: 4, Equal: 4,
  I: 4, O: 4, P: 4, BracketLeft: 4, BracketRight: 4, Backslash: 4,
  K: 4, L: 4, Semicolon: 4, Quote: 4,
  Comma: 4, Period: 4, Slash: 4,
  Enter: 4, Backspace: 4,
  RShift: 4, RCtrl: 4, RAlt: 4, RWin: 4,
  Space: 4, Escape: 4,
  Left: 4, Right: 4, Up: 4, Down: 4,
  F1: 4, F2: 4, F3: 4, F4: 4, F5: 4, F6: 4,
  F7: 4, F8: 4, F9: 4, F10: 4, F11: 4, F12: 4,
};

type ZoneChangeHandler = (zone: ZoneNumber) => void;

export class KeyZoneDetector {
  private heldZones: Set<ZoneNumber> = new Set();
  private listeners: Set<ZoneChangeHandler> = new Set();

  get activeZone(): ZoneNumber {
    if (this.heldZones.size === 0) return 0;
    return [...this.heldZones].pop()!;
  }

  handleEvent(e: PetEvent): void {
    const zone = keyZoneMap[e.key ?? ''] ?? 0;
    if (zone === 0) return;

    if (e.type === 'KEY_DOWN') {
      this.heldZones.delete(zone);
      this.heldZones.add(zone);
      this.notify();
    } else if (e.type === 'KEY_UP') {
      this.heldZones.delete(zone);
      this.notify();
    } else if (e.type === 'ALL_KEYS_UP') {
      this.heldZones.clear();
      this.notify();
    }
  }

  onChange(fn: ZoneChangeHandler): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn(this.activeZone));
  }
}
