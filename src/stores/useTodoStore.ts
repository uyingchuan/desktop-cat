import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TodoItem } from '../types/todo';

interface TodoStore {
  items: TodoItem[];
  loadItems: (items: TodoItem[]) => void;
  addItem: (text: string) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
}

function persist(items: TodoItem[]) {
  invoke('save_todo_items', { items }).catch(() => {});
}

export const useTodoStore = create<TodoStore>((set) => ({
  items: [],

  loadItems: (items) => set({ items }),

  addItem: (text) =>
    set((state) => {
      const newItem: TodoItem = {
        id: crypto.randomUUID(),
        text,
        completed: false,
        created_at: Math.floor(Date.now() / 1000),
      };
      const items = [...state.items, newItem];
      persist(items);
      return { items };
    }),

  toggleItem: (id) =>
    set((state) => {
      const items = state.items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      persist(items);
      return { items };
    }),

  deleteItem: (id) =>
    set((state) => {
      const items = state.items.filter((item) => item.id !== id);
      persist(items);
      return { items };
    }),
}));
