import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface MemoryStore {
  memories: string[];
  loaded: boolean;
  loadMemories: (initial: string[]) => void;
  updateMemories: (memories: string[]) => Promise<void>;
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  memories: [],
  loaded: false,

  loadMemories: (initial: string[]) =>
    set({ memories: initial, loaded: true }),

  updateMemories: async (memories: string[]) => {
    set({ memories });
    await invoke('save_memories', { memories }).catch(() => {});
  },
}));
