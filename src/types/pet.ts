export type PetAnimationState = 'idle' | 'walking' | 'sleeping' | 'playing';

export type PetMood = 'happy' | 'neutral' | 'sleepy';

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetState {
  position: PetPosition;
  animationState: PetAnimationState;
  mood: PetMood;
}

export type PetAction =
  | { type: 'SET_POSITION'; x: number; y: number }
  | { type: 'SET_ANIMATION_STATE'; state: PetAnimationState }
  | { type: 'SET_MOOD'; mood: PetMood };
