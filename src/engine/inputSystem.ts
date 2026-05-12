import type { InputSnapshot } from '../types/input';
import type { PetEvent } from '../types/pet';

type EventHandler = (e: PetEvent) => void;

export class InputSystem {
  private prevKeys: Set<string> = new Set();
  private listeners: Set<EventHandler> = new Set();

  process(snapshot: InputSnapshot): void {
    const current = new Set(snapshot.keys);

    for (const k of current) {
      if (!this.prevKeys.has(k)) {
        this.emit({ type: 'KEY_DOWN', key: k });
      }
    }

    for (const k of this.prevKeys) {
      if (!current.has(k)) {
        this.emit({ type: 'KEY_UP', key: k });
      }
    }

    if (current.size === 0 && this.prevKeys.size > 0) {
      this.emit({ type: 'ALL_KEYS_UP' });
    }

    this.prevKeys = current;
  }

  onEvent(fn: EventHandler): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(e: PetEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }
}
