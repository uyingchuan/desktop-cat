import { create } from 'zustand';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatStore {
  conversations: Record<string, ChatMessage[]>;
  addMessage: (personality: string, msg: ChatMessage) => void;
  clearConversation: (personality: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  conversations: {},

  addMessage: (personality, msg) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [personality]: [...(state.conversations[personality] || []), msg],
      },
    })),

  clearConversation: (personality) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [personality]: [],
      },
    })),
}));
