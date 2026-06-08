import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  RelationshipData,
  InternalCatState,
  ContactPolicy,
  MemoryItemV2,
  CompanionData,
} from '../types/companion';
import {
  defaultRelationship,
  defaultInternalState,
  defaultContactPolicy,
  computeStage,
} from '../types/companion';

// ============================================================
// 反骚扰检查结果
// ============================================================
export interface ContactCheckResult {
  allowed: boolean;
  reason?: string;
}

// ============================================================
// Store 类型
// ============================================================
interface CompanionStore {
  // --- 状态 ---
  relationships: Record<string, RelationshipData>;
  internal_states: Record<string, InternalCatState>;
  contact_policy: ContactPolicy;
  memories_v2: MemoryItemV2[];
  loaded: boolean;

  // --- 加载 ---
  loadCompanionData: (data: CompanionData) => void;

  // --- 关系操作 ---
  recordInteraction: (personality: string) => void;
  recordProactiveContact: (personality: string) => void;
  recordIgnoredProactive: (personality: string) => void;
  updateRelationship: (personality: string, updates: Partial<RelationshipData>) => void;
  updateInternalState: (personality: string, updates: Partial<InternalCatState>) => void;
  updateContactPolicy: (updates: Partial<ContactPolicy>) => void;
  resetRelationship: (personality: string) => void;

  // --- 反骚扰检查（纯本地，无 LLM 调用）---
  checkContactAllowed: (personality: string) => ContactCheckResult;

  // --- 记忆 V2 CRUD ---
  addMemoryV2: (memory: Omit<MemoryItemV2, 'id' | 'created_at' | 'last_referenced_at'>) => void;
  removeMemoryV2: (id: string) => void;
  getPersonalityMemoriesV2: (personality: string, type?: string, limit?: number) => MemoryItemV2[];
}

// ============================================================
// 持久化辅助
// ============================================================
function gather(state: CompanionStore): CompanionData {
  return {
    relationships: state.relationships,
    internal_states: state.internal_states,
    contact_policy: state.contact_policy,
    memories_v2: state.memories_v2,
  };
}

function persist(data: CompanionData) {
  invoke('save_companion_data_cmd', { data }).catch(() => {});
}

// ============================================================
// Store
// ============================================================
export const useCompanionStore = create<CompanionStore>((set, get) => ({
  relationships: {},
  internal_states: {},
  contact_policy: defaultContactPolicy(),
  memories_v2: [],
  loaded: false,

  // --- 加载 ---
  loadCompanionData: (data: CompanionData) =>
    set({
      relationships: data.relationships || {},
      internal_states: data.internal_states || {},
      contact_policy: data.contact_policy || defaultContactPolicy(),
      memories_v2: data.memories_v2 || [],
      loaded: true,
    }),

  // --- 记录用户互动（每次用户发消息时调用）---
  recordInteraction: (personality: string) =>
    set((state) => {
      const rel = { ...(state.relationships[personality] || defaultRelationship()) };
      const now = Math.floor(Date.now() / 1000);
      const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

      // 日切处理
      if (rel.daily_interaction_date !== today) {
        rel.daily_interaction_date = today;
        rel.daily_interaction_count = 0;
      }

      rel.daily_interaction_count += 1;
      rel.familiarity = Math.min(100, rel.familiarity + 1);

      // 跨日互动 → 额外加分
      if (rel.last_contact_at > 0) {
        const daysSince = (now - rel.last_contact_at) / 86400;
        if (daysSince >= 1) {
          rel.interaction_days += 1;
          rel.familiarity = Math.min(100, rel.familiarity + 3);
        }
      } else {
        rel.interaction_days = 1;
      }

      rel.last_contact_at = now;
      rel.consecutive_ignores = 0;

      // 信任度缓慢恢复
      rel.trust = Math.min(100, rel.trust + 1);

      // 重算阶段
      rel.stage = computeStage(rel.familiarity);

      const relationships = { ...state.relationships, [personality]: rel };
      const newState = { ...state, relationships };
      persist(gather(newState));
      return { relationships };
    }),

  // --- 记录一次主动联系 ---
  recordProactiveContact: (personality: string) =>
    set((state) => {
      const rel = { ...(state.relationships[personality] || defaultRelationship()) };
      const now = Math.floor(Date.now() / 1000);
      const today = new Date().toISOString().slice(0, 10);

      if (rel.daily_interaction_date !== today) {
        rel.daily_interaction_date = today;
        rel.daily_interaction_count = 0;
      }

      rel.daily_interaction_count += 1;
      if (!rel.last_proactive_times) rel.last_proactive_times = [];
      rel.last_proactive_times.push(now);
      // 保留最近 10 条记录
      if (rel.last_proactive_times.length > 10) {
        rel.last_proactive_times = rel.last_proactive_times.slice(-10);
      }

      const relationships = { ...state.relationships, [personality]: rel };
      const newState = { ...state, relationships };
      persist(gather(newState));
      return { relationships };
    }),

  // --- 记录一次主动消息被忽略 ---
  recordIgnoredProactive: (personality: string) =>
    set((state) => {
      const rel = { ...(state.relationships[personality] || defaultRelationship()) };
      rel.ignored_count += 1;
      rel.consecutive_ignores += 1;
      rel.trust = Math.max(0, rel.trust - 2);
      const relationships = { ...state.relationships, [personality]: rel };
      const newState = { ...state, relationships };
      persist(gather(newState));
      return { relationships };
    }),

  updateRelationship: (personality: string, updates: Partial<RelationshipData>) =>
    set((state) => {
      const rel = { ...(state.relationships[personality] || defaultRelationship()), ...updates };
      const relationships = { ...state.relationships, [personality]: rel };
      const newState = { ...state, relationships };
      persist(gather(newState));
      return { relationships };
    }),

  updateInternalState: (personality: string, updates: Partial<InternalCatState>) =>
    set((state) => {
      const cur = { ...(state.internal_states[personality] || defaultInternalState()), ...updates };
      const internal_states = { ...state.internal_states, [personality]: cur };
      const newState = { ...state, internal_states };
      persist(gather(newState));
      return { internal_states };
    }),

  updateContactPolicy: (updates: Partial<ContactPolicy>) =>
    set((state) => {
      const contact_policy = { ...state.contact_policy, ...updates };
      const newState = { ...state, contact_policy };
      persist(gather(newState));
      return { contact_policy };
    }),

  resetRelationship: (personality: string) =>
    set((state) => {
      const relationships = { ...state.relationships, [personality]: defaultRelationship() };
      const newState = { ...state, relationships };
      persist(gather(newState));
      return { relationships };
    }),

  // --- 反骚扰检查（纯本地逻辑，不调用 LLM）---
  checkContactAllowed: (personality: string): ContactCheckResult => {
    const state = get();
    const policy = state.contact_policy;

    if (!policy.companion_enabled) {
      return { allowed: false, reason: 'companion disabled' };
    }

    const rel = state.relationships[personality] || defaultRelationship();
    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().slice(0, 10);

    // 1. 每日上限检查
    if (rel.daily_interaction_date === today) {
      if (rel.daily_interaction_count >= policy.max_proactive_per_day) {
        return { allowed: false, reason: 'daily proactive limit reached' };
      }
    }

    // 2. 最小间隔检查
    if (rel.last_proactive_times && rel.last_proactive_times.length > 0) {
      const lastTime = rel.last_proactive_times[rel.last_proactive_times.length - 1];
      const hoursSince = (now - lastTime) / 3600;
      if (hoursSince < policy.min_interval_hours) {
        return { allowed: false, reason: `min interval not met: ${hoursSince.toFixed(1)}h < ${policy.min_interval_hours}h` };
      }
    }

    // 3. 连续忽略冷却检查
    if (rel.consecutive_ignores >= 2) {
      const lastTime = rel.last_proactive_times
        ? rel.last_proactive_times[rel.last_proactive_times.length - 1]
        : 0;
      if (lastTime > 0) {
        const hoursSince = (now - lastTime) / 3600;
        if (hoursSince < policy.ignore_cooldown_hours) {
          return { allowed: false, reason: `ignore cooldown: ${hoursSince.toFixed(1)}h < ${policy.ignore_cooldown_hours}h` };
        }
        // 冷却期过，重置连续忽略计数
        // (副作用在这里做，调用方可忽略)
        get().updateRelationship(personality, { consecutive_ignores: 0 });
      }
    }

    return { allowed: true };
  },

  // --- 记忆 V2 CRUD ---
  addMemoryV2: (memory: Omit<MemoryItemV2, 'id' | 'created_at' | 'last_referenced_at'>) =>
    set((state) => {
      const now = Math.floor(Date.now() / 1000);
      const item: MemoryItemV2 = {
        ...memory,
        id: crypto.randomUUID(),
        created_at: now,
        last_referenced_at: now,
      };
      const memories_v2 = [...state.memories_v2, item];
      const newState = { ...state, memories_v2 };
      persist(gather(newState));
      return { memories_v2 };
    }),

  removeMemoryV2: (id: string) =>
    set((state) => {
      const memories_v2 = state.memories_v2.filter((m) => m.id !== id);
      const newState = { ...state, memories_v2 };
      persist(gather(newState));
      return { memories_v2 };
    }),

  getPersonalityMemoriesV2: (personality: string, type?: string, limit?: number): MemoryItemV2[] => {
    const state = get();
    let results = state.memories_v2.filter((m) => m.personality === personality);
    if (type) {
      results = results.filter((m) => m.memory_type === type);
    }
    // 按重要性降序排序
    results.sort((a, b) => b.importance - a.importance);
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }
    return results;
  },
}));
