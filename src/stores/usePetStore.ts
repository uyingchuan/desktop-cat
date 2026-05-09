import { create } from 'zustand';
import type { PetState, PetAnimationState, PetMood } from '../types/pet';

interface PetStoreActions {
  setPosition: (x: number, y: number) => void;
  setAnimationState: (state: PetAnimationState) => void;
  setMood: (mood: PetMood) => void;
}

type PetStore = PetState & PetStoreActions;

export const usePetStore = create<PetStore>((set) => ({
  position: { x: 0, y: 0 },
  animationState: 'idle',
  mood: 'happy',

  setPosition: (x, y) => set({ position: { x, y } }),
  setAnimationState: (animationState) => set({ animationState }),
  setMood: (mood) => set({ mood }),
}));
