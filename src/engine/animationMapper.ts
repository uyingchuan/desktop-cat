import type { PetState } from '../types/pet';

export type SpriteKey = 'idle' | 'left' | 'right' | 'wave';

const spriteMap: Record<PetState, SpriteKey> = {
  idle: 'idle',
  left_paw: 'left',
  right_paw: 'right',
  wave: 'wave',
};

export function getSpriteKey(state: PetState): SpriteKey {
  return spriteMap[state];
}
