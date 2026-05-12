import { create } from 'zustand';
import type { PetState } from '../types/pet';
import type { SpriteKey } from '../engine/animationMapper';
import type { ZoneNumber } from '../engine/keyZoneDetector';

interface PetStore {
  currentState: PetState;
  currentSprite: SpriteKey;
  mousePos: { x: number; y: number };
  keysHeld: string[];
  activeZone: ZoneNumber;
}

export const usePetStore = create<PetStore>(() => ({
  currentState: 'idle',
  currentSprite: 'idle',
  mousePos: { x: 0, y: 0 },
  keysHeld: [],
  activeZone: 0,
}));
