import { create } from 'zustand';
import type { PetState, PetAnimationState, PetMood, FacingDirection, Personality, PersonalityParams } from '../types/pet';
import { BUILTIN_PARAMS } from '../types/pet';

interface PetStoreActions {
  setPosition: (x: number, y: number) => void;
  setAnimationState: (state: PetAnimationState) => void;
  setMood: (mood: PetMood) => void;
  setFacingDirection: (direction: FacingDirection) => void;
  setPersonality: (personality: Personality) => void;
  setPersonalityParams: (params: PersonalityParams) => void;
  setSpeech: (speech: string | null) => void;
}

type PetStore = PetState & PetStoreActions;

export const usePetStore = create<PetStore>((set) => ({
  position: { x: 0, y: 0 },
  animationState: 'idle',
  mood: 'happy',
  facingDirection: 'left',
  personality: 'calm',
  personalityParams: BUILTIN_PARAMS.calm,
  speech: null,

  setPosition: (x, y) => set({ position: { x, y } }),
  setAnimationState: (animationState) => set({ animationState }),
  setMood: (mood) => set({ mood }),
  setFacingDirection: (facingDirection) => set({ facingDirection }),
  setPersonality: (personality) => set({ personality }),
  setPersonalityParams: (personalityParams) => set({ personalityParams }),
  setSpeech: (speech) => set({ speech }),
}));
