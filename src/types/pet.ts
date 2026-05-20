export type Personality = 'calm' | 'active';

export type PetAnimationState =
  | 'idle' | 'idle2'
  | 'walking' | 'running'
  | 'sleeping'
  | 'playing'
  | 'floating'
  | 'licking'
  | 'attacking'
  | 'hurt'
  | 'dead';

export type PetMood = 'happy' | 'neutral' | 'sleepy';

export type FacingDirection = 'left' | 'right';

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetState {
  position: PetPosition;
  animationState: PetAnimationState;
  mood: PetMood;
  facingDirection: FacingDirection;
  personality: Personality;
}

export type PetAction =
  | { type: 'SET_POSITION'; x: number; y: number }
  | { type: 'SET_ANIMATION_STATE'; state: PetAnimationState }
  | { type: 'SET_MOOD'; mood: PetMood }
  | { type: 'SET_FACING_DIRECTION'; direction: FacingDirection }
  | { type: 'SET_PERSONALITY'; personality: Personality };
