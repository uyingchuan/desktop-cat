import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { InputSnapshot } from '../types/input';
import { InputSystem } from './inputSystem';
import { PetStateMachine } from './petStateMachine';
import { getSpriteKey } from './animationMapper';
import { KeyZoneDetector } from './keyZoneDetector';
import { usePetStore } from '../stores/usePetStore';

export class PetEngine {
  private inputSystem = new InputSystem();
  private stateMachine = new PetStateMachine();
  private zoneDetector = new KeyZoneDetector();
  private unlisten: (() => void) | null = null;

  constructor() {
    // Pipeline 1: StateMachine
    this.inputSystem.onEvent((e) => {
      this.stateMachine.send(e);
    });

    this.stateMachine.onStateChange((_prev, next) => {
      usePetStore.setState({
        currentState: next,
        currentSprite: getSpriteKey(next),
      });
    });

    // Pipeline 2: KeyZoneDetector (independent)
    this.inputSystem.onEvent((e) => {
      this.zoneDetector.handleEvent(e);
    });

    this.zoneDetector.onChange((zone) => {
      usePetStore.setState({ activeZone: zone });
    });
  }

  async start(): Promise<void> {
    const fn = await listen<InputSnapshot>('input:snapshot', (e) => {
      usePetStore.setState({ mousePos: e.payload.mouse });
      this.inputSystem.process(e.payload);
    });
    this.unlisten = fn;

    await invoke('start_input_listener');
  }

  stop(): void {
    this.unlisten?.();
  }
}
