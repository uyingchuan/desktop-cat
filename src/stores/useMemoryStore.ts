import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface MemoryStore {
  memories: Record<string, string[]>;
  loaded: boolean;
  loadMemories: (initial: Record<string, string[]>) => void;
  updateMemories: (personality: string, memories: string[]) => Promise<void>;
  clearMemories: (personality: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  memories: {},
  loaded: false,

  loadMemories: (initial: Record<string, string[]>) =>
    set({ memories: initial, loaded: true }),

  updateMemories: async (personality: string, memories: string[]) => {
    set((state) => ({
      memories: { ...state.memories, [personality]: memories },
    }));
    await invoke('save_memories', { personality, memories }).catch(() => {});
  },

  clearMemories: async (personality: string) => {
    set((state) => ({
      memories: { ...state.memories, [personality]: [] },
    }));
    await invoke('save_memories', { personality, memories: [] as string[] }).catch(() => {});
  },
}));
