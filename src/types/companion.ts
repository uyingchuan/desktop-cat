// ============================================================
// Companion Agent V1 — 陪伴型智能体类型定义
// ============================================================

/** 关系阶段 */
export type RelationshipStage = 'new' | 'familiar' | 'close';

/** 关系数据（按人格名 key） */
export interface RelationshipData {
  familiarity: number;           // 0-100
  trust: number;                 // 0-100
  interaction_days: number;      // 累计互动天数
  ignored_count: number;         // 累计忽略次数
  last_contact_at: number;       // 最后一次互动时间戳（秒）
  last_proactive_times: number[];// 最近主动联系时间戳（秒），用于频率检查
  consecutive_ignores: number;   // 连续忽略次数
  daily_interaction_count: number;   // 今日互动次数
  daily_interaction_date: string;    // 日期字符串 "YYYY-MM-DD"，用于日切
  stage: RelationshipStage;      // 当前关系阶段
}

/** 内部猫状态（按人格名 key） */
export interface InternalCatState {
  energy: number;       // 0-100  精力
  curiosity: number;    // 0-100  好奇心
  loneliness: number;   // 0-100  孤独感
  sleepiness: number;   // 0-100  困倦度
  last_decay_at: number;// 上次衰减时间戳（秒）
}

/** 反骚扰联系人策略 */
export interface ContactPolicy {
  companion_enabled: boolean;       // 总开关
  max_proactive_per_day: number;    // 每日最多主动消息数（默认 2）
  min_interval_hours: number;       // 最小间隔小时数（默认 8）
  ignore_cooldown_hours: number;    // 连续忽略冷却小时数（默认 72）
}

/** 记忆 V2 条目 */
export interface MemoryItemV2 {
  id: string;
  personality: string;        // 所属人格名
  content: string;            // 记忆内容
  memory_type: 'fact' | 'event' | 'preference' | 'relationship';
  importance: number;         // 1-10
  created_at: number;         // Unix 时间戳（秒）
  last_referenced_at: number; // 最后引用时间戳（秒）
  trigger_at?: number;        // 提醒触发时间 Unix 时间戳（秒），undefined = 无提醒
}

/** 伴侣事件类型 — V1 仅时间 + 缺席 */
export type CompanionEvent =
  | 'Morning'
  | 'Afternoon'
  | 'Night'
  | 'UserAbsent3Days'
  | 'UserAbsent7Days'
  | 'ConversationMilestone';

/** 输入决策智能体的上下文 */
export interface CompanionContext {
  events: CompanionEvent[];
  relationship: RelationshipData;
  internalState: InternalCatState;
  relevantMemories: MemoryItemV2[];
  personalityName: string;
  systemPrompt: string;
  currentTime: string; // 人类可读时间
}

/** 决策智能体输出 */
export interface CompanionDecision {
  should_contact: boolean;
  confidence: number;   // 0-100
  reason: string;
}

/** 主动消息生成器输入 */
export interface ProactiveMessageContext {
  reason: string;
  stage: RelationshipStage;
  relevantMemories: MemoryItemV2[];
  personalityName: string;
  systemPrompt: string;
  familiarity: number;
  loneliness: number;
}

/** 顶层持久化 — 对应 Rust CompanionData */
export interface CompanionData {
  relationships: Record<string, RelationshipData>;
  internal_states: Record<string, InternalCatState>;
  contact_policy: ContactPolicy;
  memories_v2: MemoryItemV2[];
}

// ============================================================
// 默认值工厂
// ============================================================

export function defaultRelationship(): RelationshipData {
  return {
    familiarity: 0,
    trust: 50,
    interaction_days: 0,
    ignored_count: 0,
    last_contact_at: 0,
    last_proactive_times: [],
    consecutive_ignores: 0,
    daily_interaction_count: 0,
    daily_interaction_date: '',
    stage: 'new',
  };
}

export function defaultInternalState(): InternalCatState {
  return {
    energy: 80,
    curiosity: 50,
    loneliness: 0,
    sleepiness: 0,
    last_decay_at: 0,
  };
}

export function defaultContactPolicy(): ContactPolicy {
  return {
    companion_enabled: true,
    max_proactive_per_day: 2,
    min_interval_hours: 8,
    ignore_cooldown_hours: 72,
  };
}

/** 根据 familiarity 计算关系阶段 */
export function computeStage(familiarity: number): RelationshipStage {
  if (familiarity <= 30) return 'new';
  if (familiarity <= 70) return 'familiar';
  return 'close';
}
