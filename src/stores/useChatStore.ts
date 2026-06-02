import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useMemoryStore } from './useMemoryStore';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;  // Unix 时间戳（秒）
}

const MAX_MESSAGES = 100;

interface ChatStore {
  conversations: Record<string, ChatMessage[]>;
  loadConversations: (conversations: Record<string, ChatMessage[]>) => void;
  addMessage: (personality: string, msg: { role: 'user' | 'assistant'; content: string; timestamp?: number }) => void;
  clearConversation: (personality: string) => void;
}

function persist(conversations: Record<string, ChatMessage[]>) {
  invoke('save_conversations', { conversations }).catch(() => {});
}

export const useChatStore = create<ChatStore>((set) => ({
  conversations: {},

  loadConversations: (conversations) =>
    set({ conversations }),

  addMessage: (personality, msg) =>
    set((state) => {
      const history = state.conversations[personality] || [];
      const stamped: ChatMessage = { ...msg, timestamp: msg.timestamp ?? Math.floor(Date.now() / 1000) };
      const updated = [...history.slice(-(MAX_MESSAGES - 1)), stamped];
      const conversations = {
        ...state.conversations,
        [personality]: updated,
      };
      persist(conversations);
      return { conversations };
    }),

  clearConversation: (personality) =>
    set((state) => {
      const conversations = {
        ...state.conversations,
        [personality]: [],
      };
      persist(conversations);
      useMemoryStore.getState().clearMemories(personality);
      return { conversations };
    }),
}));
