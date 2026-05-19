import { create } from 'zustand';
import type { PetState, PetAnimationState, PetMood, FacingDirection } from '../types/pet';

interface PetStoreActions {
  setPosition: (x: number, y: number) => void;
  setAnimationState: (state: PetAnimationState) => void;
  setMood: (mood: PetMood) => void;
  setFacingDirection: (direction: FacingDirection) => void;
}

type PetStore = PetState & PetStoreActions;

export const usePetStore = create<PetStore>((set) => ({
  position: { x: 0, y: 0 },
  animationState: 'idle',
  mood: 'happy',
  facingDirection: 'left',

  setPosition: (x, y) => set({ position: { x, y } }),
  setAnimationState: (animationState) => set({ animationState }),
  setMood: (mood) => set({ mood }),
  setFacingDirection: (facingDirection) => set({ facingDirection }),
}));
