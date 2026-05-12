import type {
  PetState,
  PetEvent,
  StateChangeListener,
} from '../types/pet';

type TransitionTable = Record<PetState, Record<string, PetState>>;

export class PetStateMachine {
  current: PetState = 'idle';
  private listeners: Set<StateChangeListener> = new Set();

  private transitions: TransitionTable = {
    idle: {
      KEY_DOWN_Z: 'left_paw',
      KEY_DOWN_X: 'right_paw',
      KEY_DOWN_V: 'wave',
    },
    left_paw: {
      KEY_DOWN_X: 'right_paw',
      KEY_UP_Z: 'idle',
      ALL_KEYS_UP: 'idle',
    },
    right_paw: {
      KEY_DOWN_Z: 'left_paw',
      KEY_UP_X: 'idle',
      ALL_KEYS_UP: 'idle',
    },
    wave: {
      KEY_UP_V: 'idle',
      ALL_KEYS_UP: 'idle',
    },
  };

  send(event: PetEvent): boolean {
    const eventKey = event.key
      ? `${event.type}_${event.key}`
      : event.type;

    const next = this.transitions[this.current]?.[eventKey];
    if (next != null && next !== this.current) {
      const prev = this.current;
      this.current = next;
      this.listeners.forEach((fn) => fn(prev, next, event));
      return true;
    }
    return false;
  }

  onStateChange(fn: StateChangeListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  is(state: PetState): boolean {
    return this.current === state;
  }
}
